// VF-043 Phase 1 dogfood harness (scratch config; run with CONSUMER_DIR=<checkout> REPO_DIR=<this repo>)
const CONSUMER = process.env.CONSUMER_DIR; // path to a checkout of the consumer (read-only use)
const REPO = process.env.REPO_DIR ?? process.cwd(); // this repository
if (!CONSUMER) throw new Error('set CONSUMER_DIR');
const { default: tsParser } = await import(CONSUMER + '/node_modules/@typescript-eslint/parser/dist/index.js');
const { configs, plugin } = await import(REPO + '/packages/eslint-plugin-ddd/dist/index.js');

export default [
  {
    files: ['src/**/*.ts'],
    languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: 'module' },
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    settings: {
      ddd: {
        tsconfig: 'tsconfig.json',
        bindings: [
          {
            role: 'ProjectBaseDomainEvent',
            extends: { from: 'src/shared/domain/events/project-base-domain-event.base.ts', name: 'ProjectBaseDomainEvent' },
          },
        ],
      },
    },
  },
  configs.recommended,
  {
    files: ['src/**/*.ts'],
    plugins: { ddd: plugin },
    rules: { 'ddd/no-new-entity-id': 'error', 'ddd/policy-builder-required-calls': 'error' },
  },
];
