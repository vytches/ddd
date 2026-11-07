import { expressionPath } from './ast-model';
import type { AstNode } from './types';

/** A nested-scope declaration: either a plain shadow or `const A = Import` style alias. */
export type ScopeEntry =
  | { readonly kind: 'shadow' }
  | { readonly kind: 'alias'; readonly root: string; readonly rest: readonly string[] };

export type Scope = Map<string, ScopeEntry>;

const FUNCTIONS = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
  'ArrowFunctionExpression',
  'TSDeclareFunction',
]);
const STATEMENT_LISTS = new Set(['BlockStatement', 'StaticBlock', 'TSModuleBlock']);

const SHADOW: ScopeEntry = { kind: 'shadow' };

function patternNames(p: AstNode | null | undefined, out: string[]): void {
  if (!p) return;
  switch (p.type) {
    case 'Identifier':
      out.push(p['name'] as string);
      break;
    case 'ObjectPattern':
      for (const prop of p['properties'] as AstNode[]) {
        patternNames(prop.type === 'RestElement' ? prop['argument'] : prop['value'], out);
      }
      break;
    case 'ArrayPattern':
      for (const el of p['elements'] as (AstNode | null)[]) patternNames(el, out);
      break;
    case 'AssignmentPattern':
      patternNames(p['left'] as AstNode, out);
      break;
    case 'RestElement':
      patternNames(p['argument'] as AstNode, out);
      break;
    case 'TSParameterProperty':
      patternNames(p['parameter'] as AstNode, out);
      break;
    default:
  }
}

function declare(stmt: AstNode, scope: Scope): void {
  const s =
    (stmt.type === 'ExportNamedDeclaration' || stmt.type === 'ExportDefaultDeclaration') &&
    stmt['declaration']
      ? (stmt['declaration'] as AstNode)
      : stmt;
  switch (s.type) {
    case 'VariableDeclaration':
      for (const d of s['declarations'] as AstNode[]) {
        const id = d['id'] as AstNode;
        const p = id.type === 'Identifier' ? expressionPath(d['init'] as AstNode | null) : null;
        if (p) scope.set(id['name'] as string, { kind: 'alias', root: p.root, rest: p.rest });
        else {
          const names: string[] = [];
          patternNames(id, names);
          for (const n of names) scope.set(n, SHADOW);
        }
      }
      break;
    case 'ClassDeclaration':
    case 'FunctionDeclaration':
    case 'TSDeclareFunction':
    case 'TSInterfaceDeclaration':
    case 'TSEnumDeclaration':
    case 'TSTypeAliasDeclaration': {
      const id = s['id'] as AstNode | null | undefined;
      if (id?.type === 'Identifier') scope.set(id['name'] as string, SHADOW);
      break;
    }
    default:
  }
}

/** The scope a node introduces, or `undefined` when it introduces none. */
export function scopeOf(node: AstNode): Scope | undefined {
  const scope: Scope = new Map();
  if (FUNCTIONS.has(node.type)) {
    const names: string[] = [];
    for (const p of (node['params'] as AstNode[] | undefined) ?? []) patternNames(p, names);
    const id = node['id'] as AstNode | null | undefined;
    if (node.type === 'FunctionExpression' && id?.type === 'Identifier')
      names.push(id['name'] as string);
    for (const n of names) scope.set(n, SHADOW);
    return scope;
  }
  if (STATEMENT_LISTS.has(node.type)) {
    for (const st of (node['body'] as AstNode[] | undefined) ?? []) declare(st, scope);
    return scope;
  }
  switch (node.type) {
    case 'SwitchStatement':
      for (const c of node['cases'] as AstNode[]) {
        for (const st of c['consequent'] as AstNode[]) declare(st, scope);
      }
      return scope;
    case 'ForStatement':
      if ((node['init'] as AstNode | null)?.type === 'VariableDeclaration') {
        declare(node['init'] as AstNode, scope);
      }
      return scope;
    case 'ForInStatement':
    case 'ForOfStatement':
      if ((node['left'] as AstNode).type === 'VariableDeclaration')
        declare(node['left'] as AstNode, scope);
      return scope;
    case 'CatchClause': {
      const names: string[] = [];
      patternNames(node['param'] as AstNode | null, names);
      for (const n of names) scope.set(n, SHADOW);
      return scope;
    }
    default:
      return undefined;
  }
}

/**
 * Resolves a referenced root name against nested scopes. `null` means the name is shadowed by
 * a local declaration (not a library symbol); otherwise returns the (possibly alias-substituted)
 * root and path to resolve against the module.
 */
export function substitute(
  scopes: readonly Scope[],
  root: string,
  rest: readonly string[]
): { root: string; rest: readonly string[] } | null {
  let curRoot = root;
  let curRest = rest;
  for (let i = scopes.length - 1; i >= 0; i--) {
    const entry = (scopes[i] as Scope).get(curRoot);
    if (!entry) continue;
    if (entry.kind === 'shadow') return null;
    curRest = [...entry.rest, ...curRest];
    curRoot = entry.root;
  }
  return { root: curRoot, rest: curRest };
}
