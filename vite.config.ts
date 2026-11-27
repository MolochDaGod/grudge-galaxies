import { defineConfig } from 'vite';

// Relative base so the same build runs on the claude.ai artifact, GitHub Pages (/grudge-galaxies/) and Cloudflare Pages.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1500,
    rollupOptions: { output: { manualChunks: { three: ['three'] } } },
  },
  server: { port: 5173 },
});
