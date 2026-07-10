import { posix } from 'node:path';
import ts from 'typescript';

import type { LintIssue, LintRule } from '../types.js';
import { hasFileLevelSuppress } from './suppress.js';

const RULE_ID = 'ddd-005';
const RULE_SLUG = 'deep-import-instead-of-barrel';

/**
 * Flags imports/re-exports that reach past a package's public barrel
 * (`index.ts`) into its internals, and relative imports that cross a
 * package boundary entirely.
 *
 * Rationale (per CLAUDE.md project rules):
 * > Public API Surface: every exported symbol is a public API contract.
 * > Package Boundaries (Nx Monorepo): acyclic dependency graph enforced.
 *
 * Two independent checks, both cross-package only:
 *
 * 1. **Deep subpath import** — any `import`/`export ... from` whose string
 *    module specifier matches `@vytches/ddd-<pkg>/<anything>`. Every
 *    `packages/*\/package.json` in this repo declares only `exports["."]`
 *    today (verified — no subpath exports exist anywhere), so ANY subpath
 *    after the bare package specifier is unambiguously not the public
 *    barrel. Both `/src/...` and `/dist/...` shapes are equally violations
 *    — this rule does not special-case build output vs. source.
 *
 * 2. **Cross-package relative escape** — a relative import (`./` or `../`)
 *    that, resolved textually (string path math, no filesystem I/O — same
 *    constraint as the sibling rules) against the current file's location,
 *    lands under a *different* `packages/<Y>/` directory than the one the
 *    importing file itself lives in (`packages/<X>/`). A same-package
 *    relative import is normal internal composition and is never flagged.
 *    Files that aren't under any `packages/` directory (e.g. `tools/`,
 *    `examples/`) are skipped for this check — it only makes sense as an
 *    inter-package boundary rule in this monorepo's layout.
 *
 * Type-only imports (`import type { X } from '@vytches/ddd-foo/bar'`) are
 * still flagged — barrel discipline applies to types too, no exemption.
 *
 * **Known forward-compat gap (non-blocking, not fixed here):** if a future
 * task (VF-024) introduces real subpath exports (e.g.
 * `@vytches/ddd-contracts/internal`), this rule's blanket "any subpath is a
 * violation" logic will need to become an allowlist keyed off each
 * package's own declared `package.json` `exports` map. Not needed today —
 * zero packages currently declare subpath exports.
 *
 * What's NOT flagged:
 *   - Bare package imports with no subpath (`@vytches/ddd-contracts`)
 *   - Same-package relative imports (still within `packages/<X>/`)
 *   - Test files (`/tests/`, `/__tests__/`, `*.test.ts(x)`, `*.spec.ts(x)`)
 *
 * **Recommended fix**: import from the package's public barrel instead. If
 * the symbol isn't exported from `index.ts`, that's a signal it shouldn't
 * be a cross-package dependency in the first place.
 */
export const deepImportInsteadOfBarrel: LintRule = {
  id: RULE_ID,
  description:
    "Cross-package imports must go through a package's public barrel, never its internal path.",
  run({ sourceFile, filePath }) {
    if (isTestFile(filePath)) return [];
    if (hasFileLevelSuppress(sourceFile, RULE_SLUG)) return [];

    const issues: LintIssue[] = [];
    const currentPackage = extractPackageSegment(filePath);

    const visit = (node: ts.Node): void => {
      const moduleSpecifier = getModuleSpecifier(node);
      if (moduleSpecifier) {
        const specifierText = moduleSpecifier.text;
        const issue = checkSpecifier(
          specifierText,
          filePath,
          currentPackage,
          sourceFile,
          moduleSpecifier
        );
        if (issue) issues.push(issue);
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return issues;
  },
};

const DEEP_PACKAGE_IMPORT_RE = /^@vytches\/ddd-[a-z-]+\/./;

const FIX_MESSAGE =
  "Import from the package's public barrel (@vytches/ddd-<pkg>) instead of its internal path. " +
  "If the symbol isn't exported from index.ts, that's a signal it shouldn't be a cross-package " +
  'dependency -- export it deliberately or reconsider the boundary.';

function getModuleSpecifier(node: ts.Node): ts.StringLiteral | undefined {
  if (
    ts.isImportDeclaration(node) &&
    node.moduleSpecifier &&
    ts.isStringLiteral(node.moduleSpecifier)
  ) {
    return node.moduleSpecifier;
  }
  if (
    ts.isExportDeclaration(node) &&
    node.moduleSpecifier &&
    ts.isStringLiteral(node.moduleSpecifier)
  ) {
    return node.moduleSpecifier;
  }
  return undefined;
}

function checkSpecifier(
  specifierText: string,
  filePath: string,
  currentPackage: string | undefined,
  sourceFile: ts.SourceFile,
  moduleSpecifier: ts.StringLiteral
): LintIssue | undefined {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(
    moduleSpecifier.getStart(sourceFile)
  );
  const location = { file: filePath, line: line + 1, column: character + 1 };

  if (DEEP_PACKAGE_IMPORT_RE.test(specifierText)) {
    return {
      ruleId: RULE_ID,
      severity: 'error',
      message:
        `Deep import "${specifierText}" bypasses the package's public barrel. Import from the ` +
        'bare package specifier instead (e.g. "@vytches/ddd-<pkg>").',
      ...location,
      fix: FIX_MESSAGE,
    };
  }

  if (isRelativeSpecifier(specifierText) && currentPackage) {
    const targetPackage = resolveTargetPackage(filePath, specifierText);
    if (targetPackage && targetPackage !== currentPackage) {
      return {
        ruleId: RULE_ID,
        severity: 'error',
        message:
          `Relative import "${specifierText}" reaches into package "${targetPackage}" from ` +
          `package "${currentPackage}". Cross-package imports must go through the public barrel ` +
          `(@vytches/ddd-${targetPackage}), not a relative path.`,
        ...location,
        fix: FIX_MESSAGE,
      };
    }
  }

  return undefined;
}

function isRelativeSpecifier(specifier: string): boolean {
  return specifier.startsWith('./') || specifier.startsWith('../');
}

/** Extract the `<X>` segment from a path containing `packages/<X>/...`. */
function extractPackageSegment(filePath: string): string | undefined {
  const normalized = filePath.replace(/\\/g, '/');
  const segments = normalized.split('/');
  const index = segments.indexOf('packages');
  if (index === -1 || index + 1 >= segments.length) return undefined;
  return segments[index + 1];
}

/**
 * Resolve a relative specifier against the importing file's directory using
 * pure string path math (no filesystem I/O — this rule doesn't do real
 * module resolution, same constraint as the sibling rules), then extract
 * the `packages/<Y>/` segment of the resolved path, if any.
 */
function resolveTargetPackage(filePath: string, specifier: string): string | undefined {
  const normalized = filePath.replace(/\\/g, '/');
  const dir = posix.dirname(normalized);
  const resolved = posix.normalize(posix.join(dir, specifier));
  return extractPackageSegment(resolved);
}

function isTestFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  if (normalized.includes('/tests/') || normalized.includes('/__tests__/')) return true;
  if (normalized.endsWith('.test.ts') || normalized.endsWith('.spec.ts')) return true;
  if (normalized.endsWith('.test.tsx') || normalized.endsWith('.spec.tsx')) return true;
  return false;
}
