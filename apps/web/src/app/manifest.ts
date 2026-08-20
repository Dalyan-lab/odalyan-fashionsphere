import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Odalyan FashionSphere AI',
    short_name: 'FashionSphere',
    description:
      'Créez, animez, exposez et vendez avec la puissance de l’IA. Odalyan FashionSphere.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0a0710',
    theme_color: '#0a0710',
    lang: 'fr',
    categories: ['shopping', 'business', 'lifestyle'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    /**
     * Raccourcis de l'application installée : clic droit sur l'icône (barre des
     * tâches, dock ou écran d'accueil) pour ouvrir directement une page de travail,
     * sans repasser par l'accueil public.
     */
    shortcuts: [
      {
        name: 'Tableau de bord',
        url: '/dashboard',
        icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Pilotage social',
        url: '/dashboard/pilotage',
        icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Studio IA',
        url: '/dashboard/studio',
        icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Commandes',
        url: '/dashboard/orders',
        icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
    ],
  };
}
