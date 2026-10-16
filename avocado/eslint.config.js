import js from '@eslint/js';
import boundaries from 'eslint-plugin-boundaries';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'node_modules/**',
      'test-results/**',
      'playwright-report/**',
      'chrome-extension/**',
      'src/**/*.generated.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, boundaries },
    settings: {
      'boundaries/elements': [
        { type: 'core', pattern: 'src/core/**' },
        { type: 'ports', pattern: 'src/ports/**' },
        { type: 'llm', pattern: 'src/llm/**' },
        { type: 'application', pattern: 'src/application/**' },
        { type: 'adapters', pattern: 'src/adapters/**' },
        { type: 'server', pattern: 'src/server/**' },
        { type: 'ui', pattern: 'src/ui/**' },
        { type: 'dev', pattern: 'src/dev/**' },
      ],
      'import/resolver': { node: { extensions: ['.ts', '.tsx'] } },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // §9.1 Dependency inversion: core is pure; application only sees core + ports.
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            { from: 'core', allow: ['core'] },
            { from: 'ports', allow: ['core', 'ports'] },
            { from: 'llm', allow: ['core', 'ports', 'llm'] },
            { from: 'application', allow: ['core', 'ports', 'llm', 'application'] },
            { from: 'adapters', allow: ['core', 'ports', 'llm', 'adapters'] },
            { from: 'server', allow: ['core', 'ports', 'llm', 'application', 'adapters', 'server'] },
            { from: 'ui', allow: ['core', 'ports', 'ui'] },
            { from: 'dev', allow: ['core', 'ports', 'llm', 'application', 'adapters', 'server', 'ui', 'dev'] },
          ],
        },
      ],
    },
  },
);
