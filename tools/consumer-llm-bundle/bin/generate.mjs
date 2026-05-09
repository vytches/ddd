#!/usr/bin/env node
/**
 * @vytches/ddd consumer LLM-bundle generator.
 *
 * Reads `LLMGUIDE.md` from every installed `@vytches/ddd-*` package in your
 * application's `node_modules/` and produces a single markdown file
 * suitable for pasting into a Claude / Cursor / Copilot context window.
 *
 * Pure Node — no dependencies beyond the standard library. Works against
 * pnpm, npm, and yarn `node_modules` layouts.
 *
 * Usage (from your application's project root):
 *
 *   node /path/to/vytches-ddd/tools/consumer-llm-bundle/bin/generate.mjs
 *
 * Or vendor this single file into your project:
 *
 *   mkdir -p tools/llm
 *   cp /path/to/vytches-ddd/tools/consumer-llm-bundle/bin/generate.mjs tools/llm/
 *   node tools/llm/generate.mjs
 *
 * Flags:
 *   --output <path>   Output path. Default: ./vytches-ddd-context.md
 *   --root <path>     Project root (where node_modules lives). Default: cwd.
 *   --verbose         Print per-package status to stderr.
 *
 * Exit codes: 0 ok, 1 no @vytches/ddd-* packages found, 2 I/O error.
 */

