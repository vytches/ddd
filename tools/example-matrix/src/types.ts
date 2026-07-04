/**
 * VD-006a — shared types for the example coverage matrix generator.
 *
 * Three-phase algorithm (see project-orchestration/analysis/
 * VD-006-example-coverage-matrix.analysis.md, decision D-2):
 *   Discover  — walk every examples subdirectory for its package.json, all
 *               TypeScript files under src, and all test files under tests
 *               (scanner.ts).
 *   Extract   — AST-parse each example file for actually-imported
 *               "@vytches/*" symbols (not declared package.json deps), and
 *               match each test file's imports to the example file(s) it
 *               tests (ast.ts + matrix.ts).
 *   Correlate — classify each declared combination as VERIFIED /
 *               EXAMPLE_ONLY / DECLARED_MISSING, plus surface undeclared
 *               discovered combinations for the (future) --check soft-fail
 *               (matrix.ts).
 */

/** Difficulty tier for a named combination — lives in the manifest only
 * (OQ-3): the existing `examples/<pkg>/src/NN-name.ts` flat numbering is
 * NOT restructured into per-level directories. */
export type ExampleLevel = 'quick-start' | 'intermediate' | 'advanced';

/**
 * Classification of a single matrix cell.
 *
 * VERIFIED         — the file exists and at least one test file imports it.
 * EXAMPLE_ONLY      — the file exists but no test file imports it.
 * DECLARED_MISSING  — expected-combinations.yaml declares this combination
 *                      but no file implements it (`file: null` or the
 *                      declared `file` path does not exist on disk).
 * ABSENT            — reserved for the (out-of-scope for VD-006a)
 *                      COVERAGE-MATRIX.md renderer, which cross-references
 *                      the full package x level grid; this generator never
 *                      emits ABSENT itself since it only classifies what it
 *                      discovers or what the manifest declares (see D-2).
 */
export type CellStatus = 'VERIFIED' | 'EXAMPLE_ONLY' | 'DECLARED_MISSING' | 'ABSENT';

/** One example directory's raw filesystem shape, before any AST parsing. */
export interface DiscoveredExample {
  /** Directory name under examples/, e.g. "policies". */
  dir: string;
  /** Repo-relative root path, e.g. "examples/policies". */
  root: string;
  /** True if examples/<dir>/package.json exists. */
  hasPackageJson: boolean;
  /** Repo-relative paths of every .ts file under src/ (excluding .d.ts). */
  srcFiles: string[];
  /** Repo-relative paths of every *.test.ts file under tests/. */
  testFiles: string[];
}

/** An example source file after AST extraction, with its transitively
 * resolved set of actually-imported @vytches/star package specifiers. */
export interface ExampleFile {
  /** Repo-relative path, e.g. examples/policies/src/01-basic-specification.ts */
  path: string;
  /** Owning example directory, e.g. "policies". */
  exampleDir: string;
  /** Distinct @vytches/star package specifiers imported directly by this
   * file OR transitively via same-example relative imports. Sorted. */
  packages: string[];
}

/** One manifest entry from expected-combinations.yaml — the ONLY
 * hand-maintained artifact in this mechanism (D-4). */
export interface ExpectedCombination {
  /** Stable slug identifying the combination, e.g. "aggregate-plus-specification". */
  name: string;
  level: ExampleLevel;
  /** @vytches/star package specifiers this combination is expected to use
   * together. Order-independent — compared as a set. */
  packages: string[];
  /** Repo-relative path to the example file expected to implement this
   * combination, or null if none exists yet (-> DECLARED_MISSING). */
  file: string | null;
  /**
   * When `true`, this entry is KNOWN, intentional future work (declared for
   * visibility per D-4's baseline list, but not yet authored/wired to a
   * test) — `--check` reports its DECLARED_MISSING/EXAMPLE_ONLY status as a
   * SOFT warning, not a hard failure. Omit or set `false` for combinations
   * that are expected to already be implemented; those still hard-fail
   * `--check` per D-3(a)/(b) if they regress or were never delivered.
   */
  planned?: boolean;
  description?: string;
}

/** A classified cell for a manifest-declared combination. */
export interface MatrixCell {
  name: string;
  level: ExampleLevel;
  packages: string[];
  status: CellStatus;
  file: string | null;
  /** Repo-relative paths of test files that import `file` (empty if untested
   * or file does not exist). */
  testedBy: string[];
  /** Carried through from the manifest entry — see
   * {@link ExpectedCombination.planned}. */
  planned?: boolean;
  description?: string;
}

/** A combination discovered in examples/star/ that does NOT match any
 * manifest entry's package set — the D-7 soft-fail signal, surfaced here so
 * a later --check layer can warn without re-deriving this data. */
export interface UndeclaredCombination {
  file: string;
  exampleDir: string;
  packages: string[];
  status: Extract<CellStatus, 'VERIFIED' | 'EXAMPLE_ONLY'>;
  testedBy: string[];
}

/** Canonical, generated, machine-truth output (D-2). */
export interface Matrix {
  generatedAt: string;
  cells: MatrixCell[];
  undeclared: UndeclaredCombination[];
}
