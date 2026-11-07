import { isAbsolute, relative, resolve, sep } from 'node:path';
import type { RoleName } from '../roles';
import { heritageOf, modelFromProgram } from './ast-model';
import { compileBindings, targetMatches, type CompiledBinding } from './compile-bindings';
import { checkBindings as runCheckBindings } from './check-bindings';
import type { HeritageRef, ModuleModel } from './module-model';
import { nodeFs } from './node-fs';
import { resolveName, type Origin, type OriginHost } from './origin';
import { scopeOf, substitute, type Scope } from './scopes';
import { modelFromText } from './scan-model';
import { resolveProjectFile } from './specifier';
import { loadTsconfigPaths, type TsconfigPaths } from './tsconfig';
import type {
  AstNode,
  ClassRoles,
  ResolverWarning,
  RoleResolver,
  RoleResolverOptions,
} from './types';

const DEFAULT_MAX_DEPTH = 6;
const MAX_WARNINGS = 100;
const SKIP_KEYS = new Set(['parent', 'loc', 'range', 'tokens', 'comments']);
const CLASS_WORD = /\bclass\b/;

/**
 * Creates a role resolver (untyped tier: a single file's AST plus text-scanned project files).
 * A class has a role when it extends/implements a bound base, carries a bound decorator, lives
 * in a file matching a glob binding, or inherits one of these through project classes.
 *
 * @beta
 * @since 0.32.0
 */
export function createRoleResolver(options: RoleResolverOptions): RoleResolver {
  const cwd = resolve(options.cwd);
  const fs = options.fs ?? nodeFs;
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const warnings: ResolverWarning[] = [];
  const warn = (w: ResolverWarning) => {
    if (warnings.length < MAX_WARNINGS) warnings.push(w);
    options.onWarning?.(w);
  };

  const compiled: CompiledBinding[] = compileBindings(
    cwd,
    fs,
    options.bindings ?? [],
    options.includeLibraryRoles !== false
  );

  let paths: TsconfigPaths | undefined;
  let specCache = new Map<string, string | undefined>();
  let models = new Map<string, { mtimeMs: number; model: ModuleModel }>();
  let missing = new Set<string>();
  let classified = new WeakMap<AstNode, readonly ClassRoles[]>();

  const getPaths = (): TsconfigPaths =>
    (paths ??= loadTsconfigPaths(cwd, fs, options.tsconfig, warn));

  const host: OriginHost = {
    model(file) {
      if (missing.has(file)) return undefined;
      const st = fs.stat(file);
      if (!st?.isFile) {
        missing.add(file);
        models.delete(file);
        return undefined;
      }
      const cached = models.get(file);
      if (cached && cached.mtimeMs === st.mtimeMs) return cached.model;
      const text = fs.readFile(file);
      if (text === undefined) {
        missing.add(file);
        return undefined;
      }
      const model = modelFromText(text);
      models.set(file, { mtimeMs: st.mtimeMs, model });
      return model;
    },
    resolve(spec, fromFile) {
      return resolveProjectFile(spec, fromFile, getPaths(), fs, specCache);
    },
  };

  function addMatches(origin: Origin, decorator: boolean, roles: Set<RoleName>): void {
    for (const b of compiled) {
      const targets = decorator ? b.decorators : b.bases;
      if (targets.some(t => targetMatches(origin, t, b.library))) {
        roles.add(b.role);
        for (const extra of b.implies) roles.add(extra);
      }
    }
  }

  function collect(
    file: string,
    model: ModuleModel,
    refs: readonly HeritageRef[],
    selfFile: string,
    selfModel: ModuleModel,
    roles: Set<RoleName>,
    visited: Set<string>,
    depth: number
  ): void {
    for (const ref of refs) {
      for (const origin of resolveName(host, file, model, ref.root, ref.rest)) {
        addMatches(origin, ref.kind === 'decorator', roles);
        if (origin.kind !== 'project') continue;
        const key = `${origin.file}#${origin.name}`;
        if (visited.has(key)) continue;
        visited.add(key);
        if (depth + 1 > maxDepth) {
          warn({ code: 'max-depth', file: origin.file, name: origin.name });
          continue;
        }
        const declModel = origin.file === selfFile ? selfModel : host.model(origin.file);
        const decl = declModel?.locals.get(origin.name);
        if (declModel && decl) {
          collect(
            origin.file,
            declModel,
            decl.heritage,
            selfFile,
            selfModel,
            roles,
            visited,
            depth + 1
          );
        }
      }
    }
  }

  function rolesOfClass(
    node: AstNode,
    scopes: readonly Scope[],
    file: string,
    model: ModuleModel,
    fileRoles: readonly RoleName[]
  ): ReadonlySet<RoleName> {
    const roles = new Set<RoleName>(fileRoles);
    const refs: HeritageRef[] = [];
    for (const h of heritageOf(node)) {
      const s = substitute(scopes, h.root, h.rest);
      if (s) refs.push({ kind: h.kind, root: s.root, rest: s.rest });
    }
    const name = (node['id'] as AstNode | null)?.['name'] as string | undefined;
    const visited = new Set<string>(name ? [`${file}#${name}`] : []);
    collect(file, model, refs, file, model, roles, visited, 0);
    return roles;
  }

  function classify(
    program: AstNode,
    filename: string,
    sourceText?: string
  ): readonly ClassRoles[] {
    if (sourceText !== undefined && !CLASS_WORD.test(sourceText)) return [];
    const hit = classified.get(program);
    if (hit) return hit;
    const file = isAbsolute(filename) ? filename : resolve(cwd, filename);
    const rel = relative(cwd, file).split(sep).join('/');
    const fileRoles = compiled
      .filter(b => b.fileRe?.test(rel))
      .flatMap(b => [b.role, ...b.implies]);
    const model = modelFromProgram(program);
    const out: ClassRoles[] = [];
    const walk = (node: AstNode, scopes: readonly Scope[]): void => {
      const scope = scopeOf(node);
      const inner = scope ? [...scopes, scope] : scopes;
      if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') {
        const id = node['id'] as AstNode | null;
        out.push({
          node,
          name: id ? (id['name'] as string) : '<anonymous>',
          roles: rolesOfClass(node, scopes, file, model, fileRoles),
        });
      }
      for (const key of Object.keys(node)) {
        if (SKIP_KEYS.has(key)) continue;
        const value: unknown = node[key];
        if (Array.isArray(value)) {
          for (const v of value) if (isNode(v)) walk(v, inner);
        } else if (isNode(value)) walk(value, inner);
      }
    };
    walk(program, []);
    classified.set(program, out);
    return out;
  }

  return {
    classify,
    checkBindings: () => runCheckBindings({ compiled, cwd, fs, host }),
    reset() {
      paths = undefined;
      specCache = new Map();
      models = new Map();
      missing = new Set();
      classified = new WeakMap();
      warnings.length = 0;
    },
    get warnings() {
      return warnings;
    },
  };
}

function isNode(v: unknown): v is AstNode {
  return typeof v === 'object' && v !== null && typeof (v as { type?: unknown }).type === 'string';
}
