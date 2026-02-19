import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  publicDir: '../public',
  server: { port: 5174, host: true },
  build: { outDir: '../dist/controller' },
});
