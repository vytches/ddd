#!/usr/bin/env node
// VF-001 MVP — ddd-lint CLI entry point.
//
// Usage: ddd-lint [path]
//   path  Directory to scan (default: current working directory).
//
// Exit codes:
//   0 — no errors (warnings allowed)
//   1 — at least one error-severity violation
//   2 — argument or filesystem error

import { resolve } from 'node:path';
import { existsSync, statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const targetArg = args[0] ?? '.';
const target = resolve(process.cwd(), targetArg);

if (!existsSync(target) || !statSync(target).isDirectory()) {
  console.error(`ddd-lint: path is not a directory: ${target}`);
  process.exit(2);
}

// Resolve runtime — prefer the built dist/ if present, otherwise import the
// source via ts-node-style ESM loader. For the MVP we use `tsx` indirectly
// by relying on the workspace pnpm resolution; if you ship this as a real
// CLI, build with tsup/tsc first.
const distEntry = join(__dirname, '..', 'dist', 'index.js');
const srcEntry = join(__dirname, '..', 'src', 'index.ts');

const { runLint, formatResult } = await import(
  pathToFileURL(existsSync(distEntry) ? distEntry : srcEntry).href
);

const result = runLint({ root: target });
console.log(formatResult(result));

const hasError = result.issues.some(i => i.severity === 'error');
process.exit(hasError ? 1 : 0);
