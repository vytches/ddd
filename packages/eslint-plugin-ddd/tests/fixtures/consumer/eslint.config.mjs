// Flat config of the fixture consumer project. The plugin is loaded from the BUILT package
// (dist), so the real ESLint CLI exercises exactly what a consumer installs.
import * as tsParser from '@typescript-eslint/parser';
import { configs, plugin } from '../../../dist/index.js';

export default [
  {
    files: ['**/*.ts'],
    languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: 'module' },
    settings: { ddd: { tsconfig: false } },
  },
  configs.recommended,
  // Opt-in rules, switched on here so the CLI run covers every rule of the plugin.
  {
    files: ['**/*.ts'],
    plugins: { ddd: plugin },
    rules: {
      'ddd/no-new-entity-id': 'error',
      'ddd/policy-builder-required-calls': 'error',
    },
  },
];
