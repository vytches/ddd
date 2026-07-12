#!/usr/bin/env node
/**
 * Post-bench step for @vytches/ddd-nestjs (VP-006b / Unit 2).
 *
 * Stamps benchmarks/results.json with a capture timestamp + git SHA and
 * archives a timestamped copy under benchmarks/history/, so successive runs
 * can be diffed for performance regressions against benchmarks/baseline.json.
 *
 * Dependency-free (Node stdlib only). Invoked by the `bench` npm script after
 * `vitest bench`. Per-run output (results.json, history/) is git-ignored;
 * only baseline.json is tracked.
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const resultsPath = resolve(here, 'results.json');

if (!existsSync(resultsPath)) {
  console.error('[bench] results.json not found — did `vitest bench` run?');
  process.exit(1);
}

const capturedAt = new Date().toISOString();
let gitSha = 'unknown';
try {
  gitSha = execSync('git rev-parse --short HEAD', { cwd: here }).toString().trim();
} catch {
  // not a git checkout / git unavailable — leave 'unknown'
}

const raw = JSON.parse(readFileSync(resultsPath, 'utf8'));
const stamped = { capturedAt, gitSha, ...raw };

writeFileSync(resultsPath, `${JSON.stringify(stamped, null, 2)}\n`);

const historyDir = resolve(here, 'history');
mkdirSync(historyDir, { recursive: true });
const stamp = capturedAt.replace(/[:.]/g, '-');
const archivePath = resolve(historyDir, `results-${stamp}.json`);
writeFileSync(archivePath, `${JSON.stringify(stamped, null, 2)}\n`);

console.log(`[bench] stamped results.json (capturedAt=${capturedAt}, git=${gitSha})`);
console.log(`[bench] archived → benchmarks/history/results-${stamp}.json`);
