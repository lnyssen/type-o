import { defineConfig } from 'vite';

// The client lives in client/, but imports the engine from shared/ — so the
// dev server needs access to the repo root, and the build lands in dist/.
export default defineConfig({
  root: 'client',
  publicDir: 'public',
  build: { outDir: '../dist', emptyOutDir: true, target: 'es2022' },
  server: {
    port: 3000,
    open: false,
    fs: { allow: ['..'] },
    proxy: { '/api': 'http://localhost:5188', '/masters': 'http://localhost:5188' },
  },
  preview: { port: 3000 },
});
