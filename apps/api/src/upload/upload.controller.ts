import { randomBytes } from 'node:crypto';
import { extname } from 'node:path';
import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Logger,
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
import { normalizeVideoForSocial } from '../ai/providers/media.util';

/**
 * Plafond d'envoi. Généreux car les vidéos sont ré-encodées à l'arrivée :
 * le vendeur envoie son export tel quel, le serveur se charge de l'alléger.
 */
const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

/** Formate des octets en Mo/Go lisibles pour les messages. */
function human(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} Go`;
  return `${Math.round(bytes / 1024 / 1024)} Mo`;
}

@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadController {
  private readonly logger = new Logger(UploadController.name);

  constructor(
    private readonly storage: StorageService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_UPLOAD_BYTES },
      fileFilter: (_req, file, cb) => {
        const isImage = /^image\/(png|jpe?g|webp|gif)$/.test(file.mimetype);
        // Conteneurs vidéo courants : tous ré-encodés en MP4/H.264 à l'arrivée,
        // donc publiables même si le réseau ne sait pas lire le format d'origine.
        const isVideo =
          /^video\//.test(file.mimetype) || /\.(mp4|mov|webm|mkv|avi|wmv|flv|m4v|3gp|mpe?g)$/i.test(file.originalname);
        const isModel =
          /\.(glb|gltf)$/i.test(file.originalname) ||
          /^model\/(gltf-binary|gltf\+json)$/.test(file.mimetype) ||
          file.mimetype === 'application/octet-stream';
        if (!isImage && !isVideo && !isModel) {
          return cb(
            new BadRequestException('Fichier non autorisé (image, vidéo, ou modèle 3D .glb/.gltf)'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async upload(@UploadedFile() file: Express.Multer.File, @CurrentUser('id') userId: string) {
    if (!file) throw new BadRequestException('Aucun fichier reçu');

    /**
     * Vidéos : ré-encodage systématique en MP4/H.264/AAC. C'est ce qui rend
     * publiables les exports lourds ou aux formats exotiques (HEVC d'iPhone,
     * .avi, .mkv…) que TikTok et Instagram refusent. Si ffmpeg est indisponible
     * (poste de développement), on garde le fichier d'origine plutôt que
     * d'empêcher l'envoi.
     */
    let buffer = file.buffer;
    let mimetype = file.mimetype;
    let originalName = file.originalname;

    if (this.isVideo(file)) {
      try {
        const before = buffer.length;
        buffer = await normalizeVideoForSocial(file.buffer, file.originalname);
        mimetype = 'video/mp4';
        originalName = `${originalName.replace(/\.[^.]+$/, '')}.mp4`;
        this.logger.log(
          `Vidéo convertie : ${human(before)} → ${human(buffer.length)} (${file.originalname})`,
        );
      } catch (err) {
        this.logger.warn(`Conversion vidéo impossible, fichier conservé tel quel : ${String(err)}`);
      }
    }

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
        // Taille réellement stockée : après conversion pour les vidéos.
        if (used + buffer.length > limit) {
          throw new ForbiddenException(
            `Quota de stockage atteint (${human(used)} / ${human(limit)} — plan ${plan}). ` +
              `Passez à une offre supérieure pour plus d'espace.`,
          );
        }
      }
    }

    const filename = `${Date.now()}-${randomBytes(6).toString('hex')}${extname(originalName)}`;
    const url = await this.storage.save(buffer, filename, mimetype, keyPrefix);
    return { url, filename, size: buffer.length, storage: this.storage.enabled ? 's3' : 'local' };
  }

  /** Vrai pour tout conteneur vidéo, y compris ceux mal typés par le navigateur. */
  private isVideo(file: Express.Multer.File): boolean {
    return (
      /^video\//.test(file.mimetype) ||
      /\.(mp4|mov|webm|mkv|avi|wmv|flv|m4v|3gp|mpe?g)$/i.test(file.originalname)
    );
  }
}
