import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Production sidebar: one inlined HTML file served by HtmlService (§9.2).
export default defineConfig({
  root: resolve(__dirname, 'src/ui'),
  plugins: [react(), viteSingleFile()],
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: false,
    rollupOptions: { input: resolve(__dirname, 'src/ui/Sidebar.html') },
  },
});
