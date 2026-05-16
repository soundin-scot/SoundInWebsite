import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://soundin.scot',
  trailingSlash: 'always',
  integrations: [sitemap()],
  adapter: vercel(),
  vite: {
    plugins: [tailwindcss()],
  },
});