import { readFileSync, readdirSync, writeFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { argv, exit, cwd, stderr } from 'node:process';

const args = parseArgs(argv.slice(2));
const projectRoot = resolve(args.root ?? cwd());
const outputPath = resolve(projectRoot, args.output ?? 'vytches-ddd-context.md');
const verbose = args.verbose === true;

const log = (msg) => {
  if (verbose) stderr.write(`[llm-bundle] ${msg}\n`);
};

const nodeModules = join(projectRoot, 'node_modules', '@vytches');
let entries;
try {
  entries = readdirSync(nodeModules);
} catch (error) {
  stderr.write(`[llm-bundle] cannot read ${nodeModules}: ${error.message}\n`);
  stderr.write('[llm-bundle] is @vytches/ddd installed in this project?\n');
  exit(1);
}

const packages = entries
  .filter((name) => name === 'ddd' || name.startsWith('ddd-'))
  .map((name) => {
    const dir = join(nodeModules, name);
    try {
      if (!statSync(dir).isDirectory()) return null;
    } catch {
      return null;
    }
    const pkgJson = readJsonSafe(join(dir, 'package.json'));
    const llmGuide = readFileSafe(join(dir, 'LLMGUIDE.md'));
    const readme = readFileSafe(join(dir, 'README.md'));
    return {
      name: pkgJson?.name ?? `@vytches/${name}`,
      version: pkgJson?.version ?? 'unknown',
      description: pkgJson?.description ?? '',
      llmGuide,
      readme,
    };
  })
  .filter((p) => p !== null)
  .sort(orderPackages);

if (packages.length === 0) {
  stderr.write(`[llm-bundle] no @vytches/ddd-* packages found under ${nodeModules}\n`);
  exit(1);
}

const sections = [];
sections.push(buildHeader(packages));
sections.push(buildIndex(packages));
for (const pkg of packages) {
  log(`including ${pkg.name}@${pkg.version}`);
  sections.push(buildPackageSection(pkg));
}
sections.push(buildFooter(packages));

const bundle = sections.join('\n\n---\n\n') + '\n';

try {
  writeFileSync(outputPath, bundle, 'utf8');
} catch (error) {
  stderr.write(`[llm-bundle] write failed: ${error.message}\n`);
  exit(2);
}

const sizeKb = Math.round(Buffer.byteLength(bundle, 'utf8') / 1024);
const tokenEst = Math.round(bundle.length / 4); // rough ~4 chars/token
log(`wrote ${outputPath} — ${packages.length} packages, ${sizeKb} KB, ~${tokenEst} tokens`);
process.stdout.write(
  `vytches-ddd-context: ${packages.length} packages -> ${relativeFrom(projectRoot, outputPath)} (${sizeKb} KB, ~${tokenEst} tokens)\n`
);

// ---------- helpers ----------

function parseArgs(input) {
  const out = {};
  for (let i = 0; i < input.length; i++) {
    const arg = input[i];
    if (arg === '--verbose') out.verbose = true;
    else if (arg === '--output' || arg === '-o') out.output = input[++i];
    else if (arg === '--root' || arg === '-r') out.root = input[++i];
    else if (arg === '--help' || arg === '-h') {
      stderr.write(
        'Usage: generate.mjs [--output <path>] [--root <project-root>] [--verbose]\n'
      );
      exit(0);
    }
  }
  return out;
}

function readJsonSafe(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function readFileSafe(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

function orderPackages(a, b) {
  // Foundation first, NestJS last, alphabetical in between.
  const order = (name) => {
    if (name === '@vytches/ddd') return 0;
    if (name === '@vytches/ddd-contracts') return 1;
    if (name === '@vytches/ddd-domain-primitives') return 2;
    if (name === '@vytches/ddd-utils') return 3;
    if (name === '@vytches/ddd-logging') return 4;
    if (name === '@vytches/ddd-nestjs') return 99;
    return 50;
  };
  const oa = order(a.name);
  const ob = order(b.name);
  if (oa !== ob) return oa - ob;
  return a.name.localeCompare(b.name);
}

function buildHeader(packages) {
  const versions = [...new Set(packages.map((p) => p.version))];
  const versionLabel = versions.length === 1 ? versions[0] : `mixed (${versions.join(', ')})`;
  const date = new Date().toISOString().slice(0, 10);
  return [
    `# @vytches/ddd — AI Assistant Context Bundle`,
    ``,
    `Generated **${date}** for project at \`${projectRoot}\` against \`@vytches/ddd@${versionLabel}\`.`,
    ``,
    `This file aggregates the per-package \`LLMGUIDE.md\` documents from every`,
    `installed \`@vytches/ddd-*\` package, plus the meta package \`@vytches/ddd\`.`,
    `Paste it into your AI assistant's context window once; the assistant can then`,
    `scaffold correct DDD code without re-reading individual files.`,
    ``,
    `**How to refresh**: re-run the generator after \`pnpm install\` / \`pnpm update\``,
    `to capture API changes from new library versions.`,
  ].join('\n');
}

function buildIndex(packages) {
  const rows = packages.map(
    (p) => `| \`${p.name}\` | \`${p.version}\` | ${p.description || '—'} |`
  );
  return [
    `## Installed packages`,
    ``,
    `| Package | Version | Description |`,
    `| ------- | ------- | ----------- |`,
    ...rows,
  ].join('\n');
}

function buildPackageSection(pkg) {
  const out = [];
  out.push(`## ${pkg.name}@${pkg.version}`);
  out.push('');

  if (pkg.llmGuide) {
    // Strip the leading H1 from LLMGUIDE.md — we already have one above.
    const stripped = pkg.llmGuide.replace(/^#\s.*$\n+/m, '').trim();
    out.push(stripped);
  } else if (pkg.readme) {
    out.push(`_(no LLMGUIDE.md — falling back to README)_`);
    out.push('');
    const stripped = pkg.readme.replace(/^#\s.*$\n+/m, '').trim();
    out.push(stripped);
  } else {
    out.push(`_(no LLMGUIDE.md or README.md found in ${pkg.name})_`);
  }
  return out.join('\n');
}

function buildFooter(packages) {
  return [
    `## Notes for the AI assistant`,
    ``,
    `- This bundle reflects the **versions installed at generation time**.`,
    `  When a feature is missing or shaped differently, ask the user to`,
    `  re-generate the bundle rather than guessing.`,
    `- Each package's public API surface is locked by an \`api-surface.test.ts\``,
    `  snapshot inside the published \`tests/__snapshots__/\` artefact (where`,
    `  shipped). New exports are intentional; do not remove existing ones.`,
    `- Every code-path failure should produce a \`Result<T, E>\`, not a thrown`,
    `  exception. Domain code that throws is treated as an anti-pattern by`,
    `  \`@vytches/ddd-lint\`.`,
    `- Aggregate state mutation must go through \`apply(eventName, payload)\` —`,
    `  never assign fields directly from outside an event handler.`,
    `- Library is **dependency-free at runtime**: do not suggest patterns that`,
    `  pull in ORM/DB adapters or saga orchestrators. Storage is implemented`,
    `  on the consumer side.`,
    ``,
    `Generated by \`@vytches/ddd-consumer-llm-bundle\`. Source:`,
    `\`tools/consumer-llm-bundle/bin/generate.mjs\` in the @vytches/ddd repo.`,
  ].join('\n');
}

function relativeFrom(root, target) {
  if (target.startsWith(root + '/')) return target.slice(root.length + 1);
  return target;
}
