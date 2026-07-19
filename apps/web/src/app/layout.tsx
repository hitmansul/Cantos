import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import './global.css';
import './responsive.css';
import './hide-world-cup.css';
import { Providers } from './providers';
import { DesignModeInit } from '../__create/DesignModeInit';
import { ProductNavigation } from '@/components/ProductNavigation';

export const metadata: Metadata = {
  title: 'Cantos Estatísticas',
  description: 'Estatísticas inteligentes, comparação de odds e oportunidades para mercados de futebol',
  icons: {
    icon: '/favicon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link
          rel="stylesheet"
          href="/fontawesome/releases/v6.3.0/css/pro.min.css?token=2c15cc0cc7"
        />
      </head>
      <body>
        <DesignModeInit />
        <Providers>
          <ProductNavigation />
          {children}
        </Providers>
      </body>
    </html>
  );
}
