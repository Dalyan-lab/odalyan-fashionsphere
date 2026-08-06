import { Controller, Get, Query } from '@nestjs/common';
import { ImageProvider } from './providers/image.provider';

/**
 * TEMPORAIRE — diagnostic Replicate public (protégé par un mot-clé), le temps de
 * comprendre pourquoi la génération retombe en simulé. À SUPPRIMER après usage.
 * Ne renvoie aucun secret (jamais le token).
 */
@Controller('diag-replicate')
export class DiagTempController {
  constructor(private readonly imageProvider: ImageProvider) {}

  @Get()
  async run(@Query('k') k: string) {
    if (k !== 'odl-diag-2026') return { error: 'forbidden' };
    return this.imageProvider.diagnose();
  }
}
