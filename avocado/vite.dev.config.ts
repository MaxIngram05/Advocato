import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { avocadoDevServer } from './src/dev/devServer';

// Local harness: the sidebar in a browser. `/rpc` runs the real application with live
// Augure + CAIJ; add `?fake` to the URL for the in-browser fake (no network).
export default defineConfig({
  root: resolve(__dirname, 'src/dev'),
  plugins: [react(), avocadoDevServer(__dirname)],
  server: { port: 5173, strictPort: true },
});
