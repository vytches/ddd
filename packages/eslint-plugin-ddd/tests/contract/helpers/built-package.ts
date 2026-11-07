import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Root of `packages/eslint-plugin-ddd`. */
export const PACKAGE_DIR = resolve(HERE, '..', '..', '..');
/** Build output the fixture consumer and the cold-process measurement load. */
export const DIST_DIR = join(PACKAGE_DIR, 'dist');
export const DIST_ESM_ENTRY = join(DIST_DIR, 'index.js');
export const DIST_AGENT_ENTRY = join(DIST_DIR, 'agent.js');

const BUILD_TIMEOUT_MS = 180_000;
const SOURCE_FILE = /\.(?:ts|json)$/;

function newestSourceMtime(dir: string): number {
  let newest = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) newest = Math.max(newest, newestSourceMtime(path));
    else if (SOURCE_FILE.test(entry.name)) newest = Math.max(newest, statSync(path).mtimeMs);
  }
  return newest;
}

function isDistCurrent(): boolean {
  if (!existsSync(DIST_ESM_ENTRY) || !existsSync(DIST_AGENT_ENTRY)) return false;
  const builtAt = Math.min(statSync(DIST_ESM_ENTRY).mtimeMs, statSync(DIST_AGENT_ENTRY).mtimeMs);
  const sourceAt = Math.max(
    newestSourceMtime(join(PACKAGE_DIR, 'src')),
    statSync(join(PACKAGE_DIR, 'package.json')).mtimeMs
  );
  return builtAt >= sourceAt;
}

/**
 * Makes sure `dist/` exists and is not older than the sources, building it with the package's own
 * `vite build` otherwise. The CI job builds before testing, so this is a no-op there; locally it
 * keeps the test from judging a stale or missing build. A failed build throws with the build
 * output: there is no silent skip, because a skipped consumer test proves nothing (LT7).
 */
export function ensureBuiltPackage(): void {
  if (isDistCurrent()) return;
  const requireFromPackage = createRequire(join(PACKAGE_DIR, 'package.json'));
  const viteBin = join(dirname(requireFromPackage.resolve('vite/package.json')), 'bin', 'vite.js');
  const result = spawnSync(process.execPath, [viteBin, 'build'], {
    cwd: PACKAGE_DIR,
    encoding: 'utf8',
    timeout: BUILD_TIMEOUT_MS,
  });
  if (result.status !== 0 || !isDistCurrent()) {
    throw new Error(
      `dist/ is missing or stale and \`vite build\` did not produce it (exit ${String(result.status)}).\n` +
        `${result.stdout}\n${result.stderr}\n${result.error?.message ?? ''}`
    );
  }
}

/** Path of the real ESLint CLI script the package resolves (the peer a consumer installs). */
export function eslintCliPath(): string {
  const requireFromPackage = createRequire(join(PACKAGE_DIR, 'package.json'));
  return join(dirname(requireFromPackage.resolve('eslint/package.json')), 'bin', 'eslint.js');
}
