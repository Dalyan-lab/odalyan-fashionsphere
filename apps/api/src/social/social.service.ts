import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  SocialNetwork,
  type ScheduledPostDto,
  type SchedulePostInput,
  type SocialConnectionInfo,
} from '@odalyan/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ShopService } from '../shop/shop.service';

const NETWORKS = Object.values(SocialNetwork) as string[];

@Injectable()
export class SocialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shopService: ShopService,
  ) {}

  /** Variable d'env de credentials OAuth attendue pour un réseau (réel). */
  private envKey(network: string): string {
    return `${network.toUpperCase().replace(/[^A-Z]/g, '')}_OAUTH_CLIENT_ID`;
  }

  /** État de connexion des 6 réseaux pour la boutique. */
  async listConnections(userId: string): Promise<SocialConnectionInfo[]> {
    const shop = await this.shopService.requireOwnedShop(userId);
    const rows = await this.prisma.socialConnection.findMany({ where: { shopId: shop.id } });
    return NETWORKS.map((network) => {
      const row = rows.find((r) => r.network === network);
      return { network, connected: row?.connected ?? false, accountName: row?.accountName ?? null };
    });
  }

  /**
   * Connecte un réseau. Mode simulé : marque connecté avec un compte fictif.
   * Réel : nécessiterait le flux OAuth (client id/secret de l'app par plateforme).
   */
  async connect(userId: string, network: string) {
    if (!NETWORKS.includes(network)) throw new BadRequestException('Réseau inconnu');
    const shop = await this.shopService.requireOwnedShop(userId);
    const real = Boolean(process.env[this.envKey(network)]);
    const accountName = real ? `@${shop.slug}` : `@${shop.slug}_${network.toLowerCase()} (simulé)`;

    return this.prisma.socialConnection.upsert({
      where: { shopId_network: { shopId: shop.id, network } },
      update: { connected: true, accountName, connectedAt: new Date() },
      create: { shopId: shop.id, network, connected: true, accountName, connectedAt: new Date() },
    });
  }

  async disconnect(userId: string, network: string) {
    const shop = await this.shopService.requireOwnedShop(userId);
    await this.prisma.socialConnection
      .updateMany({
        where: { shopId: shop.id, network },
        data: { connected: false, accountName: null, accessToken: null },
      })
      .catch(() => undefined);
    return { disconnected: true };
  }

  /** Programme une publication (ou immédiate si pas de date). */
  async schedule(userId: string, input: SchedulePostInput) {
    const shop = await this.shopService.requireOwnedShop(userId);

    // Avertit si aucun réseau ciblé n'est connecté
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
        networks: input.networks,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : new Date(),
        status: 'SCHEDULED',
      },
    });

    // Publie immédiatement si la date est déjà passée/maintenant
    await this.processDue(shop.id);
    return this.prisma.scheduledPost.findUnique({ where: { id: post.id } });
  }

  /** Liste les publications (traite d'abord celles arrivées à échéance). */
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
      networks: p.networks,
      scheduledAt: p.scheduledAt.toISOString(),
      status: p.status,
      publishedAt: p.publishedAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
    }));
  }

  async cancel(userId: string, id: string) {
    const shop = await this.shopService.requireOwnedShop(userId);
    const post = await this.prisma.scheduledPost.findUnique({ where: { id } });
    if (!post || post.shopId !== shop.id) throw new NotFoundException('Publication introuvable');
    if (post.status !== 'SCHEDULED') throw new BadRequestException('Publication déjà traitée');
    return this.prisma.scheduledPost.update({ where: { id }, data: { status: 'CANCELLED' } });
  }

  /**
   * Publie les posts arrivés à échéance. Mode simulé : marque PUBLISHED.
   * Réel : appellerait l'API de chaque réseau connecté (Graph API, etc.).
   */
  private async processDue(shopId: string) {
    const due = await this.prisma.scheduledPost.findMany({
      where: { shopId, status: 'SCHEDULED', scheduledAt: { lte: new Date() } },
    });
    for (const post of due) {
      await this.prisma.scheduledPost.update({
        where: { id: post.id },
        data: { status: 'PUBLISHED', publishedAt: new Date() },
      });
    }
  }
}
