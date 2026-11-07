import type { ModuleModel } from './module-model';

/** Where a name ultimately comes from. */
export type Origin =
  | { readonly kind: 'package'; readonly spec: string; readonly path: readonly string[] }
  | {
      readonly kind: 'project';
      /** File that declares the class or interface. */
      readonly file: string;
      readonly name: string;
      /** Every `${file}#${name}` hop (re-exports included) that led to the declaration. */
      readonly via: readonly string[];
    };

export interface OriginHost {
  model(file: string): ModuleModel | undefined;
  /** Project file for a specifier, or `undefined` when it is a package. */
  resolve(spec: string, fromFile: string): string | undefined;
}

const MAX_HOPS = 16;
const MAX_ORIGINS = 8;

/**
 * Follows `root.rest` in `file` through imports, local aliases and re-exports (named, `export *`,
 * `export * as ns`) down to a package export or a project declaration. `export *` from several
 * sources can yield several candidates; callers accept a match on any of them.
 */
export function resolveName(
  host: OriginHost,
  file: string,
  model: ModuleModel,
  root: string,
  rest: readonly string[],
  via: readonly string[] = [],
  hops = 0
): Origin[] {
  if (hops > MAX_HOPS) return [];
  const imp = model.imports.get(root);
  if (imp) return followImport(host, file, imp.source, [...imp.path, ...rest], via, hops + 1);
  const alias = model.aliases.get(root);
  if (alias && alias.root !== root) {
    return resolveName(host, file, model, alias.root, [...alias.rest, ...rest], via, hops + 1);
  }
  if (model.locals.has(root) && rest.length === 0) {
    return [{ kind: 'project', file, name: root, via: [...via, `${file}#${root}`] }];
  }
  return [];
}

function followImport(
  host: OriginHost,
  fromFile: string,
  spec: string,
  path: readonly string[],
  via: readonly string[],
  hops: number
): Origin[] {
  const target = host.resolve(spec, fromFile);
  if (!target) return [{ kind: 'package', spec, path }];
  return lookupExport(host, target, path, via, hops);
}

export function lookupExport(
  host: OriginHost,
  file: string,
  path: readonly string[],
  via: readonly string[],
  hops: number
): Origin[] {
  const [name, ...rest] = path;
  if (name === undefined || hops > MAX_HOPS) return [];
  const model = host.model(file);
  if (!model) return [];
  const hop = [...via, `${file}#${name}`];
  const entry = model.exports.get(name);
  if (entry?.kind === 'local') {
    return resolveName(host, file, model, entry.local, rest, hop, hops + 1);
  }
  if (entry?.kind === 'from') {
    return followImport(host, file, entry.source, [...entry.path, ...rest], hop, hops + 1);
  }
  const out: Origin[] = [];
  for (const star of model.stars) {
    out.push(...followImport(host, file, star, path, via, hops + 1));
    if (out.length >= MAX_ORIGINS) break;
  }
  return out;
}
