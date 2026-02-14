import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  publicDir: '../img',
  server: { port: 5174, host: true },
  build: { outDir: '../dist/controller' },
});
