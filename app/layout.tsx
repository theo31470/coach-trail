import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/archivo/wdth.css';
import './globals.css';
import './mouvement.css';
import './alpin.css';

export const metadata: Metadata = {
  title: { default: 'Monotrace, ton coach trail et running', template: '%s · Monotrace' },
  description:
    'Le coach trail et running qui t’accompagne chaque jour : bilan du matin, séance adaptée à ta forme, envoyée à ta montre, analysée après ta sortie.',
  applicationName: 'Monotrace',
  metadataBase: new URL(process.env.SITE_URL ?? 'https://monotrace.fr'),
  openGraph: { siteName: 'Monotrace', locale: 'fr_FR', type: 'website' },
  appleWebApp: { capable: true, title: 'Monotrace', statusBarStyle: 'default' },
  icons: { apple: '/icones/apple-touch-icon.png' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1D5BFF',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" data-theme="clair">
      <body>{children}</body>
    </html>
  );
}
