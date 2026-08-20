import type { Metadata, Viewport } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { PWARegister } from '@/components/pwa-register';

import { BRAND, BRAND_LEGAL } from '@/lib/brand';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-display' });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://fashodalyansp.com';
/**
 * Visuel des aperçus de lien, en 1200 × 630 — le format que LinkedIn, Facebook
 * et WhatsApp affichent en grande image. Le logo, presque carré, n'y donnait
 * qu'une vignette. Défini une fois : OpenGraph et Twitter partagent le même.
 */
const PARTAGE = { url: '/apercu-partage.jpg', width: 1200, height: 630, alt: BRAND };

const DESCRIPTION =
  'Créez, animez, exposez et vendez avec la puissance de l’IA. Odalyan FashionSphere transforme une photo de vêtement en mannequins, défilés 3D, vidéos et publicités.';

export const metadata: Metadata = {
  // Indispensable : sans adresse de base, Next produit des URL d'images
  // relatives que Facebook, WhatsApp et TikTok ne savent pas résoudre — la
  // carte de partage s'affiche alors sans visuel.
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${BRAND_LEGAL} — Fashion Commerce IA`,
    // Les pages produit et boutique complètent ce gabarit.
    template: `%s — ${BRAND}`,
  },
  description: DESCRIPTION,
  applicationName: BRAND,
  manifest: '/manifest.webmanifest',
  openGraph: {
    type: 'website',
    siteName: BRAND,
    locale: 'fr_FR',
    url: SITE_URL,
    title: 'Odalyan FashionSphere AI™',
    description: DESCRIPTION,
    images: [PARTAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Odalyan FashionSphere AI™',
    description: DESCRIPTION,
    images: [PARTAGE],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'FashionSphere',
  },
  icons: {
    icon: '/icon-192.png',
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#0a0710',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

// Évite le flash de thème (FOUC) : applique la classe avant le rendu React.
const themeScript = `(function(){try{var t=localStorage.getItem('odalyan-theme')||'dark';document.documentElement.classList.add(t);document.documentElement.style.colorScheme=t;}catch(e){document.documentElement.classList.add('dark');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${inter.variable} ${playfair.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen font-sans">
        <ThemeProvider>
          {children}
          <PWARegister />
        </ThemeProvider>
      </body>
    </html>
  );
}
