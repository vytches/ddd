// VF-043 Phase 1 dogfood harness (scratch config; run with CONSUMER_DIR=<checkout> REPO_DIR=<this repo>)
const CONSUMER = process.env.CONSUMER_DIR; // path to a checkout of the consumer (read-only use)
const REPO = process.env.REPO_DIR ?? process.cwd(); // this repository
if (!CONSUMER) throw new Error('set CONSUMER_DIR');
const { ESLint } = await import(REPO + '/node_modules/eslint/lib/api.js');
const eslint = new ESLint({ cwd: CONSUMER, overrideConfigFile: process.argv[2], ignore: false });
const cases = {
  'meta EntityId new': `import { EntityId } from '@vytches/ddd';\nconst a = new EntityId('a', 'text');`,
  'meta ContractsEntityId alias new': `import { ContractsEntityId as B } from '@vytches/ddd';\nconst a = new B('a');`,
  'sub-package EntityId new (control)': `import { EntityId } from '@vytches/ddd-value-objects';\nconst a = new EntityId('a', 'text');`,
  'contracts EntityId new (control)': `import { EntityId } from '@vytches/ddd-contracts';\nconst a = new EntityId('a', 'text');`,
  'meta deprecated factory': `import { EntityId } from '@vytches/ddd';\nEntityId.createWithRandomUUID();`,
  'meta instanceof Result': `import { Result } from '@vytches/ddd';\nexport const f = (x: unknown) => x instanceof Result;`,
  'meta internal subpath': `import { x } from '@vytches/ddd/internal';`,
  'subpkg internal subpath': `import { x } from '@vytches/ddd-contracts/internal';`,
};
for (const [name, code] of Object.entries(cases)) {
  const [r] = await eslint.lintText(code, { filePath: CONSUMER + '/src/probe.ts' });
  console.log(name.padEnd(38), r.messages.map(m => (m.ruleId ?? 'FATAL ' + m.message)).join(', ') || '(no findings)');
}
