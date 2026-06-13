import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import './global.css';
import { Providers } from './providers';

const BANNER = '/qiflow-banner-solar-gold.png';
const LOGO = '/qiflow-wallet-icon.png';
const DESC =
  'Supply assets and borrow against collateral on QIE Blockchain. Flow into decentralized finance.';

export const metadata: Metadata = {
  title: 'QIFlow — DeFi Lending on QIE Blockchain',
  description: DESC,
  icons: {
    icon: LOGO,
    apple: LOGO,
  },
  openGraph: {
    title: 'QIFlow — DeFi Lending on QIE Blockchain',
    description: DESC,
    siteName: 'QIFlow',
    images: [
      { url: BANNER, width: 1500, height: 500, alt: 'QIFlow — Flow Into Decentralized Finance' },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'QIFlow — DeFi Lending on QIE Blockchain',
    description: DESC,
    images: [BANNER],
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
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
