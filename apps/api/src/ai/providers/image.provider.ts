import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { StorageService } from '../../storage/storage.service';

export interface ImageResult {
  url: string; // URL R2 permanente (ou distante/data URI en repli)
  provider: 'replicate' | 'openai' | 'mock';
}

/** Modèles Replicate (surchageables par variable d'env). */
const REPLICATE_IMAGE_MODEL = () => process.env.REPLICATE_IMAGE_MODEL || 'black-forest-labs/flux-schnell';
const REPLICATE_EDIT_MODEL = () => process.env.REPLICATE_EDIT_MODEL || 'black-forest-labs/flux-kontext-pro';

/** Pool d'images de démonstration (mode mock) par type de mannequin. */
const MOCK_POOL: Record<string, string[]> = {
  Femme: [
    'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=800',
    'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800',
  ],
  Homme: [
    'https://images.unsplash.com/photo-1516257984-b1b4d707412e?w=800',
    'https://images.unsplash.com/photo-1488161628813-04466f872be2?w=800',
  ],
  Enfant: ['https://images.unsplash.com/photo-1518831959646-742c3a14ebf7?w=800'],
  'Grande taille': ['https://images.unsplash.com/photo-1581044777550-4cfa60707c03?w=800'],
  Sportif: ['https://images.unsplash.com/photo-1483721310020-03333e577078?w=800'],
  Luxe: ['https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800'],
};

@Injectable()
export class ImageProvider {
  private readonly logger = new Logger(ImageProvider.name);

  constructor(private readonly storage: StorageService) {}

  get replicateEnabled(): boolean {
    return Boolean(process.env.REPLICATE_API_TOKEN);
  }
  get openaiEnabled(): boolean {
    return Boolean(process.env.OPENAI_API_KEY);
  }
  /** Vrai si au moins un vrai fournisseur d'images est branché. */
  get enabled(): boolean {
    return this.replicateEnabled || this.openaiEnabled;
  }
  /** Fournisseur actif (pour l'affichage du statut). */
  get providerName(): ImageResult['provider'] {
    return this.replicateEnabled ? 'replicate' : this.openaiEnabled ? 'openai' : 'mock';
  }

  /** Texte → image. Replicate (flux) en priorité, puis OpenAI, puis mock. */
  async generate(prompt: string, hint = 'Femme'): Promise<ImageResult> {
    if (this.replicateEnabled) {
      const url = await this.replicateRun(REPLICATE_IMAGE_MODEL(), {
        prompt,
        aspect_ratio: '3:4',
        output_format: 'webp',
        output_quality: 90,
        num_outputs: 1,
      });
      if (url) return { url, provider: 'replicate' };
    }
    if (this.openaiEnabled) {
      const r = await this.openaiGenerate(prompt);
      if (r) return r;
    }
    return this.mock(hint);
  }

  /** Image → image (avatar depuis photo, essayage sur une personne). */
  async generateFromImage(prompt: string, sourceImageUrl: string, hint = 'Femme'): Promise<ImageResult> {
    if (this.replicateEnabled) {
      const url = await this.replicateRun(REPLICATE_EDIT_MODEL(), {
        prompt,
        input_image: sourceImageUrl,
        output_format: 'webp',
        aspect_ratio: 'match_input_image',
      });
      if (url) return { url, provider: 'replicate' };
    }
    if (this.openaiEnabled) {
      const r = await this.openaiEdit(prompt, sourceImageUrl, hint);
      if (r) return r;
    }
    return this.mock(hint);
  }

  // ---------------------------------------------------------------- Replicate

