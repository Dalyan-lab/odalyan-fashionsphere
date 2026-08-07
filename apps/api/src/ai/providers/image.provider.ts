import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { StorageService } from '../../storage/storage.service';

export interface ImageResult {
  url: string; // URL R2 permanente (ou distante/data URI en repli)
  provider: 'replicate' | 'openai' | 'mock';
  /** Renseigné quand le vrai fournisseur a échoué (diagnostic, ex. essayage). */
  error?: string;
}

/** Modèles Replicate (surchageables par variable d'env). */
const REPLICATE_IMAGE_MODEL = () => process.env.REPLICATE_IMAGE_MODEL || 'black-forest-labs/flux-schnell';
const REPLICATE_EDIT_MODEL = () => process.env.REPLICATE_EDIT_MODEL || 'black-forest-labs/flux-kontext-pro';
/** Essayage virtuel 2-images (personne + vêtement) : fidélité maximale du produit. */
const REPLICATE_TRYON_MODEL = () => process.env.REPLICATE_TRYON_MODEL || 'cuuupid/idm-vton';

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
      // PNG (pas webp) : les images servent de base à idm-vton / flux-kontext, qui refusent le webp.
      const { url, error } = await this.replicateRun(REPLICATE_IMAGE_MODEL(), {
        prompt,
        aspect_ratio: '3:4',
        output_format: 'png',
        output_quality: 90,
        num_outputs: 1,
      });
      if (url) return { url, provider: 'replicate' };
      if (this.openaiEnabled) {
        const r = await this.openaiGenerate(prompt);
        if (r) return r;
      }
      return { ...this.mock(hint), error: error ?? undefined };
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
      const { url, error } = await this.replicateRun(REPLICATE_EDIT_MODEL(), {
        prompt,
        input_image: sourceImageUrl,
        // flux-kontext-pro n'accepte que jpg/png (pas webp) — sinon 422.
        output_format: 'png',
        aspect_ratio: 'match_input_image',
      });
      if (url) return { url, provider: 'replicate' };
      if (this.openaiEnabled) {
        const r = await this.openaiEdit(prompt, sourceImageUrl, hint);
        if (r) return r;
      }
      return { ...this.mock(hint), error: error ?? undefined };
    }
    if (this.openaiEnabled) {
      const r = await this.openaiEdit(prompt, sourceImageUrl, hint);
      if (r) return r;
    }
    return this.mock(hint);
  }

  /**
   * Essayage virtuel 2-images : compose le VRAI vêtement sur la VRAIE personne
   * (avatar). Modèle idm-vton (human_img + garm_img). Fidélité maximale du produit.
   */
  async virtualTryOn(
    humanUrl: string,
    garmentUrl: string,
    description: string,
    category = 'upper_body',
  ): Promise<ImageResult> {
    if (this.replicateEnabled) {
      // idm-vton est un modèle COMMUNAUTAIRE → appel via /v1/predictions + hash de version
      // (l'endpoint models/{owner}/{name}/predictions ne marche que pour les modèles officiels → 404).
      const { url, error } = await this.replicateRun(
        REPLICATE_TRYON_MODEL(),
        { human_img: humanUrl, garm_img: garmentUrl, garment_des: description, category },
        { versioned: true },
      );
      if (url) return { url, provider: 'replicate' };
      return { ...this.mock('Femme'), error: error ?? undefined };
    }
    return this.mock('Femme');
  }

  // ---------------------------------------------------------------- Replicate

  /** Résout le hash de la dernière version d'un modèle communautaire (mis en cache). */
  private versionCache = new Map<string, string>();
  private async resolveLatestVersion(model: string): Promise<string | null> {
    const cached = this.versionCache.get(model);
    if (cached) return cached;
    try {
      const res = await fetch(`https://api.replicate.com/v1/models/${model}`, {
        headers: { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}` },
      });
      if (!res.ok) {
        this.logger.error(`Replicate resolveVersion ${model} (${res.status})`);
        return null;
      }
      const data = (await res.json()) as { latest_version?: { id?: string } };
      const id = data.latest_version?.id ?? null;
      if (id) this.versionCache.set(model, id);
      return id;
    } catch (err) {
      this.logger.error(`Replicate resolveVersion ${model}: ${String(err)}`);
      return null;
    }
  }

  /**
   * Exécute un modèle Replicate. On lance avec `Prefer: wait` (jusqu'à 60 s) puis,
   * si le modèle n'a pas fini (cas des modèles lourds comme idm-vton), on interroge
   * la prédiction (polling) jusqu'à ~150 s. Récupère la 1ʳᵉ image de sortie et la
   * copie sur R2 (les URLs Replicate expirent). Renvoie l'URL permanente, ou null.
   */
  private async replicateRun(
    model: string,
    input: Record<string, unknown>,
    opts: { versioned?: boolean } = {},
  ): Promise<{ url: string | null; error: string | null }> {
    try {
      // Endpoint : officiel = /models/{owner}/{name}/predictions ; communautaire = /predictions + version.
      let endpoint = `https://api.replicate.com/v1/models/${model}/predictions`;
      let payload: Record<string, unknown> = { input };
      if (opts.versioned) {
        const version = await this.resolveLatestVersion(model);
        if (!version) return { url: null, error: `version introuvable pour ${model}` };
        endpoint = 'https://api.replicate.com/v1/predictions';
        payload = { version, input };
      }

      // POST avec petit retry sur le 429 (débit Replicate).
      let res: Response | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`,
            'Content-Type': 'application/json',
            Prefer: 'wait',
          },
          body: JSON.stringify(payload),
        });
        if (res.status !== 429) break;
        await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
      }
      if (!res || !res.ok) {
        const body = res ? (await res.text().catch(() => '')).slice(0, 300) : 'no response';
        this.logger.error(`Replicate ${model} a échoué (${res?.status}): ${body}`);
        return { url: null, error: `HTTP ${res?.status}: ${body}` };
      }
      let data = (await res.json()) as {
        id?: string;
        status?: string;
        output?: unknown;
        error?: string | null;
        urls?: { get?: string };
      };

      // Modèle pas encore terminé (starting/processing) : on interroge jusqu'à ~150 s.
      const pollUrl = data.urls?.get ?? (data.id ? `https://api.replicate.com/v1/predictions/${data.id}` : null);
      const deadline = Date.now() + 150_000;
      while ((data.status === 'starting' || data.status === 'processing') && pollUrl && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 2500));
        const poll = await fetch(pollUrl, {
          headers: { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}` },
        });
        if (!poll.ok) break;
        data = (await poll.json()) as typeof data;
      }

      if (data.error || data.status === 'failed' || data.status === 'canceled') {
        const msg = String(data.error ?? data.status);
        this.logger.error(`Replicate ${model}: ${msg}`);
        return { url: null, error: msg };
      }
      const out = Array.isArray(data.output) ? data.output[0] : data.output;
      if (typeof out !== 'string') {
        this.logger.warn(`Replicate ${model}: sortie inattendue (status=${data.status}) — repli`);
        return { url: null, error: `sortie vide (status=${data.status})` };
      }
      return { url: await this.persistFromUrl(out), error: null };
    } catch (err) {
      this.logger.error(`Erreur Replicate ${model}: ${String(err)} — repli`);
      return { url: null, error: String(err) };
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

  // ------------------------------------------------------------------ Diagnostic

  /** Teste la clé Replicate + la facturation, et renvoie la vraie réponse (admin). */
  async diagnose(): Promise<Record<string, unknown>> {
    if (!this.replicateEnabled) return { replicate: 'AUCUN_TOKEN', hint: 'Ajoutez REPLICATE_API_TOKEN.' };
    const out: Record<string, unknown> = {
      imageModel: REPLICATE_IMAGE_MODEL(),
      editModel: REPLICATE_EDIT_MODEL(),
      storageR2: this.storage.enabled,
    };
    try {
      const acc = await fetch('https://api.replicate.com/v1/account', {
        headers: { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}` },
      });
      out.accountStatus = acc.status;
      out.account = (await acc.text().catch(() => '')).slice(0, 300);
    } catch (err) {
      out.accountError = String(err);
    }
    try {
      const res = await fetch(`https://api.replicate.com/v1/models/${REPLICATE_IMAGE_MODEL()}/predictions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`,
          'Content-Type': 'application/json',
          Prefer: 'wait',
        },
        body: JSON.stringify({ input: { prompt: 'a red apple on a white table', num_outputs: 1 } }),
      });
      out.predictionStatus = res.status;
      const body = (await res.json().catch(() => ({}))) as { status?: string; error?: string; output?: unknown };
      out.predictionState = body.status ?? null;
      out.predictionError = body.error ?? null;
      out.hasOutput = Boolean(body.output);
    } catch (err) {
      out.predictionError = String(err);
    }
    return out;
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
