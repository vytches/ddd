'use strict';
// VF-043 AC-SPIKE (b): read-only run of the prototype on a consumer worktree.
// Usage: node run.js <consumer-root> [one-file]   (one-file = cold single-file timing mode)
const path = require('path');
const fs = require('fs');
const { ESLint } = require('module').createRequire('/opt/projects/vytches-ddd/package.json')(
  'eslint'
);
const parser = require('module').createRequire('/opt/projects/vytches-ddd/package.json')(
  '@typescript-eslint/parser'
);
const { createRoleResolver } = require('./role-resolver');
const { createPlugin } = require('./plugin');

const cwd = path.resolve(process.argv[2]);
const oneFile = process.argv[3];
const LIB = '@vytches/ddd';

// Library defaults (shipped by the library) + project bindings (written by the consumer).
const libraryBindings = [
  { role: 'Aggregate', extends: { name: 'AggregateRoot', from: LIB } },
  { role: 'ValueObject', extends: { name: 'BaseValueObject', from: LIB } },
  { role: 'Specification', extends: { name: 'CompositeSpecification', from: LIB } },
  { role: 'Entity', extends: { name: 'BaseEntity', from: LIB } },
  { role: 'EntityId', extends: { name: 'BaseEntityId', from: LIB } },
  { role: 'EntityId', extends: { name: 'ContractsEntityId', from: LIB } },
];
const projectBindings = [
  {
    role: 'CommandHandler',
    extends: {
      name: 'BaseCommandHandler',
      from: 'src/shared/application/base/base-command-handler.ts',
    },
  },
  {
    role: 'QueryHandler',
    extends: {
      name: 'BaseQueryHandler',
      from: 'src/shared/application/base/base-query-handler.ts',
    },
  },
];

const tsconfig = JSON.parse(
  fs
    .readFileSync(path.join(cwd, 'tsconfig.json'), 'utf8')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/,(\s*[}\]])/g, '$1')
);
const resolver = createRoleResolver({
  cwd,
  baseUrl: tsconfig.compilerOptions.baseUrl,
  paths: tsconfig.compilerOptions.paths,
  bindings: [...libraryBindings, ...projectBindings],
});
const plugin = createPlugin(resolver);

const rules = {
  'ddd/no-throw-in-role': [
    'error',
    {
      selector: 'ThrowStatement',
      message: 'Aggregates and value objects must not throw. Fix: return Result.fail(...).',
    },
  ],
  'ddd/command-handler-restricted': [
    'error',
    {
      selector: 'NewExpression[callee.name=/Repository$/]',
      message: 'Command handlers must receive repositories via DI. Fix: inject it.',
    },
  ],
  'ddd/constructor-not-public': ['error', { roles: ['Aggregate', 'ValueObject'] }],
};
const mk = withPlugin =>
  new ESLint({
    cwd,
    overrideConfigFile: true,
    cache: false,
    overrideConfig: [
      {
        files: ['**/*.ts'],
        languageOptions: { parser },
        linterOptions: { reportUnusedDisableDirectives: 'off', noInlineConfig: true },
        ...(withPlugin ? { plugins: { ddd: plugin }, rules } : {}),
      },
    ],
  });

async function main() {
  const problems = resolver.validate();
  if (problems.length) {
    console.error('CONFIG ERRORS:', problems);
    process.exit(2);
  }

  if (oneFile) {
    const t0 = process.hrtime.bigint();
    const [r] = await mk(true).lintFiles([oneFile]);
    console.log(
      JSON.stringify({
        file: oneFile,
        ms: Number(process.hrtime.bigint() - t0) / 1e6,
        errors: r.errorCount,
      })
    );
    return;
  }

  const walk = d =>
    fs.readdirSync(d, { withFileTypes: true }).flatMap(e => {
      const p = path.join(d, e.name);
      if (e.isDirectory())
        return e.name === 'node_modules' || e.name === '__fixtures__' ? [] : walk(p);
      return /\.ts$/.test(e.name) && !/\.(spec|test)\.ts$/.test(e.name) ? [p] : [];
    });
  const files = walk(path.join(cwd, 'src/contexts'));

  // Role statistics + recall heuristics against file-name conventions.
  const tsParser = parser;
  const stats = {};
  const misses = { aggregate: [], vo: [], handler: [] };
  for (const f of files) {
    const ast = tsParser.parse(fs.readFileSync(f, 'utf8'), { range: true, loc: true, filePath: f });
    const cls = resolver.classify(ast, f);
    for (const c of cls) for (const r of c.roles) stats[r] = (stats[r] || 0) + 1;
    const has = r => cls.some(c => c.roles.has(r));
    if (/\.aggregate\.ts$/.test(f) && cls.length && !has('Aggregate'))
      misses.aggregate.push(path.relative(cwd, f));
    if (/\.vo\.ts$/.test(f) && cls.length && !has('ValueObject'))
      misses.vo.push(path.relative(cwd, f));
    if (/command[.-]handler\.ts$/.test(f) && cls.length && !has('CommandHandler'))
      misses.handler.push(path.relative(cwd, f));
  }

  const eslint = mk(true);
  const t0 = Date.now();
  const results = await eslint.lintFiles(files);
  const fullMs = Date.now() - t0;
  const base = mk(false);
  const t1 = Date.now();
  await base.lintFiles(files);
  const baseMs = Date.now() - t1;

  // Warm per-file timing on a sample: reuse instance (daemon-like), one file at a time.
  const sample = files.filter((_, i) => i % Math.ceil(files.length / 60) === 0);
  const per = [];
  for (const f of sample) {
    const s = process.hrtime.bigint();
    await eslint.lintFiles([f]);
    per.push(Number(process.hrtime.bigint() - s) / 1e6);
  }
  per.sort((a, b) => a - b);

  const hits = {};
  for (const r of results)
    for (const m of r.messages) {
      (hits[m.ruleId || 'parse-error'] ||= []).push({
        file: path.relative(cwd, r.filePath),
        line: m.line,
        msg: m.message.slice(0, 80),
      });
    }
  const summary = {
    files: files.length,
    roleClasses: stats,
    recallMisses: {
      aggregate: misses.aggregate.length,
      vo: misses.vo.length,
      handler: misses.handler.length,
    },
    missExamples: {
      aggregate: misses.aggregate.slice(0, 5),
      vo: misses.vo.slice(0, 5),
      handler: misses.handler.slice(0, 5),
    },
    fullRunMs: { withPlugin: fullMs, parserOnly: baseMs },
    warmPerFileMs: {
      p50: per[Math.floor(per.length / 2)],
      p95: per[Math.floor(per.length * 0.95)],
      max: per[per.length - 1],
      n: per.length,
    },
    hitCounts: Object.fromEntries(Object.entries(hits).map(([k, v]) => [k, v.length])),
  };
  fs.writeFileSync(path.join(__dirname, 'hits.json'), JSON.stringify(hits, null, 1));
  console.log(JSON.stringify(summary, null, 1));
}
main().catch(e => {
  console.error(e);
  process.exit(1);
});
