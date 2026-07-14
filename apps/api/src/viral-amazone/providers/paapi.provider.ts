import { createHash, createHmac } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { AMAZON_MARKETPLACES } from '@odalyan/shared';

/** Config réseau PA-API par marketplace (host + région AWS SigV4). */
interface RegionConfig {
  host: string;
  region: string;
}

const REGION_BY_CODE: Record<string, RegionConfig> = {
  FR: { host: 'webservices.amazon.fr', region: 'eu-west-1' },
  COM: { host: 'webservices.amazon.com', region: 'us-east-1' },
  UK: { host: 'webservices.amazon.co.uk', region: 'eu-west-1' },
  DE: { host: 'webservices.amazon.de', region: 'eu-west-1' },
  IT: { host: 'webservices.amazon.it', region: 'eu-west-1' },
  ES: { host: 'webservices.amazon.es', region: 'eu-west-1' },
  CA: { host: 'webservices.amazon.ca', region: 'us-east-1' },
  JP: { host: 'webservices.amazon.co.jp', region: 'us-west-2' },
  IN: { host: 'webservices.amazon.in', region: 'eu-west-1' },
};

const SERVICE = 'ProductAdvertisingAPI';

/**
 * Tag Associates par défaut, par marketplace. Le Partner Tag n'est PAS un secret
 * (il apparaît en clair dans chaque lien d'affiliation), on peut donc l'embarquer.
 * Surchargé par AMAZON_PAAPI_PARTNER_TAG[_CODE] si défini côté environnement.
 * fashionsphe05-21 = compte Club Partenaires amazon.fr d'Odalyan FashionSphere.
 */
const DEFAULT_PARTNER_TAG: Record<string, string> = {
  FR: 'fashionsphe05-21',
};

export interface PaapiItem {
  asin: string;
  title: string;
  imageUrl: string | null;
  category: string | null;
  price: number | null;
  currency: string | null;
  reviewCount: number | null;
  rating: number | null;
  salesRank: number | null;
  productUrl: string;
}

/**
 * Client Amazon Product Advertising API 5.0 (officiel, conforme aux CGU Amazon).
 * Requêtes signées AWS Signature V4. Aucune évasion anti-bot : c'est l'API
 * publique fournie aux membres du programme Associates.
 * Inerte tant qu'aucune credential n'est configurée (mode dégradé géré par l'appelant).
 */
@Injectable()
export class PaapiProvider {
  private readonly logger = new Logger(PaapiProvider.name);

  /** Trouve le code marketplace (FR/COM/UK…) à partir d'un domaine ("amazon.fr"). */
  private codeFor(marketplaceDomain: string): string | null {
    const info = AMAZON_MARKETPLACES.find((m) => m.domain === marketplaceDomain);
    return info?.code ?? null;
  }

  private credentials(code: string) {
    const accessKey = process.env[`AMAZON_PAAPI_ACCESS_KEY_${code}`] || process.env.AMAZON_PAAPI_ACCESS_KEY;
    const secretKey = process.env[`AMAZON_PAAPI_SECRET_KEY_${code}`] || process.env.AMAZON_PAAPI_SECRET_KEY;
    const partnerTag =
      process.env[`AMAZON_PAAPI_PARTNER_TAG_${code}`] ||
      process.env.AMAZON_PAAPI_PARTNER_TAG ||
      DEFAULT_PARTNER_TAG[code];
    return { accessKey, secretKey, partnerTag };
  }

  /** Vrai si des credentials PA-API sont disponibles pour ce marketplace. */
  enabledFor(marketplaceDomain: string): boolean {
    const code = this.codeFor(marketplaceDomain);
    if (!code) return false;
    const { accessKey, secretKey, partnerTag } = this.credentials(code);
    return Boolean(accessKey && secretKey && partnerTag);
  }

  /** Construit le lien d'affiliation officiel (tag Associates + sub-tag de suivi vendeur). */
  buildAffiliateUrl(asin: string, marketplaceDomain: string, sellerTrackingId: string): string {
    const code = this.codeFor(marketplaceDomain);
    const { partnerTag } = code ? this.credentials(code) : { partnerTag: undefined };
    const tag = partnerTag ? `tag=${encodeURIComponent(partnerTag)}&` : '';
    return `https://www.${marketplaceDomain}/dp/${asin}?${tag}ascsubtag=${encodeURIComponent(sellerTrackingId)}`;
  }

