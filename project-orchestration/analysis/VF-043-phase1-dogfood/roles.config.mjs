// VF-043 Phase 1 dogfood harness (scratch config; run with CONSUMER_DIR=<checkout> REPO_DIR=<this repo>)
const CONSUMER = process.env.CONSUMER_DIR; // path to a checkout of the consumer (read-only use)
const REPO = process.env.REPO_DIR ?? process.cwd(); // this repository
if (!CONSUMER) throw new Error('set CONSUMER_DIR');
const { default: tsParser } = await import(CONSUMER + '/node_modules/@typescript-eslint/parser/dist/index.js');
const { roleScoped, resolverFromSettings } = await import(REPO + '/packages/eslint-plugin-ddd/dist/index.js');

const probe = (label) => ({
  meta: { type: 'problem', messages: { hit: label }, schema: [] },
  create: (ctx) => ({ ClassDeclaration: (node) => ctx.report({ node, messageId: 'hit' }) }),
});
const mk = (role) => ({ rules: { probe: roleScoped(probe(role), role, { resolver: resolverFromSettings, scope: 'class' }) } });

export default [
  {
    files: ['src/**/*.ts'],
    languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: 'module' },
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    settings: { ddd: { tsconfig: 'tsconfig.json', bindings: [
      { role: 'ProjectBaseDomainEvent', extends: { from: 'src/shared/domain/events/project-base-domain-event.base.ts', name: 'ProjectBaseDomainEvent' } },
      { role: 'ProjectBaseIntegrationEvent', extends: { from: 'src/shared/domain/integration-events/project-base-integration-event.base.ts', name: 'ProjectBaseIntegrationEvent' } },
    ] } },
  },
  ...['Aggregate', 'ValueObject', 'Entity', 'DomainEvent', 'ProjectBaseDomainEvent', 'ProjectBaseIntegrationEvent'].map((role) => ({
    files: ['src/**/*.ts'],
    plugins: { [`r${role}`]: mk(role) },
    rules: { [`r${role}/probe`]: 'error' },
  })),
];
