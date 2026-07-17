import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import './global.css';
import './hide-world-cup.css';
import { Providers } from './providers';
import { DesignModeInit } from '../__create/DesignModeInit';

export const metadata: Metadata = {
  title: 'Cantos Estatísticas',
  description: 'Estatísticas inteligentes de escanteios para o futebol brasileiro',
  icons: {
    icon: '/favicon.png',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="/fontawesome/releases/v6.3.0/css/pro.min.css?token=2c15cc0cc7"
        />
      </head>
      <body>
        <DesignModeInit />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
