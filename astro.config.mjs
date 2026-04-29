import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://soundin.scot',
  vite: {
    plugins: [tailwindcss()],
  },
});
