#!/usr/bin/env node

/**
 * LLM Guides Coverage Check
 *
 * Ensures every package with `src/index.ts` ships an `LLMGUIDE.md` and
 * that file is included in `package.json` `files[]` so it gets published
 * to npm.
 *
 * Usage:
 *   node scripts/llm-guides-check.mjs           # Report missing guides
 *   node scripts/llm-guides-check.mjs --strict   # Exit 1 on any missing
 *
 * Added in REL-010 (2026-05-09) to gate the LLM-first DX guarantee:
 * if a package is published, its AI-assistant guide must ship with it.
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), '..');
const PACKAGES = join(ROOT, 'packages');
const strict = process.argv.includes('--strict');

const C = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

const issues = [];
const ok = [];

for (const name of readdirSync(PACKAGES)) {
  const pkgDir = join(PACKAGES, name);
  const indexPath = join(pkgDir, 'src/index.ts');
  if (!existsSync(indexPath)) continue; // skip non-publishable folders

  const guidePath = join(pkgDir, 'LLMGUIDE.md');
  const pkgJsonPath = join(pkgDir, 'package.json');

  if (!existsSync(guidePath)) {
    issues.push(`${name}: missing LLMGUIDE.md`);
    continue;
  }

  if (!existsSync(pkgJsonPath)) {
    issues.push(`${name}: missing package.json`);
    continue;
  }

  const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
  const files = pkgJson.files ?? [];
  if (!files.includes('LLMGUIDE.md')) {
    issues.push(
      `${name}: LLMGUIDE.md exists but is NOT in package.json files[] — it will not be published`
    );
    continue;
  }

  // Optional: warn if guide is suspiciously small
  const content = readFileSync(guidePath, 'utf-8');
  if (content.length < 500) {
    issues.push(
      `${name}: LLMGUIDE.md is suspiciously short (${content.length} chars) — likely incomplete`
    );
    continue;
  }

  ok.push(name);
}

console.log(`${C.cyan}LLM Guides Coverage${C.reset}`);
console.log(`${C.dim}─────────────────────${C.reset}`);
console.log(`${C.green}✓ ${ok.length} packages OK${C.reset}`);
ok.forEach((n) => console.log(`  ${C.dim}${n}${C.reset}`));

if (issues.length > 0) {
  console.log();
  console.log(`${C.yellow}⚠ ${issues.length} issues${C.reset}`);
  issues.forEach((msg) => console.log(`  ${C.yellow}${msg}${C.reset}`));
}

if (strict && issues.length > 0) {
  console.log();
  console.log(`${C.red}✗ Strict mode: failing due to ${issues.length} issue(s)${C.reset}`);
  process.exit(1);
}

if (issues.length === 0) {
  console.log();
  console.log(`${C.green}All packages have a published LLMGUIDE.md.${C.reset}`);
}
