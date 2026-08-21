#!/usr/bin/env node
/**
 * Retired-symbol gate (VB-008 AC5.5 / D12.5).
 *
 * Fails the build when docs or examples reference an API that does not exist.
 *
 * Why this exists rather than relying on `docs-compile-gate:check`: that gate is
 * opt-in per fence — a snippet only gets compiled if someone remembered to tag
 * its info string with `compile-check`. Nobody did, on any of the three phantom
 * APIs VB-008 found, so all three shipped. This gate needs no per-snippet
 * discipline: once a name is retired (or established as never having existed),
 * every remaining reference to it is dead by construction, and a plain scan
 * finds them.
 *
 * Deliberately a deny-list, not a live import check: it runs without a build,
 * in milliseconds, on docs that reference packages which may not compile yet.
 * The trade-off is that a name is only caught once it is listed here — so
 * whenever you rename or remove a public symbol, add the old name below in the
 * same commit.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/**
 * Each entry is a name that must not appear in docs or examples.
 * `replacement` is printed to the developer, so keep it actionable.
 */
const RETIRED = [
  {
    symbol: 'PolicyTemporalBehaviorFactory.forBusinessHours',
    replacement: 'PolicyTemporalBehaviorFactory.businessHours()',
    reason: 'never existed — the factory preset is named businessHours (VB-008)',
  },
  {
    symbol: 'PolicyTemporalBehaviorFactory.forWorkingDays',
    replacement:
      'PolicyTemporalBehaviorBuilder.from(policy).withWorkingDays([...]).duringWeekends(...).build()',
    reason: 'never existed — the factory has exactly three presets (VB-008)',
  },
  {
    symbol: 'PolicyCachingBehaviorFactory.create',
    replacement: 'PolicyCachingBehavior.create(policy, config?)',
    reason: 'never existed on the factory — create() is a static on the behaviour class (VB-008)',
  },
];

/** Human-facing docs plus the examples workspace. */
const INCLUDE_FILE = (p) =>
  p.endsWith('README.md') ||
  p.endsWith('LLMGUIDE.md') ||
  (p.includes(`${join('examples')}${'/'}`) && (p.endsWith('.ts') || p.endsWith('.md')));

// `.claude` holds stale agent worktrees — full copies of the repo frozen at
// whatever state an agent ran against. Scanning them reports long-fixed
// findings as live ones.
const SKIP_DIR = new Set([
  'node_modules',
  'dist',
  '.git',
  '.nx',
  '.claude',
  'coverage',
  '.changeset',
  'tmp',
]);

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (SKIP_DIR.has(name)) continue;
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(full, out);
    else if (INCLUDE_FILE(full)) out.push(full);
  }
  return out;
}

const findings = [];
for (const file of walk(ROOT)) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    for (const entry of RETIRED) {
      // Substring match on purpose: `X.y(`, `X.y ` and a prose mention are all
      // equally wrong once the name is retired.
      if (line.includes(entry.symbol)) {
        findings.push({ file: relative(ROOT, file), line: i + 1, text: line.trim(), entry });
      }
    }
  });
}

if (findings.length === 0) {
  console.log(`retired-symbol gate: OK (${RETIRED.length} names watched)`);
  process.exit(0);
}

console.error(`\nretired-symbol gate: ${findings.length} reference(s) to APIs that do not exist\n`);
for (const f of findings) {
  console.error(`  ${f.file}:${f.line}`);
  console.error(`    ${f.text}`);
  console.error(`    x ${f.entry.symbol} — ${f.entry.reason}`);
  console.error(`    -> use ${f.entry.replacement}\n`);
}
process.exit(1);
