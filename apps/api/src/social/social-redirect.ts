import type { Request } from 'express';

/**
 * URL de retour OAuth d'un réseau. Doit être IDENTIQUE à l'autorisation et à
 * l'échange du code, et correspondre exactement à celle déclarée dans l'app
 * développeur. Déduite des en-têtes du proxy si API_PUBLIC_URL est absent.
 */
export function socialRedirectUri(req: Request, network: string): string {
  const base = process.env.API_PUBLIC_URL
    ? process.env.API_PUBLIC_URL.replace(/\/$/, '')
    : `${(req.headers['x-forwarded-proto'] as string)?.split(',')[0] || req.protocol || 'https'}://${
        (req.headers['x-forwarded-host'] as string) || req.headers.host
      }`;
  return `${base}/api/social/oauth/callback/${encodeURIComponent(network)}`;
}
