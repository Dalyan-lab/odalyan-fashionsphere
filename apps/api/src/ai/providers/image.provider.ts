import { Injectable, Logger } from '@nestjs/common';

export interface ImageResult {
  url: string; // URL distante ou data URI
  provider: 'openai' | 'mock';
}

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

  get enabled(): boolean {
    return Boolean(process.env.OPENAI_API_KEY);
  }

  async generate(prompt: string, hint = 'Femme'): Promise<ImageResult> {
    if (!this.enabled) return this.mock(hint);

    try {
      const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-image-1',
          prompt,
          n: 1,
          size: '1024x1024',
        }),
      });

      if (!res.ok) {
        this.logger.error(`OpenAI images a échoué (${res.status}) — repli sur mock`);
        return this.mock(hint);
      }

      const data = (await res.json()) as { data: { b64_json?: string; url?: string }[] };
      const item = data.data?.[0];
      if (item?.b64_json) {
        return { url: `data:image/png;base64,${item.b64_json}`, provider: 'openai' };
      }
      if (item?.url) return { url: item.url, provider: 'openai' };
      return this.mock(hint);
    } catch (err) {
      this.logger.error(`Erreur génération image: ${String(err)} — repli sur mock`);
      return this.mock(hint);
    }
  }

  /**
   * Génère une image à partir d'une image source (ex: avatar depuis une photo).
   * OpenAI : endpoint images/edits. Sans clé : repli mock.
   */
  async generateFromImage(prompt: string, sourceImageUrl: string, hint = 'Femme'): Promise<ImageResult> {
    if (!this.enabled) return this.mock(hint);

    try {
      const imgRes = await fetch(sourceImageUrl);
      if (!imgRes.ok) return this.generate(prompt, hint);
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
        this.logger.error(`OpenAI images/edits a échoué (${res.status}) — repli sur mock`);
        return this.mock(hint);
      }
      const data = (await res.json()) as { data: { b64_json?: string; url?: string }[] };
      const item = data.data?.[0];
      if (item?.b64_json) return { url: `data:image/png;base64,${item.b64_json}`, provider: 'openai' };
      if (item?.url) return { url: item.url, provider: 'openai' };
      return this.mock(hint);
    } catch (err) {
      this.logger.error(`Erreur avatar depuis photo: ${String(err)} — repli sur mock`);
      return this.mock(hint);
    }
  }

  private mock(hint: string): ImageResult {
    const pool = MOCK_POOL[hint] ?? MOCK_POOL.Femme!;
    const base = pool[Math.floor(Math.random() * pool.length)]!;
    const sig = Math.floor(Math.random() * 100000);
    return { url: `${base}&sig=${sig}`, provider: 'mock' };
  }
}
