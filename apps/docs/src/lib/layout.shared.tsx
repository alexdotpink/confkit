import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import Image from 'next/image';

/**
 * Shared layout configurations
 *
 * you can customise layouts individually from:
 * Home Layout: app/(home)/layout.tsx
 * Docs Layout: app/docs/layout.tsx
 */
export function baseOptions(): BaseLayoutProps {
  return {
    githubUrl: 'https://github.com/alexdotpink/confkit',
    themeSwitch: { mode: 'light-dark-system' },
    nav: {
      title: (
        <span className="inline-flex items-center gap-2">
          <Image
            src="/logo.png"
            alt="ConfKit logo"
            width={20}
            height={20}
            className="rounded-sm invert dark:invert-0"
            priority
          />
          <span className="font-semibold dark:text-white text-black">ConfKit</span>
        </span>
      ),
      url: '/',
    },
    // no extra sidebar links
    links: [],
  };
}
