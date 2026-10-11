import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // GitHub Pages serves the site from a subfolder; the deploy workflow sets BASE_PATH.
  base: process.env.BASE_PATH || '/',
  plugins: [tailwindcss()],
  // MapLibre alone is ~1 MB minified.
  build: { chunkSizeWarningLimit: 1200 },
});
