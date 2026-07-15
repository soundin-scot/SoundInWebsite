import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://www.soundin.scot',
  trailingSlash: 'never',
  adapter: vercel(),
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/api/') && !page.includes('/newsletter/confirm'),
      serialize: (item) => {
        if (item.url !== 'https://www.soundin.scot/') {
          item.url = item.url.replace(/\/$/, '');
        }

        return item;
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