  /**
   * Exécute un modèle Replicate de façon synchrone (`Prefer: wait`, jusqu'à 60 s).
   * Récupère la 1ʳᵉ image de sortie et la copie sur R2 (les URLs Replicate expirent).
   * Renvoie l'URL permanente, ou null pour laisser le repli agir.
   */
  private async replicateRun(model: string, input: Record<string, unknown>): Promise<string | null> {
    try {
      const res = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`,
          'Content-Type': 'application/json',
          Prefer: 'wait',
        },
        body: JSON.stringify({ input }),
      });
      if (!res.ok) {
        this.logger.error(`Replicate ${model} a échoué (${res.status}): ${await res.text().catch(() => '')}`);
        return null;
      }
      const data = (await res.json()) as { status?: string; output?: unknown; error?: string | null };
      if (data.error || data.status === 'failed' || data.status === 'canceled') {
        this.logger.error(`Replicate ${model}: ${data.error ?? data.status}`);
        return null;
      }
      const out = Array.isArray(data.output) ? data.output[0] : data.output;
      if (typeof out !== 'string') {
        this.logger.warn(`Replicate ${model}: sortie inattendue (status=${data.status}) — repli`);
        return null;
      }
      return await this.persistFromUrl(out);
    } catch (err) {
      this.logger.error(`Erreur Replicate ${model}: ${String(err)} — repli`);
      return null;
    }
  }

  // ------------------------------------------------------------------- OpenAI

  private async openaiGenerate(prompt: string): Promise<ImageResult | null> {
    try {
      const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({ model: 'gpt-image-1', prompt, n: 1, size: '1024x1024' }),
      });
      if (!res.ok) {
        this.logger.error(`OpenAI images a échoué (${res.status}) — repli`);
        return null;
      }
      const data = (await res.json()) as { data: { b64_json?: string; url?: string }[] };
      const item = data.data?.[0];
      if (item?.b64_json) {
        const buffer = Buffer.from(item.b64_json, 'base64');
        const url = this.storage.enabled
          ? await this.storage.save(buffer, `${randomUUID()}.png`, 'image/png', 'ai')
          : `data:image/png;base64,${item.b64_json}`;
        return { url, provider: 'openai' };
      }
      if (item?.url) return { url: await this.persistFromUrl(item.url), provider: 'openai' };
      return null;
    } catch (err) {
      this.logger.error(`Erreur génération OpenAI: ${String(err)} — repli`);
      return null;
    }
  }

  private async openaiEdit(prompt: string, sourceImageUrl: string, hint: string): Promise<ImageResult | null> {
    try {
      const imgRes = await fetch(sourceImageUrl);
      if (!imgRes.ok) return this.openaiGenerate(prompt);
      const blob = await imgRes.blob();

      const fd = new FormData();
      fd.append('model', 'gpt-image-1');
      fd.append('prompt', prompt);
      fd.append('size', '1024x1024');
      fd.append('image', blob, 'source.png');

      const res = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: fd,
      });
      if (!res.ok) {
        this.logger.error(`OpenAI images/edits a échoué (${res.status}) — repli`);
        return null;
      }
      const data = (await res.json()) as { data: { b64_json?: string; url?: string }[] };
      const item = data.data?.[0];
      if (item?.b64_json) {
        const buffer = Buffer.from(item.b64_json, 'base64');
        const url = this.storage.enabled
          ? await this.storage.save(buffer, `${randomUUID()}.png`, 'image/png', 'ai')
          : `data:image/png;base64,${item.b64_json}`;
        return { url, provider: 'openai' };
      }
      if (item?.url) return { url: await this.persistFromUrl(item.url), provider: 'openai' };
      void hint;
      return null;
    } catch (err) {
      this.logger.error(`Erreur avatar OpenAI depuis photo: ${String(err)} — repli`);
      return null;
    }
  }

  // ------------------------------------------------------------------ Utilitaires

  /** Télécharge une image distante et la stocke sur R2 (URL permanente). */
  private async persistFromUrl(url: string): Promise<string> {
    if (!this.storage.enabled) return url; // dev : on garde l'URL distante
    try {
      const res = await fetch(url);
      if (!res.ok) return url;
      const contentType = res.headers.get('content-type') ?? 'image/webp';
      const buffer = Buffer.from(await res.arrayBuffer());
      const ext = contentType.includes('png')
        ? 'png'
        : contentType.includes('jpeg') || contentType.includes('jpg')
          ? 'jpg'
          : 'webp';
      return await this.storage.save(buffer, `${randomUUID()}.${ext}`, contentType, 'ai');
    } catch (err) {
      this.logger.error(`Persistance R2 de l'image échouée: ${String(err)} — URL distante conservée`);
      return url;
    }
  }

  private mock(hint: string): ImageResult {
    const pool = MOCK_POOL[hint] ?? MOCK_POOL.Femme!;
    const base = pool[Math.floor(Math.random() * pool.length)]!;
    const sig = Math.floor(Math.random() * 100000);
    return { url: `${base}&sig=${sig}`, provider: 'mock' };
  }
}
