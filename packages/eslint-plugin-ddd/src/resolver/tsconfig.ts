import { dirname, isAbsolute, join, resolve } from 'node:path';
import { parseJsonc } from './jsonc';
import type { ResolverFs, ResolverWarning } from './types';

export interface PathMapping {
  readonly prefix: string;
  readonly suffix: string;
  readonly wildcard: boolean;
  /** Absolute target patterns; a single `*` marks the substitution point. */
  readonly targets: readonly string[];
}

export interface TsconfigPaths {
  readonly baseUrl: string | undefined;
  /** Longest prefix first (TypeScript picks the longest matching pattern). */
  readonly mappings: readonly PathMapping[];
}

interface Layer {
  baseUrl?: string;
  paths?: { map: Record<string, string[]>; dir: string };
}

const MAX_EXTENDS_DEPTH = 10;

function readJson(file: string, fs: ResolverFs): Record<string, unknown> {
  const text = fs.readFile(file);
  if (text === undefined) throw new Error(`cannot read ${file}`);
  const parsed = parseJsonc(text);
  if (typeof parsed !== 'object' || parsed === null) throw new Error(`${file} is not an object`);
  return parsed as Record<string, unknown>;
}

function resolveExtends(spec: string, fromDir: string, fs: ResolverFs): string | undefined {
  const isFile = (p: string) => fs.stat(p)?.isFile === true;
  const withExt = (base: string): string | undefined =>
    [base, `${base}.json`, join(base, 'tsconfig.json')].find(isFile);
  if (spec.startsWith('.') || isAbsolute(spec)) return withExt(resolve(fromDir, spec));
  for (let dir = fromDir; ; dir = dirname(dir)) {
    const hit = withExt(join(dir, 'node_modules', spec));
    if (hit) return hit;
    if (dirname(dir) === dir) return undefined;
  }
}

function readLayer(file: string, fs: ResolverFs, depth: number, seen: Set<string>): Layer {
  if (depth > MAX_EXTENDS_DEPTH || seen.has(file)) return {};
  seen.add(file);
  const json = readJson(file, fs);
  const dir = dirname(file);
  const layer: Layer = {};
  const ext = json['extends'];
  const parents = typeof ext === 'string' ? [ext] : Array.isArray(ext) ? ext : [];
  for (const parent of parents) {
    if (typeof parent !== 'string') continue;
    const parentFile = resolveExtends(parent, dir, fs);
    if (!parentFile) continue;
    const inherited = readLayer(parentFile, fs, depth + 1, seen);
    if (inherited.baseUrl !== undefined) layer.baseUrl = inherited.baseUrl;
    if (inherited.paths) layer.paths = inherited.paths;
  }
  const opts = json['compilerOptions'];
  if (typeof opts === 'object' && opts !== null) {
    const o = opts as Record<string, unknown>;
    if (typeof o['baseUrl'] === 'string') layer.baseUrl = resolve(dir, o['baseUrl']);
    if (typeof o['paths'] === 'object' && o['paths'] !== null) {
      layer.paths = { map: o['paths'] as Record<string, string[]>, dir };
    }
  }
  return layer;
}

function compile(layer: Layer): TsconfigPaths {
  const base = layer.baseUrl ?? layer.paths?.dir;
  const mappings: PathMapping[] = [];
  if (layer.paths && base) {
    for (const [key, targets] of Object.entries(layer.paths.map)) {
      if (!Array.isArray(targets)) continue;
      const star = key.indexOf('*');
      mappings.push({
        prefix: star === -1 ? key : key.slice(0, star),
        suffix: star === -1 ? '' : key.slice(star + 1),
        wildcard: star !== -1,
        targets: targets.filter(t => typeof t === 'string').map(t => resolve(base, t)),
      });
    }
  }
  mappings.sort((a, b) => b.prefix.length - a.prefix.length);
  return { baseUrl: layer.baseUrl, mappings };
}

/** Reads `paths`/`baseUrl` following the whole `extends` chain. Never throws. */
export function loadTsconfigPaths(
  cwd: string,
  fs: ResolverFs,
  tsconfig: string | false | undefined,
  warn: (w: ResolverWarning) => void
): TsconfigPaths {
  if (tsconfig === false) return { baseUrl: undefined, mappings: [] };
  const file = resolve(cwd, tsconfig ?? 'tsconfig.json');
  if (!fs.stat(file)) return { baseUrl: undefined, mappings: [] };
  try {
    return compile(readLayer(file, fs, 0, new Set()));
  } catch (error) {
    warn({
      code: 'tsconfig',
      file,
      message: error instanceof Error ? error.message : String(error),
    });
    return { baseUrl: undefined, mappings: [] };
  }
}
