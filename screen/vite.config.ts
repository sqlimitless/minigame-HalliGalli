import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  publicDir: '../img',
  server: { port: 5173, host: true },
  build: { outDir: '../dist/screen' },
});
