#!/usr/bin/env node
// Run before `lerna version` (pnpm release:preflight). Stops the release, with the reason,
// when lerna would compute versions and changelogs from the wrong starting point.
//
// Why this exists: lerna decides "what changed since the last release" from the last tag it
// can reach. When that tag is not the one for the version in lerna.json, nothing fails: you
// get a changelog that repeats work already released, and all packages marked as changed.
// That is exactly what happened after v0.32.0 (squash merge, see docs/RELEASE-GUIDE.md,
// section "Process pitfalls"). This script turns that silent mistake into a loud one.
//
// It mirrors how lerna looks for the tag: annotated tags only (no `--tags`), and across
// merge commits (lerna.json sets includeMergedTags; lerna's default is `--first-parent`).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const GUIDE = 'docs/RELEASE-GUIDE.md, section "Process pitfalls"';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const gitOrNull = (...args) => {
  try {
    return git(...args);
  } catch {
    return null;
  }
};

/**
 * @param {{ dirty: boolean, version: string, annotatedTag: string | null,
 *           anyTag: string | null, versionConfig: Record<string, unknown> }} state
 * @returns {string[]} problems; empty when the release can go ahead
 */
export function evaluate(state) {
  const problems = [];
  const expected = `v${state.version}`;

  if (state.dirty) {
    problems.push('The working tree has uncommitted changes. Commit or stash them first.');
  }
  if (state.versionConfig.includeMergedTags !== true) {
    problems.push(
      'lerna.json: command.version.includeMergedTags must be true. Without it lerna ignores ' +
        'a tag that sits on a merged release branch and takes an older one.'
    );
  }
  if (state.annotatedTag === null) {
    problems.push(`No annotated tag matching v<version> is reachable from HEAD (expected ${expected}).`);
  } else if (state.annotatedTag !== expected) {
    problems.push(
      `The last annotated tag reachable from HEAD is ${state.annotatedTag}, but lerna.json says ` +
        `${state.version} (expected ${expected}). Lerna would compute changes and changelogs ` +
        `from ${state.annotatedTag}. Most likely the release PR for ${expected} was ` +
        'squash-merged, so its tag is not in the history of this branch.'
    );
  }
  if (state.anyTag !== null && state.anyTag !== state.annotatedTag) {
    problems.push(
      `The nearest tag is ${state.anyTag}, but it is a lightweight tag, which lerna ignores. ` +
        'Create tags with `git tag -a`.'
    );
  }
  return problems;
}

function main() {
  const lerna = JSON.parse(readFileSync('lerna.json', 'utf8'));
  const problems = evaluate({
    dirty: git('status', '--porcelain') !== '',
    version: lerna.version,
    annotatedTag: gitOrNull('describe', '--abbrev=0', '--match', 'v[0-9]*'),
    anyTag: gitOrNull('describe', '--tags', '--abbrev=0', '--match', 'v[0-9]*'),
    versionConfig: lerna.command?.version ?? {},
  });

  if (problems.length === 0) {
    console.log(`release preflight: OK (lerna.json ${lerna.version}, last tag v${lerna.version})`);
    return;
  }
  console.error('release preflight: STOP\n');
  for (const problem of problems) console.error(` - ${problem}`);
  console.error(`\nSee ${GUIDE}.`);
  process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) main();
