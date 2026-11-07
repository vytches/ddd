import { dirname, resolve } from 'node:path';
import type { ResolverFs } from './types';
import type { TsconfigPaths } from './tsconfig';

const TS_EXTENSIONS = ['.ts', '.tsx', '.d.ts', '.mts', '.cts'] as const;
const JS_TO_TS: Readonly<Record<string, readonly string[]>> = {
  '.js': ['.ts', '.tsx', '.d.ts'],
  '.jsx': ['.tsx'],
  '.mjs': ['.mts', '.d.mts'],
  '.cjs': ['.cts', '.d.cts'],
};

/** True for a binding/specifier that names a TypeScript source file. */
export function isTsFileSpecifier(spec: string): boolean {
  return /\.(?:d\.)?[cm]?tsx?$/.test(spec);
}

export function tryResolveFile(base: string, fs: ResolverFs): string | undefined {
  const isFile = (p: string) => fs.stat(p)?.isFile === true;
  const jsExt = /\.(?:jsx?|[cm]js)$/.exec(base)?.[0];
  const candidates: string[] = [];
  if (jsExt) {
    const stem = base.slice(0, -jsExt.length);
    for (const ext of JS_TO_TS[jsExt] ?? []) candidates.push(stem + ext);
  }
  if (isTsFileSpecifier(base)) candidates.push(base);
  for (const ext of TS_EXTENSIONS) candidates.push(base + ext);
  for (const ext of TS_EXTENSIONS) candidates.push(`${base}/index${ext}`);
  return candidates.find(isFile);
}

function candidateBases(spec: string, fromFile: string, paths: TsconfigPaths): string[] {
  if (spec.startsWith('.')) return [resolve(dirname(fromFile), spec)];
  for (const m of paths.mappings) {
    if (!m.wildcard) {
      if (spec === m.prefix) return [...m.targets];
      continue;
    }
    if (
      spec.length >= m.prefix.length + m.suffix.length &&
      spec.startsWith(m.prefix) &&
      spec.endsWith(m.suffix)
    ) {
      const star = spec.slice(m.prefix.length, spec.length - m.suffix.length);
      return m.targets.map(t => t.replace('*', () => star));
    }
  }
  return paths.baseUrl ? [resolve(paths.baseUrl, spec)] : [];
}

/**
 * Resolves an import specifier to a project source file (relative path, tsconfig `paths`
 * alias with every target tried, or bare path under `baseUrl`). `undefined` means "not a
 * project file", i.e. a package.
 */
export function resolveProjectFile(
  spec: string,
  fromFile: string,
  paths: TsconfigPaths,
  fs: ResolverFs,
  cache: Map<string, string | undefined>
): string | undefined {
  const bases = candidateBases(spec, fromFile, paths);
  for (const base of bases) {
    if (cache.has(base)) {
      const hit = cache.get(base);
      if (hit) return hit;
      continue;
    }
    const hit = tryResolveFile(base, fs);
    cache.set(base, hit);
    if (hit) return hit;
  }
  return undefined;
}
