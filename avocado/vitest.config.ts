import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/{unit,integration,contract}/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.generated.ts', 'src/dev/**', 'src/ui/main.tsx', 'src/ui/compose.ts', 'src/ui/extraction/defaultExtractors.ts', 'src/server/compose.ts', 'src/server/main.ts', 'src/ui/types/**', 'src/**/types.ts'],
      thresholds: {
        'src/core/**': { lines: 90, branches: 90 },
        'src/llm/**': { lines: 90, branches: 90 },
        'src/application/**': { lines: 80, branches: 80 },
        'src/ui/**': { lines: 80, branches: 80 },
      },
    },
  },
});
