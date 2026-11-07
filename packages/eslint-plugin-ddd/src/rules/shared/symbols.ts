import { isAbsolute, resolve } from 'node:path';
import type { Rule } from 'eslint';
import { expressionPath, modelFromProgram } from '../../resolver/ast-model';
import type { ModuleModel } from '../../resolver/module-model';
import { resolveName } from '../../resolver/origin';
import { scopeOf, substitute, type Scope } from '../../resolver/scopes';
import type { AstNode } from '../../resolver/types';
import { parseLibrarySpecifier } from './library-packages';
import { createOriginHost } from './origin-host';

/** A reference that ultimately points at an export of a library package. */
export interface LibrarySymbol {
  /** Library package the symbol was imported from, e.g. `@vytches/ddd-value-objects`. */
  readonly pkg: string;
  /** Names after the module: `['EntityId']`, or `['EntityId', 'createText']` for a static. */
  readonly path: readonly string[];
}

/** Resolves references in the linted file to library exports, by import source. */
export interface SymbolResolver {
  /**
   * Library exports that `expression` (`Name`, `ns.Name`, `Name.member`, behind `as`/`!`/
   * `satisfies`) denotes. Empty when it is not a library symbol: not imported, shadowed by a
   * parameter / local class / local constant, or reachable only through unsupported shapes
   * (destructuring, dynamic aliases).
   */
  libraryRefs(expression: AstNode): readonly LibrarySymbol[];
}

const programModels = new WeakMap<object, ModuleModel>();

function tsconfigSetting(settings: Rule.RuleContext['settings']): string | false | undefined {
  const raw: unknown = settings?.['ddd'];
  if (typeof raw !== 'object' || raw === null) return undefined;
  const value = (raw as { tsconfig?: unknown }).tsconfig;
  return typeof value === 'string' || value === false ? value : undefined;
}

/** Scopes introduced by the ancestors of `node`, outermost first. */
function scopesAbove(node: AstNode): Scope[] {
  const chain: AstNode[] = [];
  for (let n = node['parent'] as AstNode | undefined; n; n = n['parent'] as AstNode | undefined) {
    chain.push(n);
  }
  const scopes: Scope[] = [];
  for (let i = chain.length - 1; i >= 0; i--) {
    const scope = scopeOf(chain[i] as AstNode);
    if (scope) scopes.push(scope);
  }
  return scopes;
}

/**
 * The `@vytches/ddd` meta-package re-exports one class under another name (`export { EntityId as
 * ContractsEntityId }`, to sit next to the value-objects `EntityId`). Rules know the original
 * name, so the renamed export is mapped back before matching.
 */
const META_PACKAGE = '@vytches/ddd';
const META_RENAMES: Readonly<Record<string, string>> = { ContractsEntityId: 'EntityId' };

function renamedMetaExport(pkg: string, path: readonly string[]): readonly string[] {
  const original =
    pkg === META_PACKAGE && path[0] !== undefined ? META_RENAMES[path[0]] : undefined;
  return original === undefined ? path : [original, ...path.slice(1)];
}

/** Creates the resolver for one rule context. Nothing is read until the first lookup. */
export function createSymbolResolver(context: Rule.RuleContext): SymbolResolver {
  const cwd = context.cwd ?? process.cwd();
  const file = isAbsolute(context.filename) ? context.filename : resolve(cwd, context.filename);
  const program = context.sourceCode.ast as unknown as AstNode;
  let host: ReturnType<typeof createOriginHost> | undefined;

  const modelOfFile = (): ModuleModel => {
    const hit = programModels.get(program);
    if (hit) return hit;
    const model = modelFromProgram(program);
    programModels.set(program, model);
    return model;
  };

  return {
    libraryRefs(expression) {
      const path = expressionPath(expression);
      if (!path) return [];
      const substituted = substitute(scopesAbove(expression), path.root, path.rest);
      if (!substituted) return [];
      host ??= createOriginHost(cwd, tsconfigSetting(context.settings));
      const out: LibrarySymbol[] = [];
      for (const origin of resolveName(
        host,
        file,
        modelOfFile(),
        substituted.root,
        substituted.rest
      )) {
        if (origin.kind !== 'package') continue;
        const lib = parseLibrarySpecifier(origin.spec);
        if (lib) out.push({ pkg: lib.pkg, path: renamedMetaExport(lib.pkg, origin.path) });
      }
      return out;
    },
  };
}

/** True when some symbol is the export `name` (with `rest` members after it) of any library package. */
export function isLibraryExport(
  symbols: readonly LibrarySymbol[],
  name: string,
  rest: readonly string[] = []
): boolean {
  return symbols.some(
    s =>
      s.path.length === rest.length + 1 &&
      s.path[0] === name &&
      rest.every((part, i) => s.path[i + 1] === part)
  );
}
