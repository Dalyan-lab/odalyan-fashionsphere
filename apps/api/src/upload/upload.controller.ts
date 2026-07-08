import { randomBytes } from 'node:crypto';
import { extname } from 'node:path';
import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Express } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StorageService } from '../storage/storage.service';

@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly storage: StorageService) {}

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
  async upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Aucun fichier reçu');
    const filename = `${Date.now()}-${randomBytes(6).toString('hex')}${extname(file.originalname)}`;
    const url = await this.storage.save(file.buffer, filename, file.mimetype);
    return { url, filename, size: file.size, storage: this.storage.enabled ? 's3' : 'local' };
  }
}
