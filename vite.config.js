import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],
  // MapLibre alone is ~1 MB minified.
  build: { chunkSizeWarningLimit: 1200 },
});
