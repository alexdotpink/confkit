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
  metadataBase:
    process.env.NEXT_PUBLIC_SITE_URL
      ? new URL(process.env.NEXT_PUBLIC_SITE_URL)
      : process.env.VERCEL_URL
      ? new URL(`https://${process.env.VERCEL_URL}`)
      : undefined,
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
    images: [
      '/og?title=Configuration%20that%20keeps%20up%20with%20your%20code&description=Type%E2%80%91safe%20config%20and%20secure%20secrets%20for%20Node%2C%20serverless%2C%20edge%2C%20Next.js%2C%20Vite%2C%20and%20Expo.',
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ConfKit',
    description:
      'Type‑safe config and secure secrets across your stack.',
    images: [
      '/og?title=Configuration%20that%20keeps%20up%20with%20your%20code&description=Type%E2%80%91safe%20config%20and%20secure%20secrets%20for%20Node%2C%20serverless%2C%20edge%2C%20Next.js%2C%20Vite%2C%20and%20Expo.',
    ],
  },
};
