import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['node_modules', 'dist', 'coverage', 'test-results', 'playwright-report', 'api', 'storage', 'tools', '.claude', 'prototype'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['web/src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    // Haraka plugins (deploy/haraka/plugins): CommonJS on Node, as Haraka loads them.
    files: ['deploy/haraka/**/*.js'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
);
