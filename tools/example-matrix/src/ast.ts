/**
 * VD-006a — AST helpers shared by the Extract phase (matrix.ts).
 *
 * Uses the TypeScript compiler API (`ts.createSourceFile` + `ts.forEachChild`)
 * to read the *actual* import statements of a `.ts` file — never regex, never
 * `package.json` declared dependencies (those can list unused workspace
 * packages and would over-report combinations).
 */

import ts from 'typescript';

export interface FileImports {
  /** Distinct `@vytches/*` package specifiers imported directly by this file. */
  packages: string[];
  /** Raw relative import specifiers (e.g. `./02-payment-orchestration`,
   * `../src/01-basic-specification`) — resolved to sibling files by the
   * caller, which knows the file's own location on disk. */
  relativeSpecifiers: string[];
}

const VYTCHES_PREFIX = '@vytches/';

/**
 * Parse `sourceText` and extract every top-level `import ... from '...'`
 * (and `export ... from '...'` re-export) module specifier, split into
 * `@vytches/*` package specifiers and relative (same-repo) specifiers.
 *
 * Deliberately does NOT resolve `require()` / dynamic `import()` calls — the
 * examples convention (confirmed across quickstart/policies/domain-services)
 * uses only static ES module imports.
 */
export function extractImports(filePath: string, sourceText: string): FileImports {
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.ES2022, true);

  const packages = new Set<string>();
  const relativeSpecifiers = new Set<string>();

  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const specifier = node.moduleSpecifier.text;
      if (specifier.startsWith(VYTCHES_PREFIX)) {
        packages.add(specifier);
      } else if (specifier.startsWith('.')) {
        relativeSpecifiers.add(specifier);
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  return {
    packages: [...packages].sort(),
    relativeSpecifiers: [...relativeSpecifiers].sort(),
  };
}
