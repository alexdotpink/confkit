import '@/app/global.css';
import { RootProvider } from 'fumadocs-ui/provider';
import { Inter } from 'next/font/google';
import type { Metadata } from 'next';

const inter = Inter({
  subsets: ['latin'],
});

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={inter.className} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}

export const metadata: Metadata = {
  title: {
    default: 'ConfKit — Type‑safe config. Secure secrets.',
    template: '%s · ConfKit',
  },
  description:
    'Type‑safe config and secure secrets for Node, serverless, edge, Next.js, Vite, and Expo. Define once, get validated values and strong types everywhere.',
  openGraph: {
    title: 'ConfKit',
    description:
      'Type‑safe config and secure secrets across your stack.',
    siteName: 'ConfKit',
    images: [],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ConfKit',
    description:
      'Type‑safe config and secure secrets across your stack.',
  },
};
