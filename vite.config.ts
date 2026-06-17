import { defineConfig } from 'vite';

export default defineConfig({
  base: '/ecosystem-god-sim/',
  resolve: {
    alias: {
      phaser: 'phaser/dist/phaser.esm.js',
    },
  },
  server: {
    port: 5173,
  },
  optimizeDeps: {
    exclude: ['phaser'],
  },
});
