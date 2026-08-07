import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { StorageService } from '../../storage/storage.service';

/** Modèle TTS Replicate (voix off), surchargeable par variable d'env. */
const REPLICATE_TTS_MODEL = () => process.env.REPLICATE_TTS_MODEL || 'minimax/speech-02-turbo';
/** Modèle musique Replicate (fond sonore libre de droits), surchargeable. */
const REPLICATE_MUSIC_MODEL = () => process.env.REPLICATE_MUSIC_MODEL || 'meta/musicgen';

/** Nom de langue attendu par le modèle (language_boost). */
const LANG_NAME: Record<string, string> = {
  fr: 'French',
  en: 'English',
  ar: 'Arabic',
  es: 'Spanish',
};

export interface TtsResult {
  url: string | null;
  error: string | null;
}

/**
 * Synthèse vocale (voix off publicitaire) via Replicate. Renvoie une URL audio
 * permanente (R2), ou une erreur exploitable. Une seule clé Replicate suffit.
 */
@Injectable()
export class AudioProvider {
  private readonly logger = new Logger(AudioProvider.name);
  private versionCache = new Map<string, string>();

  constructor(private readonly storage: StorageService) {}

  get enabled(): boolean {
    return Boolean(process.env.REPLICATE_API_TOKEN);
  }

  /** Génère une voix off à partir d'un texte. `voice` et `language` optionnels. */
  async tts(text: string, language = 'fr', voice?: string): Promise<TtsResult> {
    if (!this.enabled) return { url: null, error: 'Replicate non configuré' };
    const input: Record<string, unknown> = {
      text,
      voice_id: voice || 'Friendly_Person',
      language_boost: LANG_NAME[language] ?? 'Automatic',
      speed: 1,
      sample_rate: 32000,
      bitrate: 128000,
    };
    return this.run(REPLICATE_TTS_MODEL(), input);
  }

  /** Génère une musique de fond libre de droits (MusicGen) à partir d'une ambiance. */
  async music(ambiance: string, durationSec = 10): Promise<TtsResult> {
    if (!this.enabled) return { url: null, error: 'Replicate non configuré' };
    return this.run(REPLICATE_MUSIC_MODEL(), {
      prompt: ambiance,
      duration: Math.min(Math.max(durationSec, 5), 30),
      output_format: 'mp3',
      normalization_strategy: 'peak',
    });
  }

  // ---------------------------------------------------------------- Replicate

  private async resolveLatestVersion(model: string): Promise<string | null> {
    const cached = this.versionCache.get(model);
    if (cached) return cached;
    try {
      const res = await fetch(`https://api.replicate.com/v1/models/${model}`, {
        headers: { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}` },
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { latest_version?: { id?: string } };
      const id = data.latest_version?.id ?? null;
      if (id) this.versionCache.set(model, id);
      return id;
    } catch {
      return null;
    }
  }

  private async run(model: string, input: Record<string, unknown>): Promise<TtsResult> {
    try {
      // Modèle communautaire → /v1/predictions + version ; officiel (minimax) → aussi ok via version.
      const version = await this.resolveLatestVersion(model);
      const endpoint = version
        ? 'https://api.replicate.com/v1/predictions'
        : `https://api.replicate.com/v1/models/${model}/predictions`;
      const payload = version ? { version, input } : { input };

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
        this.logger.error(`TTS ${model} a échoué (${res?.status}): ${body}`);
        return { url: null, error: `HTTP ${res?.status}: ${body}` };
      }
      let data = (await res.json()) as {
        id?: string;
        status?: string;
        output?: unknown;
        error?: string | null;
        urls?: { get?: string };
      };
      const pollUrl = data.urls?.get ?? (data.id ? `https://api.replicate.com/v1/predictions/${data.id}` : null);
      const deadline = Date.now() + 120_000;
      while ((data.status === 'starting' || data.status === 'processing') && pollUrl && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 2000));
        const poll = await fetch(pollUrl, {
          headers: { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}` },
        });
        if (!poll.ok) break;
        data = (await poll.json()) as typeof data;
      }
      if (data.error || data.status === 'failed' || data.status === 'canceled') {
        return { url: null, error: String(data.error ?? data.status) };
      }
      // La sortie peut être une string URL, un tableau, ou un objet { audio: url }.
      const out = data.output as unknown;
      let audioUrl: string | null = null;
      if (typeof out === 'string') audioUrl = out;
      else if (Array.isArray(out) && typeof out[0] === 'string') audioUrl = out[0];
      else if (out && typeof out === 'object') {
        const o = out as Record<string, unknown>;
        if (typeof o.audio === 'string') audioUrl = o.audio;
        else if (typeof o.audio_file === 'string') audioUrl = o.audio_file;
      }
      if (!audioUrl) return { url: null, error: `sortie audio inattendue (status=${data.status})` };
      return { url: await this.persist(audioUrl), error: null };
    } catch (err) {
      this.logger.error(`Erreur TTS ${model}: ${String(err)}`);
      return { url: null, error: String(err) };
    }
  }

  private async persist(url: string): Promise<string> {
    if (!this.storage.enabled) return url;
    try {
      const res = await fetch(url);
      if (!res.ok) return url;
      const ct = res.headers.get('content-type') ?? 'audio/mpeg';
      const ext = ct.includes('wav') ? 'wav' : ct.includes('mp4') || ct.includes('m4a') ? 'm4a' : 'mp3';
      const buffer = Buffer.from(await res.arrayBuffer());
      return await this.storage.save(buffer, `${randomUUID()}.${ext}`, ct, 'ai');
    } catch {
      return url;
    }
  }
}
