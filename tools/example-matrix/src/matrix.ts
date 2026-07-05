/**
 * VD-006a — Extract + Correlate phases (see project-orchestration/analysis/
 * VD-006-example-coverage-matrix.analysis.md, decision D-2).
 *
 * Extract:   AST-parse every discovered example `.ts` file (scanner.ts's
 *            Discover output) for the `@vytches/*` packages it actually
 *            imports — directly, or transitively through same-example
 *            relative imports (e.g. `05-service-composition.ts` importing
 *            `./03-inventory-management` pulls in whatever packages *that*
 *            file imports too). Also resolves which example file(s) each
 *            test file imports.
 *
 * Correlate: classify every `expected-combinations.yaml` entry as
 *            VERIFIED / EXAMPLE_ONLY / DECLARED_MISSING, and surface any
 *            discovered multi-package combination that matches no manifest
 *            entry as an `UndeclaredCombination` (the D-7 soft-fail signal).
 */

import { readFileSync } from 'node:fs';
import { posix } from 'node:path';

import { extractImports } from './ast.js';
import type {
  DiscoveredExample,
  ExampleFile,
  ExpectedCombination,
  Matrix,
  MatrixCell,
  UndeclaredCombination,
} from './types.js';

/**
 * Build one {@link ExampleFile} per discovered `src/**\/*.ts` file, with its
 * transitively-resolved `@vytches/*` package set.
 *
 * @param discovered Output of `discoverExamples()`.
 * @param repoRoot   Absolute filesystem path such that
 *                    `join(repoRoot, file.path)` reads the real file — kept
 *                    as an explicit parameter (not assumed to be `cwd`) so
 *                    tests can point it at a temp fixture directory.
 */
export function buildExampleFiles(
  discovered: readonly DiscoveredExample[],
  repoRoot: string
): ExampleFile[] {
  const results: ExampleFile[] = [];

  for (const example of discovered) {
    const knownSrcPaths = new Set(example.srcFiles);
    // Raw direct-import data per file, read once up front.
    const direct = new Map<string, { packages: string[]; relativeSpecifiers: string[] }>();
    for (const path of example.srcFiles) {
      const sourceText = readFileSync(posix.join(repoRoot, path), 'utf8');
      direct.set(path, extractImports(path, sourceText));
    }

    for (const path of example.srcFiles) {
      const packages = resolveTransitivePackages(path, direct, knownSrcPaths, new Set());
      results.push({ path, exampleDir: example.dir, packages: [...packages].sort() });
    }
  }

  return results;
}

/**
 * DFS over same-example relative imports, unioning `@vytches/*` packages
 * transitively. `visited` guards against import cycles (none exist in the
 * current examples, but a hostile/future file could introduce one).
 */
function resolveTransitivePackages(
  path: string,
  direct: Map<string, { packages: string[]; relativeSpecifiers: string[] }>,
  knownSrcPaths: Set<string>,
  visited: Set<string>
): Set<string> {
  if (visited.has(path)) return new Set();
  visited.add(path);

  const info = direct.get(path);
  const packages = new Set<string>(info?.packages ?? []);
  if (!info) return packages;

  for (const specifier of info.relativeSpecifiers) {
    const resolved = resolveRelativeSpecifier(path, specifier, knownSrcPaths);
    if (!resolved) continue;
    for (const pkg of resolveTransitivePackages(resolved, direct, knownSrcPaths, visited)) {
      packages.add(pkg);
    }
  }

  return packages;
}

/**
 * Resolve a relative import specifier (e.g. `./03-inventory-management` or
 * `../src/01-basic-specification`) written inside `fromPath` to a matching
 * repo-relative path in `knownPaths`, trying the exact match, then `+ '.ts'`,
 * then `+ '/index.ts'`. Returns `undefined` if nothing in `knownPaths`
 * matches (e.g. the import points outside the example's own `src/`, such as
 * a `vitest`/`node:*` specifier — those never reach this function since
 * `extractImports` only returns `.`-prefixed specifiers here, but a test
 * importing `../src/x` where `x` doesn't exist should not throw).
 */
