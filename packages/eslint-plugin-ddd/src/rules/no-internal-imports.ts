import { RULE_MESSAGES } from '../messages';
import type { AstNode } from '../resolver/types';
import { defineRule } from './shared/define-rule';
import { INTERNAL_SYMBOLS, isInternalSubpath, isPublicSubpath } from './shared/internal-denylist';
import { parseLibrarySpecifier } from './shared/library-packages';
import { isLibraryOwnFile } from './shared/own-package';

function stringValue(node: AstNode | null | undefined): string | undefined {
  return node?.type === 'Literal' && typeof node['value'] === 'string'
    ? (node['value'] as string)
    : undefined;
}

/** Module specifier literal of an import-like node, or `undefined` when it is not static. */
function specifierOf(node: AstNode): AstNode | undefined {
  switch (node.type) {
    case 'ImportDeclaration':
    case 'ExportNamedDeclaration':
    case 'ExportAllDeclaration':
    case 'ImportExpression':
      return (node['source'] as AstNode | null) ?? undefined;
    case 'TSImportEqualsDeclaration': {
      const ref = node['moduleReference'] as AstNode;
      return ref.type === 'TSExternalModuleReference' ? (ref['expression'] as AstNode) : undefined;
    }
    case 'TSImportType': {
      const arg = (node['argument'] ?? node['parameter']) as AstNode | undefined;
      return arg?.type === 'TSLiteralType' ? (arg['literal'] as AstNode) : arg;
    }
    case 'CallExpression': {
      const callee = node['callee'] as AstNode;
      const args = node['arguments'] as AstNode[];
      return callee.type === 'Identifier' && callee['name'] === 'require' && args.length === 1
        ? (args[0] as AstNode)
        : undefined;
    }
    default:
      return undefined;
  }
}

/** Names a node pulls out of its module (`import { a as b }` gives `a`). */
function importedNames(node: AstNode): { readonly name: string; readonly at: AstNode }[] {
  if (node.type !== 'ImportDeclaration' && node.type !== 'ExportNamedDeclaration') return [];
  const out: { name: string; at: AstNode }[] = [];
  for (const spec of (node['specifiers'] as AstNode[] | undefined) ?? []) {
    const ref = (spec.type === 'ExportSpecifier' ? spec['local'] : spec['imported']) as
      | AstNode
      | undefined;
    const name = ref?.type === 'Identifier' ? (ref['name'] as string) : stringValue(ref);
    if (name !== undefined) out.push({ name, at: spec });
  }
  return out;
}

/**
 * Reports imports of library internals: `/internal` entry points, `@internal` symbols and deep
 * subpaths behind a package barrel. It runs on every file (an import can sit in a file with no
 * role class) and skips the library's own packages. Port of `ddd-005` minus the monorepo-layout
 * check for relative cross-package imports.
 */
export const noInternalImports = defineRule({
  name: 'no-internal-imports',
  description: 'Disallow imports of library internals, `/internal` subpaths and deep subpaths.',
  messages: RULE_MESSAGES['no-internal-imports'],
  create({ context, report }) {
    const cwd = context.cwd ?? process.cwd();
    if (isLibraryOwnFile(context.filename, cwd)) return {};

    const check = (node: unknown): void => {
      const ast = node as AstNode;
      const literal = specifierOf(ast);
      const source = stringValue(literal);
      if (literal === undefined || source === undefined) return;
      const lib = parseLibrarySpecifier(source);
      if (!lib) return;

      if (isInternalSubpath(lib.subpath)) {
        report(literal, 'internalSubpath', { source, package: lib.pkg });
      } else if (lib.subpath !== '' && !isPublicSubpath(lib.subpath)) {
        report(literal, 'deepSubpath', { source, package: lib.pkg });
      } else {
        for (const { name, at } of importedNames(ast)) {
          if (INTERNAL_SYMBOLS.has(name)) report(at, 'internalSymbol', { name, source });
        }
      }
    };

    return {
      ImportDeclaration: check,
      ExportNamedDeclaration: check,
      ExportAllDeclaration: check,
      ImportExpression: check,
      TSImportEqualsDeclaration: check,
      TSImportType: check,
      CallExpression: check,
    };
  },
});
