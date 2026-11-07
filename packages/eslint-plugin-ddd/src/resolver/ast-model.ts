import { emptyModel, type HeritageRef, type ModuleModel } from './module-model';
import type { AstNode } from './types';

const WRAPPERS = new Set([
  'TSAsExpression',
  'TSNonNullExpression',
  'TSSatisfiesExpression',
  'TSTypeAssertion',
  'TSInstantiationExpression',
  'ParenthesizedExpression',
]);

/** Strips `as`, `!`, `satisfies`, `<T>x` and parentheses. */
export function unwrapExpression(node: AstNode | null | undefined): AstNode | null {
  let cur = node ?? null;
  while (cur && WRAPPERS.has(cur.type)) cur = (cur['expression'] as AstNode | undefined) ?? null;
  return cur;
}

export interface NamePath {
  readonly root: string;
  readonly rest: readonly string[];
}

/** `A`, `ns.X`, `ns.sub.X` (also behind `as`/`!`/`satisfies`); `null` for anything else. */
export function expressionPath(node: AstNode | null | undefined): NamePath | null {
  const n = unwrapExpression(node);
  if (!n) return null;
  if (n.type === 'Identifier') return { root: n['name'] as string, rest: [] };
  if (n.type === 'MemberExpression' && !n['computed']) {
    const prop = n['property'] as AstNode;
    const base = expressionPath(n['object'] as AstNode);
    if (base && prop.type === 'Identifier') {
      return { root: base.root, rest: [...base.rest, prop['name'] as string] };
    }
  }
  return null;
}

function nameOf(node: AstNode | null | undefined): string | undefined {
  if (!node) return undefined;
  if (node.type === 'Identifier') return node['name'] as string;
  if (node.type === 'Literal' && typeof node['value'] === 'string') return node['value'] as string;
  return undefined;
}

/** Heritage of a class or interface node, resolved to name paths (no scope information). */
export function heritageOf(node: AstNode): HeritageRef[] {
  const out: HeritageRef[] = [];
  const push = (kind: HeritageRef['kind'], expr: AstNode | null | undefined) => {
    const p = expressionPath(expr);
    if (p) out.push({ kind, root: p.root, rest: p.rest });
  };
  for (const d of (node['decorators'] as AstNode[] | undefined) ?? []) {
    const e = d['expression'] as AstNode;
    push('decorator', e.type === 'CallExpression' ? (e['callee'] as AstNode) : e);
  }
  if (node['superClass']) push('extends', node['superClass'] as AstNode);
  for (const i of (node['implements'] as AstNode[] | undefined) ?? []) {
    push('implements', i['expression'] as AstNode);
  }
  // interface X extends A, B
  const ext = node['extends'];
  if (Array.isArray(ext))
    for (const e of ext as AstNode[]) push('extends', e['expression'] as AstNode);
  return out;
}

function declaredNames(decl: AstNode): string[] {
  switch (decl.type) {
    case 'ClassDeclaration':
    case 'TSInterfaceDeclaration':
    case 'FunctionDeclaration':
    case 'TSEnumDeclaration':
    case 'TSTypeAliasDeclaration':
    case 'TSModuleDeclaration':
    case 'TSDeclareFunction': {
      const id = nameOf(decl['id'] as AstNode | undefined);
      return id ? [id] : [];
    }
    case 'VariableDeclaration':
      return (decl['declarations'] as AstNode[]).flatMap(d => {
        const id = nameOf(d['id'] as AstNode);
        return id ? [id] : [];
      });
    default:
      return [];
  }
}

function registerDeclaration(decl: AstNode, m: ModuleModel): void {
  if (decl.type === 'ClassDeclaration' || decl.type === 'TSInterfaceDeclaration') {
    const name = nameOf(decl['id'] as AstNode | undefined);
    if (name) m.locals.set(name, { name, heritage: heritageOf(decl) });
  } else if (decl.type === 'VariableDeclaration') {
    for (const d of decl['declarations'] as AstNode[]) {
      const name = nameOf(d['id'] as AstNode);
      const p = name ? expressionPath(d['init'] as AstNode | null) : null;
      if (name && p) m.aliases.set(name, { root: p.root, rest: p.rest });
    }
  }
}

function registerImport(st: AstNode, m: ModuleModel): void {
  const source = (st['source'] as AstNode)['value'] as string;
  for (const s of st['specifiers'] as AstNode[]) {
    const local = nameOf(s['local'] as AstNode);
    if (!local) continue;
    if (s.type === 'ImportSpecifier') {
      m.imports.set(local, { source, path: [nameOf(s['imported'] as AstNode) ?? local] });
    } else if (s.type === 'ImportDefaultSpecifier') {
      m.imports.set(local, { source, path: ['default'] });
    } else {
      m.imports.set(local, { source, path: [] });
    }
  }
}

function registerExport(st: AstNode, m: ModuleModel): void {
  if (st.type === 'ExportAllDeclaration') {
    const source = (st['source'] as AstNode)['value'] as string;
    const ns = nameOf(st['exported'] as AstNode | undefined);
    if (ns) m.exports.set(ns, { kind: 'from', source, path: [] });
    else m.stars.push(source);
    return;
  }
  if (st.type === 'ExportDefaultDeclaration') {
    const decl = st['declaration'] as AstNode;
    if (decl.type === 'ClassDeclaration' || decl.type === 'TSInterfaceDeclaration') {
      registerDeclaration(decl, m);
    }
    const local =
      nameOf(decl['id'] as AstNode | undefined) ??
      (decl.type === 'Identifier' ? nameOf(decl) : undefined);
    if (local) m.exports.set('default', { kind: 'local', local });
    return;
  }
  const decl = st['declaration'] as AstNode | null | undefined;
  if (decl) {
    registerDeclaration(decl, m);
    for (const name of declaredNames(decl)) m.exports.set(name, { kind: 'local', local: name });
    return;
  }
  const source = st['source'] ? ((st['source'] as AstNode)['value'] as string) : undefined;
  for (const s of (st['specifiers'] as AstNode[] | undefined) ?? []) {
    const exported = nameOf(s['exported'] as AstNode);
    const local = nameOf(s['local'] as AstNode);
    if (!exported || !local) continue;
    m.exports.set(
      exported,
      source ? { kind: 'from', source, path: [local] } : { kind: 'local', local }
    );
  }
}

/** Builds a `ModuleModel` from the top-level statements of a parsed program. */
export function modelFromProgram(program: AstNode): ModuleModel {
  const m = emptyModel();
  for (const st of (program['body'] as AstNode[] | undefined) ?? []) {
    switch (st.type) {
      case 'ImportDeclaration':
        registerImport(st, m);
        break;
      case 'TSImportEqualsDeclaration': {
        const ref = st['moduleReference'] as AstNode;
        const local = nameOf(st['id'] as AstNode);
        const expr = ref['expression'] as AstNode | undefined;
        if (
          local &&
          ref.type === 'TSExternalModuleReference' &&
          typeof expr?.['value'] === 'string'
        ) {
          m.imports.set(local, { source: expr['value'] as string, path: [] });
        }
        break;
      }
      case 'ExportNamedDeclaration':
      case 'ExportAllDeclaration':
      case 'ExportDefaultDeclaration':
        registerExport(st, m);
        break;
      default:
        registerDeclaration(st, m);
    }
  }
  return m;
}
