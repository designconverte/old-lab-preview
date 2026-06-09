const { resolve } = require('node:path');
const { defineConfig } = require('vite');

module.exports = defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  publicDir: resolve(__dirname, 'public'),
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        home: resolve(__dirname, 'index.html'),
        qualified: resolve(__dirname, 'obrigado-qlf/index.html'),
        disqualified: resolve(__dirname, 'obrigado-dsq/index.html'),
      },
    },
  },
});
