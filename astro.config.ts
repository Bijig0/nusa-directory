import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import preact from '@astrojs/preact';
import tailwindcss from '@tailwindcss/vite';
import { site } from './site.config';

export default defineConfig({
  site: site.url,
  output: 'server',
  trailingSlash: 'ignore',
  compressHTML: true,
  session: false,
  adapter: cloudflare({
    imageService: 'passthrough',
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
    // The workerd module runner cannot survive a mid-session dependency re-optimization
    // ("program reload" crashes the dev server), so every server-side dependency that Vite
    // would otherwise discover lazily is pre-bundled up front. Add new runtime deps here.
    environments: {
      ssr: {
        optimizeDeps: {
          include: [
            'astro/app/manifest',
            'astro/assets/services/noop',
            '@astrojs/preact/server.js',
            'preact',
            'preact/hooks',
            'preact/jsx-runtime',
            'preact-render-to-string',
            '@preact/signals',
            'drizzle-orm',
            'drizzle-orm/d1',
            'drizzle-orm/sqlite-core',
            'arctic',
            'zod',
          ],
          ignoreOutdatedRequests: true,
        },
      },
    },
  },
});
