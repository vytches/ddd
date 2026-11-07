import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const SKIPPED_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'out',
  'coverage',
  '.git',
  '.nx',
  '.next',
  '.turbo',
]);
const SOURCE_FILE = /\.(?:[cm]?ts|tsx)$/;

/** Lists project source files under `root`, skipping build output and declaration files. */
export function listSourceFiles(root: string, limit = 50_000): string[] {
  const out: string[] = [];
  const visit = (dir: string): void => {
    if (out.length >= limit) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (!SKIPPED_DIRS.has(e.name)) visit(join(dir, e.name));
      } else if (SOURCE_FILE.test(e.name) && !e.name.endsWith('.d.ts')) {
        out.push(join(dir, e.name));
      }
    }
  };
  visit(root);
  return out;
}
