import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://soundin.scot',
  adapter: vercel(),
  vite: {
    plugins: [tailwindcss()],
  },
});
