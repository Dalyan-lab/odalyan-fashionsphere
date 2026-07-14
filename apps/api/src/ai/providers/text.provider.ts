import { Injectable, Logger } from '@nestjs/common';
import type { AdCopyResult, GenerateAdCopyInput } from '@odalyan/shared';

export interface ViralScriptResult {
  hook: string;
  problem: string;
  solution: string;
  cta: string;
}

@Injectable()
export class TextProvider {
  private readonly logger = new Logger(TextProvider.name);

  get enabled(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  }

  async generateAdCopy(input: GenerateAdCopyInput): Promise<{ result: AdCopyResult; provider: 'anthropic' | 'mock' }> {
    if (!this.enabled) return { result: this.mock(input), provider: 'mock' };

    try {
      const prompt = `Tu es un expert en marketing mode. Génère un contenu publicitaire en français pour ce produit.
Produit : "${input.productName}"${input.category ? ` (catégorie ${input.category})` : ''}
Ton : ${input.tone}

Réponds UNIQUEMENT avec un objet JSON valide de cette forme exacte :
{"description": "2-3 phrases vendeuses", "slogans": ["3 slogans courts"], "hashtags": ["8 hashtags sans #"], "cta": "un appel à l'action"}`;

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!res.ok) {
        this.logger.error(`Anthropic a échoué (${res.status}) — repli sur mock`);
        return { result: this.mock(input), provider: 'mock' };
      }

      const data = (await res.json()) as { content: { text: string }[] };
      const text = data.content?.[0]?.text ?? '';
      const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
      const parsed = JSON.parse(json) as AdCopyResult;
      return { result: parsed, provider: 'anthropic' };
    } catch (err) {
      this.logger.error(`Erreur génération texte: ${String(err)} — repli sur mock`);
      return { result: this.mock(input), provider: 'mock' };
    }
  }

  /** Génère un court script parlé pour une vidéo présentateur/influenceur. */
  async generateScript(productName: string, tone: string, language = 'fr'): Promise<{ script: string; provider: 'anthropic' | 'mock' }> {
    if (!this.enabled) return { script: this.mockScript(productName, tone), provider: 'mock' };
    try {
      const prompt = `Écris un court script (40-70 mots, langue: ${language}) pour une vidéo où un influenceur présente ce produit de mode face caméra. Ton: ${tone}. Produit: "${productName}". Réponds uniquement par le texte parlé, sans didascalies.`;
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 400,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      if (!res.ok) return { script: this.mockScript(productName, tone), provider: 'mock' };
      const data = (await res.json()) as { content: { text: string }[] };
      const script = data.content?.[0]?.text?.trim();
      return script ? { script, provider: 'anthropic' } : { script: this.mockScript(productName, tone), provider: 'mock' };
    } catch {
      return { script: this.mockScript(productName, tone), provider: 'mock' };
    }
  }

  /** Script vidéo viral (Hook/Problème/Solution/CTA) pour ViralAmazone — TikTok/Reels/Shorts. */
  async generateViralScript(input: {
    productName: string;
    category?: string | null;
    price?: number | null;
    currency?: string | null;
    platform: string;
  }): Promise<{ result: ViralScriptResult; provider: 'anthropic' | 'mock' }> {
    if (!this.enabled) return { result: this.mockViralScript(input), provider: 'mock' };
    try {
      const priceInfo = input.price != null ? ` (environ ${input.price} ${input.currency ?? ''})` : '';
      const prompt = `Tu es un copywriter expert en vidéos virales ${input.platform} (TikTok/Reels/Shorts), spécialisé dans le marketing d'affiliation Amazon pour un public ivoirien/francophone.
Produit : "${input.productName}"${input.category ? `, catégorie ${input.category}` : ''}${priceInfo}.

Écris un script de vente vidéo en français en 4 parties strictes, percutant et naturel à l'oral :
1. hook (0-3s) : phrase d'accroche visuelle et verbale ultra-captivante qui arrête le scroll.
2. problem (3-15s) : une douleur/frustration quotidienne concrète que ce produit résout.
3. solution (15-40s) : présentation du produit et de ses bénéfices clés, ton enthousiaste et crédible.
4. cta (40-50s) : appel à l'action fort pour cliquer sur le lien en description/bio et acheter maintenant.

Réponds UNIQUEMENT avec un objet JSON valide de cette forme exacte :
{"hook": "...", "problem": "...", "solution": "...", "cta": "..."}`;

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!res.ok) {
        this.logger.error(`Anthropic (script viral) a échoué (${res.status}) — repli sur mock`);
        return { result: this.mockViralScript(input), provider: 'mock' };
      }

      const data = (await res.json()) as { content: { text: string }[] };
      const text = data.content?.[0]?.text ?? '';
      const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
      const parsed = JSON.parse(json) as ViralScriptResult;
      return { result: parsed, provider: 'anthropic' };
    } catch (err) {
      this.logger.error(`Erreur génération script viral: ${String(err)} — repli sur mock`);
      return { result: this.mockViralScript(input), provider: 'mock' };
    }
  }

  private mockViralScript(input: { productName: string; platform: string }): ViralScriptResult {
    const n = input.productName;
    return {
      hook: `Arrête de scroller si tu galères encore avec ça... 👀`,
      problem: `On connaît tous ce problème du quotidien qui nous gâche la vie — et personne n'en parle assez.`,
      solution: `${n} change tout : simple, efficace, et ça se voit dès la première utilisation. Les avis ne mentent pas.`,
      cta: `Le lien est juste en dessous 👇 Fonce avant la rupture de stock !`,
    };
  }

  private mockScript(productName: string, tone: string): string {
    return `Salut à tous ! Aujourd'hui je vous présente ${productName} — une pièce ${tone.toLowerCase()} absolument incontournable. La coupe est parfaite, le confort au rendez-vous, et le style fait toute la différence. Croyez-moi, vous allez l'adorer. Disponible dès maintenant dans la boutique — foncez avant la rupture !`;
  }

  private mock(input: GenerateAdCopyInput): AdCopyResult {
    const n = input.productName;
    return {
      description: `Découvrez ${n}, une pièce ${input.tone.toLowerCase()} qui sublime votre allure. Confort, élégance et caractère réunis pour faire de chaque sortie un moment remarqué.`,
      slogans: [
        `${n} — l’élégance sans compromis`,
        `Osez ${n}.`,
        `Votre style, sublimé par ${n}`,
      ],
      hashtags: ['mode', 'fashion', 'style', 'ootd', 'tendance', 'luxe', 'shopping', 'odalyan'],
      cta: 'Commandez maintenant et brillez dès aujourd’hui !',
    };
  }
}