  /** Récupère jusqu'à 10 produits par ASIN (titre, image, prix, avis, rang) via GetItems. */
  async getItems(asins: string[], marketplaceDomain: string): Promise<PaapiItem[]> {
    const code = this.codeFor(marketplaceDomain);
    if (!code || asins.length === 0) return [];
    const region = REGION_BY_CODE[code];
    const { accessKey, secretKey, partnerTag } = this.credentials(code);
    if (!region || !accessKey || !secretKey || !partnerTag) return [];

    const body = {
      ItemIds: asins.slice(0, 10),
      Resources: [
        'ItemInfo.Title',
        'Images.Primary.Large',
        'ItemInfo.Classifications',
        'Offers.Listings.Price',
        'CustomerReviews.Count',
        'CustomerReviews.StarRating',
        'BrowseNodeInfo.WebsiteSalesRank',
      ],
      PartnerTag: partnerTag,
      PartnerType: 'Associates',
      Marketplace: `www.${marketplaceDomain}`,
    };

    try {
      const res = await this.signedPost(region, accessKey, secretKey, '/paapi5/getitems', 'GetItems', body);
      if (!res.ok) {
        this.logger.error(`PA-API GetItems (${marketplaceDomain}) ${res.status}: ${await res.text().catch(() => '')}`);
        return [];
      }
      const data = (await res.json()) as {
        ItemsResult?: { Items?: Record<string, unknown>[] };
      };
      return (data.ItemsResult?.Items ?? []).map((item) => this.mapItem(item, marketplaceDomain));
    } catch (err) {
      this.logger.error(`PA-API GetItems erreur (${marketplaceDomain}): ${String(err)}`);
      return [];
    }
  }

  private mapItem(item: Record<string, unknown>, marketplaceDomain: string): PaapiItem {
    const asin = String(item.ASIN ?? '');
    const itemInfo = (item.ItemInfo ?? {}) as Record<string, any>;
    const images = (item.Images ?? {}) as Record<string, any>;
    const offers = (item.Offers ?? {}) as Record<string, any>;
    const reviews = (item.CustomerReviews ?? {}) as Record<string, any>;
    const browseNode = (item.BrowseNodeInfo ?? {}) as Record<string, any>;

    const listing = offers.Listings?.[0];
    const rankInfo = browseNode.WebsiteSalesRank;

    return {
      asin,
      title: itemInfo.Title?.DisplayValue ?? asin,
      imageUrl: images.Primary?.Large?.URL ?? null,
      category: itemInfo.Classifications?.ProductGroup?.DisplayValue ?? null,
      price: listing?.Price?.Amount ?? null,
      currency: listing?.Price?.Currency ?? null,
      reviewCount: reviews.Count?.DisplayValue ?? null,
      rating: reviews.StarRating?.DisplayValue ?? null,
      salesRank: rankInfo?.SalesRank ?? null,
      productUrl: (item.DetailPageURL as string) ?? `https://www.${marketplaceDomain}/dp/${asin}`,
    };
  }

  // --------------------------------------------------------------- AWS SigV4

  private async signedPost(
    region: RegionConfig,
    accessKey: string,
    secretKey: string,
    path: string,
    target: string,
    body: unknown,
  ): Promise<Response> {
    const payload = JSON.stringify(body);
    const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, ''); // ex: 20260714T120000Z
    const dateStamp = amzDate.slice(0, 8);

    const headers: Record<string, string> = {
      'content-encoding': 'amz-1.0',
      'content-type': 'application/json; charset=utf-8',
      host: region.host,
      'x-amz-date': amzDate,
      'x-amz-target': `com.amazon.paapi5.v1.ProductAdvertisingAPIv1.${target}`,
    };

    const signedHeaders = Object.keys(headers).sort().join(';');
    const canonicalHeaders = Object.keys(headers)
      .sort()
      .map((k) => `${k}:${headers[k]}\n`)
      .join('');
    const hashedPayload = createHash('sha256').update(payload).digest('hex');

    const canonicalRequest = ['POST', path, '', canonicalHeaders, signedHeaders, hashedPayload].join('\n');
    const credentialScope = `${dateStamp}/${region.region}/${SERVICE}/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n');

    const kDate = createHmac('sha256', `AWS4${secretKey}`).update(dateStamp).digest();
    const kRegion = createHmac('sha256', kDate).update(region.region).digest();
    const kService = createHmac('sha256', kRegion).update(SERVICE).digest();
    const kSigning = createHmac('sha256', kService).update('aws4_request').digest();
    const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');

    const authorization =
      `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return fetch(`https://${region.host}${path}`, {
      method: 'POST',
      headers: { ...headers, Authorization: authorization },
      body: payload,
    });
  }
}
