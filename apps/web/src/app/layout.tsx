import type { Metadata, Viewport } from 'next';
import './globals.css';
import './shell.css';
import { Shell } from '@/componentes/Shell';

export const metadata: Metadata = {
  title: 'JiuPresence',
  description: 'Controle de presença e graduação para academia de jiu-jitsu.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'JiuPresence' },
};

export const viewport: Viewport = {
  themeColor: '#101014',
  width: 'device-width',
  initialScale: 1,
  // Não bloquear o zoom: o professor pode precisar ampliar a lista.
  maximumScale: 5,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="pt-BR">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
