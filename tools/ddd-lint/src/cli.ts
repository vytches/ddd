/**
 * VF-001 MVP — ddd-lint CLI entry point (tsx-runnable).
 *
 * Usage: tsx tools/ddd-lint/src/cli.ts [path]
 *   path  Directory to scan (default: current working directory).
 *
 * Exit codes:
 *   0 — no errors (warnings allowed)
 *   1 — at least one error-severity violation
 *   2 — argument or filesystem error
 */

import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

import { runLint, formatResult } from './runner.js';

const args = process.argv.slice(2);
const targetArg = args[0] ?? '.';
const target = resolve(process.cwd(), targetArg);

if (!existsSync(target) || !statSync(target).isDirectory()) {
  console.error(`ddd-lint: path is not a directory: ${target}`);
  process.exit(2);
}

const result = runLint({ root: target });
console.log(formatResult(result));

const hasError = result.issues.some(i => i.severity === 'error');
process.exit(hasError ? 1 : 0);
