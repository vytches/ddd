import { isAbsolute, resolve } from 'node:path';
import { ENTERPRISE_PACKAGE, LIBRARY_ROLES, type BindingTarget, type RoleName } from '../roles';
import { globToRegExp } from './glob';
import { isTsFileSpecifier, tryResolveFile } from './specifier';
import type { Origin } from './origin';
import type { ResolverFs, RoleBinding } from './types';

export type CompiledTarget =
  | { readonly kind: 'package'; readonly from: string; readonly name: string }
  | { readonly kind: 'file'; readonly file: string; readonly name: string; readonly from: string };

export interface CompiledBinding {
  readonly role: RoleName;
  readonly library: boolean;
  readonly bases: readonly CompiledTarget[];
  readonly decorators: readonly CompiledTarget[];
  readonly fileRe: RegExp | null;
  readonly implies: readonly RoleName[];
  readonly raw: RoleBinding | null;
}

const asArray = <T>(v: T | readonly T[] | undefined): readonly T[] =>
  v === undefined ? [] : Array.isArray(v) ? (v as readonly T[]) : [v as T];

export function compileTarget(cwd: string, fs: ResolverFs, t: BindingTarget): CompiledTarget {
  if (!isTsFileSpecifier(t.from)) return { kind: 'package', from: t.from, name: t.name };
  const abs = isAbsolute(t.from) ? t.from : resolve(cwd, t.from);
  return { kind: 'file', file: tryResolveFile(abs, fs) ?? abs, name: t.name, from: t.from };
}

function safeGlob(glob: string): RegExp | null {
  try {
    return globToRegExp(glob);
  } catch {
    return null;
  }
}

export function compileBindings(
  cwd: string,
  fs: ResolverFs,
  project: readonly RoleBinding[],
  includeLibrary: boolean
): CompiledBinding[] {
  const out: CompiledBinding[] = [];
  const compile = (ts: readonly BindingTarget[]) => ts.map(t => compileTarget(cwd, fs, t));
  if (includeLibrary) {
    for (const def of LIBRARY_ROLES) {
      out.push({
        role: def.role,
        library: true,
        bases: compile(def.bases),
        decorators: compile(def.decorators),
        fileRe: null,
        implies: [],
        raw: null,
      });
    }
  }
  for (const b of project) {
    out.push({
      role: b.role,
      library: false,
      bases: compile([...asArray(b.extends), ...asArray(b.implements)]),
      decorators: compile(asArray(b.decorator)),
      fileRe: b.files === undefined ? null : safeGlob(b.files),
      implies: b.implies ?? [],
      raw: b,
    });
  }
  return out;
}

export function targetMatches(origin: Origin, target: CompiledTarget, library: boolean): boolean {
  if (target.kind === 'file') {
    return origin.kind === 'project' && origin.via.includes(`${target.file}#${target.name}`);
  }
  if (origin.kind !== 'package' || origin.path.length !== 1 || origin.path[0] !== target.name) {
    return false;
  }
  const spec = origin.spec;
  if (spec === target.from || spec.startsWith(`${target.from}/`)) return true;
  return library && (spec === ENTERPRISE_PACKAGE || spec.startsWith(`${ENTERPRISE_PACKAGE}/`));
}
