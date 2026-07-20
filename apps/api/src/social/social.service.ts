import { createHmac, timingSafeEqual } from 'node:crypto';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma, type SocialConnection } from '@prisma/client';
import {
  SocialNetwork,
  type ScheduledPostDto,
  type SchedulePostInput,
  type SocialConnectionInfo,
} from '@odalyan/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ShopService } from '../shop/shop.service';
import { PublisherRegistry } from './publishers/publisher.registry';
import type { PublishResult, SocialPublisher } from './publishers/social-publisher.interface';

const NETWORKS = Object.values(SocialNetwork) as string[];
const MAX_ATTEMPTS = 3;

@Injectable()
export class SocialService {
  private readonly logger = new Logger(SocialService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly shopService: ShopService,
    private readonly registry: PublisherRegistry,
  ) {}

  /** État de tous les réseaux (provider écrit ? app configurée ?). */
  listNetworks() {
    return this.registry.list();
  }

  /** État de connexion des réseaux pour la boutique. */
  async listConnections(userId: string): Promise<SocialConnectionInfo[]> {
    const shop = await this.shopService.requireOwnedShop(userId);
    const rows = await this.prisma.socialConnection.findMany({ where: { shopId: shop.id } });
    return NETWORKS.map((network) => {
      const row = rows.find((r) => r.network === network);
      return { network, connected: row?.connected ?? false, accountName: row?.accountName ?? null };
    });
  }

  // ------------------------------------------------------------- Connexion OAuth

  /** `state` signé : identifie la boutique au retour du réseau (aucune session côté callback). */
  private signState(shopId: string, network: string): string {
    const payload = Buffer.from(JSON.stringify({ shopId, network, t: Date.now() })).toString('base64url');
    const sig = createHmac('sha256', process.env.JWT_ACCESS_SECRET ?? 'dev').update(payload).digest('base64url');
    return `${payload}.${sig}`;
  }

  private verifyState(state: string): { shopId: string; network: string } {
    const [payload, sig] = state.split('.');
    if (!payload || !sig) throw new BadRequestException('État OAuth invalide.');
    const expected = createHmac('sha256', process.env.JWT_ACCESS_SECRET ?? 'dev').update(payload).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new BadRequestException('État OAuth invalide.');
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as {
      shopId: string;
      network: string;
      t: number;
    };
    if (Date.now() - data.t > 15 * 60_000) throw new BadRequestException('Lien de connexion expiré.');
    return { shopId: data.shopId, network: data.network };
  }

  /**
   * Démarre la connexion d'un réseau.
   * App développeur configurée → renvoie l'URL d'autorisation (vraie connexion OAuth).
   * Sinon → connexion simulée (démo), signalée comme telle.
   */
  async connect(userId: string, network: string, redirectUri: string) {
    if (!NETWORKS.includes(network)) throw new BadRequestException('Réseau inconnu');
    const shop = await this.shopService.requireOwnedShop(userId);
    const publisher = this.registry.get(network);

    if (publisher?.enabled) {
      return { authorizeUrl: publisher.authorizeUrl(redirectUri, this.signState(shop.id, network)), simulated: false };
    }

    // Mode démo : connexion fictive pour pouvoir tester le parcours
    const accountName = `@${shop.slug}_${network.toLowerCase()} (simulé)`;
    await this.prisma.socialConnection.upsert({
      where: { shopId_network: { shopId: shop.id, network } },
      update: { connected: true, accountName, connectedAt: new Date(), simulated: true },
      create: { shopId: shop.id, network, connected: true, accountName, connectedAt: new Date(), simulated: true },
    });
    return { authorizeUrl: null, simulated: true };
  }

  /** Retour du réseau : échange le code contre des jetons et enregistre la connexion. */
  async handleOAuthCallback(network: string, code: string, state: string, redirectUri: string) {
    const { shopId, network: stateNetwork } = this.verifyState(state);
    if (stateNetwork !== network) throw new BadRequestException('Réseau incohérent.');
    const publisher = this.registry.get(network);
    if (!publisher?.enabled) throw new BadRequestException('Réseau non configuré.');

    const result = await publisher.exchangeCode(code, redirectUri);
    await this.prisma.socialConnection.upsert({
      where: { shopId_network: { shopId, network } },
      update: {
        connected: true,
        simulated: false,
        accountName: result.accountName,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken ?? null,
        tokenExpiresAt: result.expiresAt ?? null,
        externalId: result.externalId ?? null,
        scope: result.scope ?? null,
        connectedAt: new Date(),
      },
      create: {
        shopId,
        network,
        connected: true,
        simulated: false,
        accountName: result.accountName,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken ?? null,
        tokenExpiresAt: result.expiresAt ?? null,
        externalId: result.externalId ?? null,
        scope: result.scope ?? null,
        connectedAt: new Date(),
      },
    });
    return { connected: true, network, accountName: result.accountName };
  }

  async disconnect(userId: string, network: string) {
    const shop = await this.shopService.requireOwnedShop(userId);
    await this.prisma.socialConnection
      .updateMany({
        where: { shopId: shop.id, network },
        data: {
          connected: false,
          accountName: null,
          accessToken: null,
          refreshToken: null,
          tokenExpiresAt: null,
          externalId: null,
          scope: null,
          simulated: true,
        },
      })
      .catch(() => undefined);
    return { disconnected: true };
  }

  // ------------------------------------------------------------- Publications

