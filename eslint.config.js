import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['node_modules', 'web/dist', 'coverage', 'test-results', 'playwright-report', '.playwright-mcp', 'api',
      'storage', '.claude'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['web/src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    // Local dev tooling run by Node.
    files: ['tools/**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
);
