import { Injectable, Logger } from '@nestjs/common';
import type {
  AdCopyResult,
  GenerateAdCopyInput,
  SocialCopyResult,
  SocialIdeasResult,
} from '@odalyan/shared';

/** Consignes rédactionnelles par réseau (longueur recommandée + style attendu). */
const NETWORK_GUIDANCE: Record<string, { limit: number; guidance: string }> = {
  Facebook: { limit: 1900, guidance: 'Ton conversationnel, phrases courtes, CTA clair, 1-2 emojis maximum.' },
  Instagram: { limit: 2200, guidance: 'Accrocheur, storytelling court, 3 à 5 hashtags pertinents en fin de texte.' },
  TikTok: { limit: 150, guidance: 'Très court et percutant, langage tendance, accroche dès les 3 premiers mots.' },
  YouTube: { limit: 5000, guidance: 'Première ligne = titre accrocheur, puis description claire avec mots-clés.' },
  Pinterest: { limit: 500, guidance: 'Descriptif et inspirant, orienté découverte, mots-clés naturels.' },
  X: { limit: 280, guidance: 'Concis et direct, une seule idée forte, 1-2 hashtags maximum.' },
};

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
Ton : ${input.tone}${input.details?.trim() ? `\nPrécisions du vendeur (à intégrer) : ${input.details.trim()}` : ''}

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

  /** Appel Anthropic mutualisé : renvoie le texte brut de la réponse, ou null en cas d'échec. */
  private async callClaude(prompt: string, maxTokens: number): Promise<string | null> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) {
      this.logger.error(`Anthropic a échoué (${res.status})`);
      return null;
    }
    const data = (await res.json()) as { content: { text: string }[] };
    return data.content?.[0]?.text ?? null;
  }

  /** Extrait l'objet JSON d'une réponse texte (tolère du texte autour et les balises markdown). */
  private static extractJson<T>(text: string): T {
    const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
    return JSON.parse(json) as T;
  }

  /**
   * Rédige une publication prête à poster, adaptée à chaque réseau demandé
   * (limite de caractères et style propres à chacun). Pilotage social.
   */
  async generateSocialCopy(input: {
    brief: string;
    tone: string;
    postType: string;
    networks: string[];
    shopName: string;
    shopDescription?: string | null;
  }): Promise<SocialCopyResult> {
    if (!this.enabled) return { texts: this.mockSocialCopy(input), provider: 'mock' };
    try {
      const specs = input.networks
        .map((n) => {
          const g = NETWORK_GUIDANCE[n] ?? { limit: 1000, guidance: 'Style adapté au réseau.' };
          return `- ${n} (${g.limit} caractères maximum) : ${g.guidance}`;
        })
        .join('\n');
      const prompt = `Tu es community manager pour la boutique "${input.shopName}"${input.shopDescription ? ` (${input.shopDescription})` : ''}. Ton de marque à respecter : ${input.tone}. Type de publication : ${input.postType}.
Rédige une publication prête à poster, en français, adaptée au contexte de la Côte d'Ivoire, sur le sujet suivant : "${input.brief}"

Adapte le texte à chacun des réseaux suivants :
${specs}

Réponds UNIQUEMENT avec un objet JSON valide, sans balises markdown ni texte autour, au format exact :
{${input.networks.map((n) => `"${n}": "texte pour ${n}"`).join(', ')}}`;

      const text = await this.callClaude(prompt, 1500);
      if (!text) return { texts: this.mockSocialCopy(input), provider: 'mock' };
      const parsed = TextProvider.extractJson<Record<string, string>>(text);
      // Ne garde que les réseaux demandés, avec repli mock pour ceux qui manqueraient
      const texts: Record<string, string> = {};
      for (const n of input.networks) texts[n] = parsed[n] ?? this.mockSocialCopy(input)[n];
      return { texts, provider: 'anthropic' };
    } catch (err) {
      this.logger.error(`Erreur génération publication sociale: ${String(err)} — repli sur mock`);
      return { texts: this.mockSocialCopy(input), provider: 'mock' };
    }
  }

  /** Propose des idées de sujets et des hashtags adaptés à la boutique. Pilotage social. */
  async generateSocialIdeas(input: {
    tone: string;
    shopName: string;
    shopDescription?: string | null;
  }): Promise<SocialIdeasResult> {
    if (!this.enabled) return { ...this.mockSocialIdeas(input), provider: 'mock' };
    try {
      const prompt = `Tu es community manager pour la boutique de mode "${input.shopName}"${input.shopDescription ? ` (${input.shopDescription})` : ''} (ton : ${input.tone}). Propose 5 idées de sujets de publication courtes et concrètes pour les réseaux sociaux, adaptées à cette boutique et au contexte de la Côte d'Ivoire. Propose aussi 6 hashtags pertinents et réalistes (sans le symbole #).
Réponds UNIQUEMENT avec un JSON valide, sans texte autour : {"ideas": ["...", "...", "...", "...", "..."], "hashtags": ["...", "...", "...", "...", "...", "..."]}`;

      const text = await this.callClaude(prompt, 800);
      if (!text) return { ...this.mockSocialIdeas(input), provider: 'mock' };
      const parsed = TextProvider.extractJson<{ ideas?: string[]; hashtags?: string[] }>(text);
      return {
        ideas: Array.isArray(parsed.ideas) ? parsed.ideas.filter((i) => typeof i === 'string') : [],
        hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags.filter((h) => typeof h === 'string') : [],
        provider: 'anthropic',
      };
    } catch (err) {
      this.logger.error(`Erreur génération idées sociales: ${String(err)} — repli sur mock`);
      return { ...this.mockSocialIdeas(input), provider: 'mock' };
    }
  }

  private mockSocialCopy(input: { brief: string; networks: string[]; shopName: string }): Record<string, string> {
    const texts: Record<string, string> = {};
    for (const n of input.networks) {
      const limit = NETWORK_GUIDANCE[n]?.limit ?? 1000;
      const base =
        n === 'TikTok' || limit <= 300
          ? `${input.brief} ✨ Dispo chez ${input.shopName} — commandez vite !`
          : `${input.brief}\n\nChez ${input.shopName}, on vous a préparé le meilleur. Passez nous voir ou commandez dès maintenant — votre style vous attend. ✨\n\n#${input.shopName.replace(/\s+/g, '')} #mode #CoteDivoire`;
      texts[n] = base.slice(0, limit);
    }
    return texts;
  }

  private mockSocialIdeas(input: { shopName: string }): { ideas: string[]; hashtags: string[] } {
    return {
      ideas: [
        `Présentez la nouveauté de la semaine chez ${input.shopName}`,
        'Coulisses : comment vos commandes sont préparées',
        'Témoignage d’un client satisfait (photo avant/après)',
        'Promo flash du week-end — créez l’urgence',
        'Conseil style : comment porter votre pièce phare',
      ],
      hashtags: ['mode', 'fashion', 'abidjan', 'CoteDivoire', 'style', 'shopping'],
    };
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