  /** Programme une publication (ou immédiate si pas de date). */
  async schedule(userId: string, input: SchedulePostInput) {
    const shop = await this.shopService.requireOwnedShop(userId);

    const connections = await this.prisma.socialConnection.findMany({
      where: { shopId: shop.id, network: { in: input.networks }, connected: true },
    });
    if (connections.length === 0) {
      throw new BadRequestException('Aucun des réseaux choisis n’est connecté.');
    }

    const post = await this.prisma.scheduledPost.create({
      data: {
        shopId: shop.id,
        caption: input.caption,
        imageUrl: input.imageUrl ?? null,
        videoUrl: input.videoUrl ?? null,
        networks: input.networks,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : new Date(),
        status: 'SCHEDULED',
      },
    });

    await this.processDue(shop.id);
    return this.prisma.scheduledPost.findUnique({ where: { id: post.id } });
  }

  async listScheduled(userId: string): Promise<ScheduledPostDto[]> {
    const shop = await this.shopService.requireOwnedShop(userId);
    await this.processDue(shop.id);
    const posts = await this.prisma.scheduledPost.findMany({
      where: { shopId: shop.id },
      orderBy: { scheduledAt: 'desc' },
      take: 50,
    });
    return posts.map((p) => ({
      id: p.id,
      caption: p.caption,
      imageUrl: p.imageUrl,
      videoUrl: p.videoUrl,
      networks: p.networks,
      scheduledAt: p.scheduledAt.toISOString(),
      status: p.status,
      publishedAt: p.publishedAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
      results: (p.results as ScheduledPostDto['results']) ?? null,
      lastError: p.lastError ?? null,
    }));
  }

  async cancel(userId: string, id: string) {
    const shop = await this.shopService.requireOwnedShop(userId);
    const post = await this.prisma.scheduledPost.findUnique({ where: { id } });
    if (!post || post.shopId !== shop.id) throw new NotFoundException('Publication introuvable');
    if (post.status !== 'SCHEDULED') throw new BadRequestException('Publication déjà traitée');
    return this.prisma.scheduledPost.update({ where: { id }, data: { status: 'CANCELLED' } });
  }

  /** Worker : publie toutes les boutiques (toutes les 5 minutes). */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async processAllDue(): Promise<{ processed: number }> {
    const due = await this.prisma.scheduledPost.findMany({
      where: { status: 'SCHEDULED', scheduledAt: { lte: new Date() }, attempts: { lt: MAX_ATTEMPTS } },
      select: { shopId: true },
      distinct: ['shopId'],
    });
    let processed = 0;
    for (const { shopId } of due) processed += await this.processDue(shopId);
    if (processed) this.logger.log(`Publications traitées : ${processed}`);
    return { processed };
  }

  /**
   * Renouvelle le jeton d'accès quand il est sur le point d'expirer.
   * Les réseaux à jetons longue durée (Meta) n'implémentent pas `refresh` : on ne fait rien.
   */
  private async withFreshToken(publisher: SocialPublisher, conn: SocialConnection): Promise<SocialConnection> {
    const expiry = conn.tokenExpiresAt?.getTime();
    if (!publisher.refresh || !expiry || expiry - Date.now() > 60_000) return conn;

    const renewed = await publisher.refresh(conn);
    this.logger.log(`${conn.network} — jeton renouvelé (boutique ${conn.shopId})`);
    return this.prisma.socialConnection.update({
      where: { shopId_network: { shopId: conn.shopId, network: conn.network } },
      data: {
        accessToken: renewed.accessToken,
        refreshToken: renewed.refreshToken ?? conn.refreshToken,
        tokenExpiresAt: renewed.expiresAt ?? null,
        scope: renewed.scope ?? conn.scope,
      },
    });
  }

  /**
   * Publie réellement les posts arrivés à échéance pour une boutique.
   * Chaque réseau est publié indépendamment ; le résultat est consigné par réseau.
   * Réseau simulé ou non configuré → marqué « simulé » (pas d'échec bloquant).
   */
  private async processDue(shopId: string): Promise<number> {
    const due = await this.prisma.scheduledPost.findMany({
      where: { shopId, status: 'SCHEDULED', scheduledAt: { lte: new Date() }, attempts: { lt: MAX_ATTEMPTS } },
    });
    if (due.length === 0) return 0;

    const connections = await this.prisma.socialConnection.findMany({ where: { shopId, connected: true } });

    for (const post of due) {
      const results: Record<string, PublishResult & { simulated?: boolean }> = {};

      for (const network of post.networks) {
        const publisher = this.registry.get(network);
        const conn = connections.find((c) => c.network === network);

        if (!conn) {
          results[network] = { ok: false, error: 'Réseau non connecté.' };
          continue;
        }
        // Pas de provider, app non configurée, ou connexion simulée → publication simulée
        if (!publisher?.enabled || conn.simulated) {
          results[network] = { ok: true, simulated: true };
          continue;
        }
        try {
          const fresh = await this.withFreshToken(publisher, conn);
          results[network] = await publisher.publish(fresh, {
            caption: post.caption,
            imageUrl: post.imageUrl,
            videoUrl: post.videoUrl,
          });
        } catch (err) {
          results[network] = { ok: false, error: err instanceof Error ? err.message : String(err) };
        }
      }

      const values = Object.values(results);
      const okCount = values.filter((r) => r.ok).length;
      const status = okCount === 0 ? 'FAILED' : okCount === values.length ? 'PUBLISHED' : 'PARTIAL';
      const firstError = values.find((r) => !r.ok)?.error ?? null;

      await this.prisma.scheduledPost.update({
        where: { id: post.id },
        data: {
          status,
          publishedAt: okCount > 0 ? new Date() : null,
          results: results as unknown as Prisma.InputJsonValue,
          attempts: { increment: 1 },
          lastError: firstError,
        },
      });
    }
    return due.length;
  }
}
