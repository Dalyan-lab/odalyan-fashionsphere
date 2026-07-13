import { randomBytes } from 'node:crypto';
import { extname } from 'node:path';
import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Express } from 'express';
import { PLAN_STORAGE_LIMITS, SubscriptionPlan } from '@odalyan/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { StorageService } from '../storage/storage.service';
import { PrismaService } from '../prisma/prisma.service';

/** Formate des octets en Mo/Go lisibles pour les messages. */
function human(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} Go`;
  return `${Math.round(bytes / 1024 / 1024)} Mo`;
}

@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(
    private readonly storage: StorageService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 25 * 1024 * 1024 }, // 25 Mo (modèles 3D)
      fileFilter: (_req, file, cb) => {
        const isImage = /^image\/(png|jpe?g|webp|gif)$/.test(file.mimetype);
        const isModel =
          /\.(glb|gltf)$/i.test(file.originalname) ||
          /^model\/(gltf-binary|gltf\+json)$/.test(file.mimetype) ||
          file.mimetype === 'application/octet-stream';
        if (!isImage && !isModel) {
          return cb(new BadRequestException('Fichier non autorisé (image ou modèle .glb/.gltf)'), false);
        }
        cb(null, true);
      },
    }),
  )
  async upload(@UploadedFile() file: Express.Multer.File, @CurrentUser('id') userId: string) {
    if (!file) throw new BadRequestException('Aucun fichier reçu');

    // Chaque boutique a son dossier dans le bucket central (multi-tenant).
    const shop = await this.prisma.shop.findUnique({
      where: { ownerId: userId },
      include: { subscription: true },
    });
    const keyPrefix = shop ? `shops/${shop.id}` : `users/${userId}`;

    // Quota de stockage par plan (uniquement quand le stockage objet est actif)
    if (shop && this.storage.enabled) {
      const plan = (shop.subscription?.plan ?? SubscriptionPlan.STARTER) as SubscriptionPlan;
      const limit = PLAN_STORAGE_LIMITS[plan] ?? PLAN_STORAGE_LIMITS[SubscriptionPlan.STARTER];
      if (Number.isFinite(limit)) {
        const used = await this.storage.usedBytes(keyPrefix);
        if (used + file.size > limit) {
          throw new ForbiddenException(
            `Quota de stockage atteint (${human(used)} / ${human(limit)} — plan ${plan}). ` +
              `Passez à une offre supérieure pour plus d'espace.`,
          );
        }
      }
    }

    const filename = `${Date.now()}-${randomBytes(6).toString('hex')}${extname(file.originalname)}`;
    const url = await this.storage.save(file.buffer, filename, file.mimetype, keyPrefix);
    return { url, filename, size: file.size, storage: this.storage.enabled ? 's3' : 'local' };
  }
}
