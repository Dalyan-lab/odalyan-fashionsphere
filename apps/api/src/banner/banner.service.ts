import { Injectable, NotFoundException } from '@nestjs/common';
import type { CreateBannerInput, UpdateBannerInput } from '@odalyan/shared';
import { PrismaService } from '../prisma/prisma.service';

/** Chaîne vide = « retirer la valeur », comme dans les autres formulaires. */
function videEnNull<T extends Record<string, unknown>>(input: T): T {
  const sortie: Record<string, unknown> = { ...input };
  for (const [cle, valeur] of Object.entries(sortie)) {
    if (valeur === '') sortie[cle] = null;
    // Les dates arrivent en ISO depuis le formulaire ; Prisma attend des Date.
    else if ((cle === 'startsAt' || cle === 'endsAt') && typeof valeur === 'string') {
      sortie[cle] = new Date(valeur);
    }
  }
  return sortie as T;
}

@Injectable()
export class BannerService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Le bandeau à afficher maintenant, ou `null`.
   *
   * La fenêtre est évaluée **à la lecture**, pas par une tâche planifiée : une
   * campagne s'ouvre et se ferme donc à la seconde près, sans qu'aucun rouage
   * n'ait à tourner entre-temps. Deux bornes nulles valent « permanent », ce
   * qui permet de préparer une saison à l'avance en la laissant inactive.
   */
  async current() {
    const maintenant = new Date();
    const candidats = await this.prisma.marketplaceBanner.findMany({
      where: {
        active: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: maintenant } }] },
          { OR: [{ endsAt: null }, { endsAt: { gt: maintenant } }] },
        ],
      },
      // À priorité égale, le plus récemment créé gagne : c'est celui qu'on
      // vient de mettre en place.
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      take: 1,
    });
    return candidats[0] ?? null;
  }

  /** Tous les bandeaux, programmés et passés compris, pour l'administration. */
  async list() {
    return this.prisma.marketplaceBanner.findMany({
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async create(input: CreateBannerInput) {
    return this.prisma.marketplaceBanner.create({ data: videEnNull(input) as never });
  }

  async update(id: string, input: UpdateBannerInput) {
    const existant = await this.prisma.marketplaceBanner.findUnique({ where: { id } });
    if (!existant) throw new NotFoundException('Bandeau introuvable');
    return this.prisma.marketplaceBanner.update({ where: { id }, data: videEnNull(input) as never });
  }

  async remove(id: string) {
    const existant = await this.prisma.marketplaceBanner.findUnique({ where: { id } });
    if (!existant) throw new NotFoundException('Bandeau introuvable');
    await this.prisma.marketplaceBanner.delete({ where: { id } });
    return { deleted: true };
  }
}
