import { dirname, isAbsolute, resolve } from 'node:path';
import { nodeFs } from '../../resolver/node-fs';
import { isLibraryPackageName } from './library-packages';

const nameByDir = new Map<string, string | null>();

function packageNameIn(dir: string): string | undefined {
  const text = nodeFs.readFile(resolve(dir, 'package.json'));
  if (text === undefined) return undefined;
  try {
    const name = (JSON.parse(text) as { name?: unknown }).name;
    return typeof name === 'string' ? name : '';
  } catch {
    return '';
  }
}

/** `name` of the nearest `package.json` above `dir`, or `null` when there is none. */
function nearestPackageName(dir: string): string | null {
  const cached = nameByDir.get(dir);
  if (cached !== undefined) return cached;
  const here = packageNameIn(dir);
  const parent = dirname(dir);
  const name = here ?? (parent === dir ? null : nearestPackageName(parent));
  nameByDir.set(dir, name);
  return name;
}

/**
 * True when `filename` belongs to a package of the library itself (the nearest `package.json`
 * is `@vytches/ddd` or `@vytches/ddd-*`). Library packages reach each other through internal
 * subpaths on purpose, so the import rules do not apply to them.
 */
export function isLibraryOwnFile(filename: string, cwd: string): boolean {
  const file = isAbsolute(filename) ? filename : resolve(cwd, filename);
  const name = nearestPackageName(dirname(file));
  return name !== null && isLibraryPackageName(name);
}

/**
 * Drops the cached package names.
 *
 * The cache lives for the whole process and is keyed by directory (the starting directory and
 * each parent visited on the way up), so a long-lived editor or LSP process keeps seeing the
 * package name it first read until this is called or the process restarts.
 */
export function resetOwnPackageCache(): void {
  nameByDir.clear();
}