export function resolveRelativeSpecifier(
  fromPath: string,
  specifier: string,
  knownPaths: ReadonlySet<string>
): string | undefined {
  const fromDir = posix.dirname(fromPath);
  const joined = posix.normalize(posix.join(fromDir, specifier));

  for (const candidate of [joined, `${joined}.ts`, posix.join(joined, 'index.ts')]) {
    if (knownPaths.has(candidate)) return candidate;
  }
  return undefined;
}

/**
 * Build a map of `srcFilePath -> testFilePath[]` — every test file (across
 * all discovered examples) that directly imports a given src file. This is
 * a DIRECT match only (D-2: "match each test file's import statement to the
 * example file it tests") — transitive coverage through an imported sibling
 * does not count as that sibling being independently verified.
 */
export function buildTestedByMap(
  discovered: readonly DiscoveredExample[],
  repoRoot: string
): Map<string, string[]> {
  const testedBy = new Map<string, string[]>();

  for (const example of discovered) {
    const knownSrcPaths = new Set(example.srcFiles);

    for (const testPath of example.testFiles) {
      const sourceText = readFileSync(posix.join(repoRoot, testPath), 'utf8');
      const { relativeSpecifiers } = extractImports(testPath, sourceText);

      for (const specifier of relativeSpecifiers) {
        const resolved = resolveRelativeSpecifier(testPath, specifier, knownSrcPaths);
        if (!resolved) continue;
        const list = testedBy.get(resolved) ?? [];
        list.push(testPath);
        testedBy.set(resolved, list);
      }
    }
  }

  for (const list of testedBy.values()) list.sort();
  return testedBy;
}

/**
 * Correlate phase: classify every manifest entry, and surface discovered
 * multi-package combinations that no manifest entry declares.
 */
export function correlate(
  manifest: readonly ExpectedCombination[],
  exampleFiles: readonly ExampleFile[],
  testedBy: ReadonlyMap<string, string[]>
): { cells: MatrixCell[]; undeclared: UndeclaredCombination[] } {
  const filesByPath = new Map(exampleFiles.map(f => [f.path, f]));
  const declaredFiles = new Set(
    manifest.map(entry => entry.file).filter((f): f is string => f !== null)
  );

  const cells: MatrixCell[] = manifest.map(entry => {
    const file = entry.file;
    const exampleFile = file ? filesByPath.get(file) : undefined;

    if (!file || !exampleFile) {
      return {
        name: entry.name,
        level: entry.level,
        packages: entry.packages,
        status: 'DECLARED_MISSING',
        file: null,
        testedBy: [],
        planned: entry.planned,
        description: entry.description,
      };
    }

    const tests = testedBy.get(file) ?? [];
    return {
      name: entry.name,
      level: entry.level,
      packages: entry.packages,
      status: tests.length > 0 ? 'VERIFIED' : 'EXAMPLE_ONLY',
      file,
      testedBy: tests,
      planned: entry.planned,
      description: entry.description,
    };
  });

  // Discovered files that combine 2+ @vytches packages but are not the
  // anchor `file` of any manifest entry — the D-7 soft-fail signal.
  const undeclared: UndeclaredCombination[] = exampleFiles
    .filter(f => f.packages.length >= 2 && !declaredFiles.has(f.path))
    .map(f => {
      const tests = testedBy.get(f.path) ?? [];
      return {
        file: f.path,
        exampleDir: f.exampleDir,
        packages: f.packages,
        status: tests.length > 0 ? 'VERIFIED' : 'EXAMPLE_ONLY',
        testedBy: tests,
      };
    });

  return { cells, undeclared };
}

/**
 * Top-level orchestrator: Discover output + repo root + manifest in,
 * canonical {@link Matrix} out. `discoverExamples()` itself is intentionally
 * NOT called here — callers (cli.ts, tests) own that step so tests can
 * inject a synthetic `DiscoveredExample[]` without touching the filesystem's
 * directory-walk logic.
 */
export function buildMatrix(
  discovered: readonly DiscoveredExample[],
  repoRoot: string,
  manifest: readonly ExpectedCombination[]
): Matrix {
  const exampleFiles = buildExampleFiles(discovered, repoRoot);
  const testedBy = buildTestedByMap(discovered, repoRoot);
  const { cells, undeclared } = correlate(manifest, exampleFiles, testedBy);

  return {
    generatedAt: new Date().toISOString(),
    cells,
    undeclared,
  };
}
