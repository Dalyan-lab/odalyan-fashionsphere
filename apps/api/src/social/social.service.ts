import { createHmac, timingSafeEqual } from 'node:crypto';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma, type SocialConnection } from '@prisma/client';
import {
  SocialNetwork,
  type BestTimeSlot,
  type BestTimesResult,
  type MonthlyReportDto,
  type PostInsightDto,
  type ScheduledPostDto,
  type SchedulePostInput,
  type SocialConnectionInfo,
  type TopPostDto,
  type UpdateScheduledPostInput,
} from '@odalyan/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ShopService } from '../shop/shop.service';
import { PublisherRegistry } from './publishers/publisher.registry';
import type { PublishResult, SocialPublisher } from './publishers/social-publisher.interface';

const NETWORKS = Object.values(SocialNetwork) as string[];
const MAX_ATTEMPTS = 3;
/** Au-delà, une publication n'évolue quasiment plus : inutile de réinterroger les réseaux. */
const INSIGHTS_WINDOW_DAYS = 30;
/**
 * En dessous, une recommandation d'horaire tirée des données du vendeur serait du
 * bruit : on continue d'afficher les repères généraux du réseau.
 */
const MIN_POSTS_FOR_BEST_TIMES = 5;

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
    const JOUR = 24 * 60 * 60 * 1000;
    return NETWORKS.map((network) => {
      const row = rows.find((r) => r.network === network);
      const echeance = row?.tokenExpiresAt ?? null;
      return {
        network,
        connected: row?.connected ?? false,
        accountName: row?.accountName ?? null,
        expiresAt: echeance?.toISOString() ?? null,
        // Arrondi vers le bas : mieux vaut annoncer un jour de moins qu'un de
        // trop sur une échéance qui coupe la publication.
        expiresInDays: echeance ? Math.floor((echeance.getTime() - Date.now()) / JOUR) : null,
      };
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
      include: { insights: true },
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
      insights: p.insights.map(
        (i): PostInsightDto => ({
          network: i.network,
          views: i.views,
          reach: i.reach,
          likes: i.likes,
          comments: i.comments,
          shares: i.shares,
          fetchedAt: i.fetchedAt.toISOString(),
          error: i.error,
        }),
      ),
    }));
  }

  /**
   * Modifie une publication non encore publiée, ou relance une publication
   * échouée/annulée : le statut repasse à SCHEDULED et les tentatives sont
   * remises à zéro (sert donc aussi de « réessayer »).
   */
  async update(userId: string, id: string, input: UpdateScheduledPostInput) {
    const shop = await this.shopService.requireOwnedShop(userId);
    const post = await this.prisma.scheduledPost.findUnique({ where: { id } });
    if (!post || post.shopId !== shop.id) throw new NotFoundException('Publication introuvable');
    if (post.status === 'PUBLISHED' || post.status === 'PARTIAL') {
      throw new BadRequestException('Publication déjà publiée — non modifiable.');
    }

    if (input.networks) {
      const connections = await this.prisma.socialConnection.findMany({
        where: { shopId: shop.id, network: { in: input.networks }, connected: true },
      });
      if (connections.length === 0) {
        throw new BadRequestException('Aucun des réseaux choisis n’est connecté.');
      }
    }

    await this.prisma.scheduledPost.update({
      where: { id },
      data: {
        caption: input.caption ?? post.caption,
        networks: input.networks ?? post.networks,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : post.scheduledAt,
        imageUrl: input.imageUrl !== undefined ? input.imageUrl : post.imageUrl,
        videoUrl: input.videoUrl !== undefined ? input.videoUrl : post.videoUrl,
        status: 'SCHEDULED',
        attempts: 0,
        lastError: null,
        results: Prisma.DbNull,
        publishedAt: null,
      },
    });

    // Publie tout de suite si la nouvelle échéance est déjà passée
    await this.processDue(shop.id);
    return this.prisma.scheduledPost.findUnique({ where: { id } });
  }

  async cancel(userId: string, id: string) {
    const shop = await this.shopService.requireOwnedShop(userId);
    const post = await this.prisma.scheduledPost.findUnique({ where: { id } });
    if (!post || post.shopId !== shop.id) throw new NotFoundException('Publication introuvable');
    if (post.status !== 'SCHEDULED') throw new BadRequestException('Publication déjà traitée');
    return this.prisma.scheduledPost.update({ where: { id }, data: { status: 'CANCELLED' } });
  }

  /**
   * Retire une publication de la liste de la boutique (quel que soit son statut).
   * N'affecte PAS le contenu déjà publié côté réseau : la vidéo reste sur le compte
   * TikTok/etc. (l'API de publication ne permet pas de la supprimer là-bas).
   */
  async remove(userId: string, id: string) {
    const shop = await this.shopService.requireOwnedShop(userId);
    const post = await this.prisma.scheduledPost.findUnique({ where: { id } });
    if (!post || post.shopId !== shop.id) throw new NotFoundException('Publication introuvable');
    await this.prisma.scheduledPost.delete({ where: { id } });
    return { deleted: true };
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

  // ------------------------------------------------------------- Statistiques

  /** Rafraîchit les statistiques de la boutique du vendeur (bouton « actualiser »). */
  async refreshInsightsForUser(userId: string): Promise<{ refreshed: number }> {
    const shop = await this.shopService.requireOwnedShop(userId);
    return { refreshed: await this.refreshInsights(shop.id) };
  }

  /** Worker : rafraîchit les statistiques de toutes les boutiques (toutes les 6 heures). */
  @Cron(CronExpression.EVERY_6_HOURS)
  async refreshAllInsights(): Promise<{ refreshed: number }> {
    const since = new Date(Date.now() - INSIGHTS_WINDOW_DAYS * 86_400_000);
    const shops = await this.prisma.scheduledPost.findMany({
      where: { status: { in: ['PUBLISHED', 'PARTIAL'] }, publishedAt: { gte: since } },
      select: { shopId: true },
      distinct: ['shopId'],
    });
    let refreshed = 0;
    for (const { shopId } of shops) refreshed += await this.refreshInsights(shopId);
    if (refreshed) this.logger.log(`Statistiques rafraîchies : ${refreshed}`);
    return { refreshed };
  }

  /**
   * Interroge chaque réseau pour les publications récentes de la boutique et
   * enregistre les compteurs. Un réseau en échec (permission manquante, contenu
   * supprimé) n'interrompt pas les autres : l'erreur est consignée sur la ligne
   * concernée, et les chiffres déjà connus sont conservés.
   */
  private async refreshInsights(shopId: string): Promise<number> {
    const since = new Date(Date.now() - INSIGHTS_WINDOW_DAYS * 86_400_000);
    const posts = await this.prisma.scheduledPost.findMany({
      where: { shopId, status: { in: ['PUBLISHED', 'PARTIAL'] }, publishedAt: { gte: since } },
      include: { insights: true },
    });
    if (posts.length === 0) return 0;

    const connections = await this.prisma.socialConnection.findMany({ where: { shopId, connected: true } });
    let refreshed = 0;

    for (const post of posts) {
      const results = (post.results ?? {}) as unknown as Record<string, PublishResult & { simulated?: boolean }>;

      for (const [network, outcome] of Object.entries(results)) {
        // Rien à lire pour un réseau en échec ou dont la publication était simulée.
        if (!outcome.ok || outcome.simulated) continue;

        const publisher = this.registry.get(network);
        const conn = connections.find((c) => c.network === network);
        if (!publisher?.fetchInsights || !conn || conn.simulated) continue;

        // L'id résolu au passage précédent (TikTok) évite de refaire la résolution.
        const known = post.insights.find((i) => i.network === network);
        const externalId = known?.externalId ?? outcome.externalId;
        if (!externalId) continue;

        try {
          const fresh = await this.withFreshToken(publisher, conn);
          const stats = await publisher.fetchInsights(fresh, externalId);
          await this.prisma.postInsight.upsert({
            where: { postId_network: { postId: post.id, network } },
            update: {
              externalId: stats.externalId ?? externalId,
              views: stats.views ?? 0,
              reach: stats.reach ?? 0,
              likes: stats.likes ?? 0,
              comments: stats.comments ?? 0,
              shares: stats.shares ?? 0,
              fetchedAt: new Date(),
              error: stats.partial ?? null,
            },
            create: {
              postId: post.id,
              network,
              externalId: stats.externalId ?? externalId,
              views: stats.views ?? 0,
              reach: stats.reach ?? 0,
              likes: stats.likes ?? 0,
              comments: stats.comments ?? 0,
              shares: stats.shares ?? 0,
              error: stats.partial ?? null,
            },
          });
          refreshed++;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.warn(`${network} — statistiques indisponibles (post ${post.id}) : ${message}`);
          // Conserve les chiffres déjà connus : on ne consigne que l'échec.
          await this.prisma.postInsight.upsert({
            where: { postId_network: { postId: post.id, network } },
            update: { fetchedAt: new Date(), error: message },
            create: { postId: post.id, network, externalId, error: message },
          });
        }
      }
    }
    return refreshed;
  }

  // ------------------------------------------------------------- Analyse

  /** Publications publiées et mesurées de la boutique, sur une période donnée. */
  private async measuredPosts(shopId: string, from?: Date, to?: Date) {
    return this.prisma.scheduledPost.findMany({
      where: {
        shopId,
        status: { in: ['PUBLISHED', 'PARTIAL'] },
        publishedAt: { not: null, ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) },
      },
      include: { insights: true },
      orderBy: { publishedAt: 'desc' },
    });
  }

  private static interactions(i: { likes: number; comments: number; shares: number }): number {
    return i.likes + i.comments + i.shares;
  }

  /**
   * Déduit les meilleurs créneaux de publication des performances réellement
   * constatées, réseau par réseau. Tant que le vendeur n'a pas assez de recul,
   * on renvoie une liste vide : l'interface garde alors les repères généraux
   * plutôt que d'afficher une recommandation tirée de deux publications.
   */
  async bestTimes(userId: string): Promise<BestTimesResult> {
    const shop = await this.shopService.requireOwnedShop(userId);
    // 6 mois : assez pour dégager une tendance, assez récent pour rester pertinent.
    const posts = await this.measuredPosts(shop.id, new Date(Date.now() - 180 * 86_400_000));

    const buckets = new Map<string, { network: string; weekday: number; hour: number; total: number; samples: number }>();
    let analyzed = 0;

    for (const post of posts) {
      if (!post.publishedAt) continue;
      const d = post.publishedAt;
      const weekday = ((d.getDay() + 6) % 7) + 1; // 1 = lundi … 7 = dimanche
      const hour = d.getHours();
      let counted = false;

      for (const insight of post.insights) {
        const value = SocialService.interactions(insight);
        // Une ligne en erreur pure (aucun chiffre) ne doit pas peser dans la moyenne.
        if (insight.error && value === 0 && insight.views === 0) continue;

        const key = `${insight.network}|${weekday}|${hour}`;
        const bucket = buckets.get(key) ?? { network: insight.network, weekday, hour, total: 0, samples: 0 };
        bucket.total += value;
        bucket.samples++;
        buckets.set(key, bucket);
        counted = true;
      }
      if (counted) analyzed++;
    }

    if (analyzed < MIN_POSTS_FOR_BEST_TIMES) {
      return { slots: [], analyzed, minimum: MIN_POSTS_FOR_BEST_TIMES };
    }

    // Meilleurs créneaux par réseau (3 au maximum), du plus performant au moins bon.
    const byNetwork = new Map<string, BestTimeSlot[]>();
    for (const b of buckets.values()) {
      const slot: BestTimeSlot = {
        network: b.network,
        weekday: b.weekday,
        hour: b.hour,
        avgInteractions: Math.round((b.total / b.samples) * 10) / 10,
        samples: b.samples,
      };
      byNetwork.set(b.network, [...(byNetwork.get(b.network) ?? []), slot]);
    }

    const slots: BestTimeSlot[] = [];
    for (const list of byNetwork.values()) {
      list.sort((a, b) => b.avgInteractions - a.avgInteractions || b.samples - a.samples);
      slots.push(...list.slice(0, 3));
    }
    return { slots, analyzed, minimum: MIN_POSTS_FOR_BEST_TIMES };
  }

  /** Convertit une publication mesurée en ligne de classement. */
  private static toTopPost(post: {
    id: string;
    caption: string;
    networks: string[];
    publishedAt: Date | null;
    imageUrl: string | null;
    videoUrl: string | null;
    insights: { views: number; likes: number; comments: number; shares: number }[];
  }): TopPostDto {
    return {
      id: post.id,
      caption: post.caption,
      networks: post.networks,
      publishedAt: post.publishedAt?.toISOString() ?? null,
      imageUrl: post.imageUrl,
      videoUrl: post.videoUrl,
      views: post.insights.reduce((s, i) => s + i.views, 0),
      interactions: post.insights.reduce((s, i) => s + SocialService.interactions(i), 0),
    };
  }

  /** Publications les plus performantes — base du recyclage (« republier ce qui a marché »). */
  async topPosts(userId: string, limit = 5): Promise<TopPostDto[]> {
    const shop = await this.shopService.requireOwnedShop(userId);
    const posts = await this.measuredPosts(shop.id, new Date(Date.now() - 180 * 86_400_000));
    return posts
      .map((p) => SocialService.toTopPost(p))
      .filter((p) => p.interactions > 0 || p.views > 0)
      .sort((a, b) => b.interactions - a.interactions || b.views - a.views)
      .slice(0, limit);
  }

  /** Bilan d'un mois : volumes, détail par réseau, meilleures publications, évolution. */
  async monthlyReport(userId: string, month: string): Promise<MonthlyReportDto> {
    if (!/^\d{4}-\d{2}$/.test(month)) throw new BadRequestException('Mois attendu au format AAAA-MM.');
    const shop = await this.shopService.requireOwnedShop(userId);

    const [year, m] = month.split('-').map(Number);
    const start = new Date(year, m - 1, 1);
    const end = new Date(year, m, 1);
    const prevStart = new Date(year, m - 2, 1);

    const [posts, prevPosts] = await Promise.all([
      this.measuredPosts(shop.id, start, end),
      this.measuredPosts(shop.id, prevStart, start),
    ]);

    const totals = { views: 0, likes: 0, comments: 0, shares: 0 };
    const networks = new Map<string, { network: string; published: number; views: number; interactions: number }>();

    for (const post of posts) {
      for (const i of post.insights) {
        totals.views += i.views;
        totals.likes += i.likes;
        totals.comments += i.comments;
        totals.shares += i.shares;

        const row = networks.get(i.network) ?? { network: i.network, published: 0, views: 0, interactions: 0 };
        row.published++;
        row.views += i.views;
        row.interactions += SocialService.interactions(i);
        networks.set(i.network, row);
      }
    }

    const interactions = totals.likes + totals.comments + totals.shares;
    const prevInteractions = prevPosts.reduce(
      (s, p) => s + p.insights.reduce((n, i) => n + SocialService.interactions(i), 0),
      0,
    );

    return {
      month,
      published: posts.length,
      ...totals,
      byNetwork: [...networks.values()].sort((a, b) => b.interactions - a.interactions),
      topPosts: posts
        .map((p) => SocialService.toTopPost(p))
        .sort((a, b) => b.interactions - a.interactions)
        .slice(0, 5),
      interactionsChange:
        prevInteractions > 0 ? Math.round(((interactions - prevInteractions) / prevInteractions) * 100) : null,
    };
  }
}
