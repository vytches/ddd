// Same flat config as eslint.config.mjs, loaded through the CommonJS entry of the BUILT package
// (`require` condition of `exports`). Selected explicitly with `--config` by the contract test.
const tsParser = require('@typescript-eslint/parser');
const { configs, plugin } = require('../../../dist/index.cjs');

module.exports = [
  {
    files: ['**/*.ts'],
    languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: 'module' },
    settings: { ddd: { tsconfig: false } },
  },
  configs.recommended,
  {
    files: ['**/*.ts'],
    plugins: { ddd: plugin },
    rules: {
      'ddd/no-new-entity-id': 'error',
      'ddd/policy-builder-required-calls': 'error',
    },
  },
];
