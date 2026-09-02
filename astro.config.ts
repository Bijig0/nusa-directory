import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import preact from '@astrojs/preact';
import tailwindcss from '@tailwindcss/vite';
import { site } from './site.config';

export default defineConfig({
  site: site.url,
  output: 'server',
  trailingSlash: 'ignore',
  compressHTML: true,
  session: false,
  adapter: vercel({
    maxDuration: 60,
  }),
  integrations: [preact()],
  i18n: {
    defaultLocale: 'id',
    locales: ['id', 'en'],
    routing: { prefixDefaultLocale: false },
  },
  security: { checkOrigin: true },
  vite: {
    plugins: [tailwindcss()],
    ssr: { external: ['sharp', '@libsql/client'] },
  },
});
