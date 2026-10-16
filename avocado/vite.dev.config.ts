import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Local harness: the sidebar in a browser, wired to fake adapters (§9.3 dev/).
export default defineConfig({
  root: resolve(__dirname, 'src/dev'),
  plugins: [react()],
  server: { port: 5173, strictPort: true },
});
