import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Coach Trail',
    short_name: 'Coach Trail',
    description: 'Ton coach trail et running : un plan qui s’adapte chaque jour, des séances envoyées à ta montre.',
    start_url: '/app?source=app',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#F5F8FF',
    theme_color: '#1D5BFF',
    lang: 'fr',
    categories: ['sports', 'health', 'fitness'],
    icons: [
      { src: '/icones/icone-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icones/icone-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icones/icone-masque-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Ma journée', url: '/app', icons: [{ src: '/icones/icone-192.png', sizes: '192x192' }] },
      { name: 'Mon plan', url: '/app/plan?vue=calendrier', icons: [{ src: '/icones/icone-192.png', sizes: '192x192' }] },
    ],
  };
}
