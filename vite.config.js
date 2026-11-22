import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the production build works from any sub-path / static host.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 3000,
    open: false,
    host: true,
    // Desktop/package output lives inside the project; watching it made Vite
    // read Electron's DLLs and crash. Source changes still hot-reload.
    watch: { ignored: ['**/release/**', '**/dist/**', '**/src-tauri/target/**'] }
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/phaser')) return 'phaser';
          if (id.includes('node_modules/react')) return 'react';
        }
      }
    }
  }
});
