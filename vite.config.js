import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Set BASE_PATH (e.g. /beltandroadtracker/) when the site is served from a subfolder.
  base: process.env.BASE_PATH || '/',
  plugins: [tailwindcss()],
  // MapLibre alone is ~1 MB minified.
  build: { chunkSizeWarningLimit: 1200 },
});
