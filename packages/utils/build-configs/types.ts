/**
 * Build configuration types for the VytchesDDD monorepo
 */

export type PackageType =
  | 'foundation'
  | 'pattern'
  | 'architecture'
  | 'integration'
  | 'infrastructure'
  | 'meta'
  | 'tooling';

export type BundleStrategy =
  | 'bundle-all'
  | 'externalize-workspace'
  | 'externalize-all'
  | 'meta-reexport';

export interface PackageConfigOptions {
  /** Package type determines default build strategy */
  packageType?: PackageType;

  /** Override default bundle strategy */
  bundleStrategy?: BundleStrategy;

  /** Generate TypeScript declarations */
  generateDTS?: boolean;

  /** Enable source maps */
  sourcemap?: boolean;

  /** Build target */
  target?: string;

  /** Additional external dependencies to force externalize */
  additionalExternals?: string[];

  /** Additional dependencies to force bundle */
  additionalBundles?: string[];

  /**
   * Additional named entry points to build alongside `src/index.ts`, keyed
   * by the subpath name (e.g. `{ internal: 'src/internal.ts' }` builds
   * `dist/internal.js` / `dist/internal.cjs` / `dist/internal.d.ts`, wired
   * to a `./internal` entry in `package.json#exports`).
   *
   * VF-024 (AC4): used for genuinely-internal, cross-package-only symbols
   * (e.g. `internalLogger`) that must remain reachable by sibling
   * `@vytches/ddd-*` packages but should not appear in the package's public
   * barrel. Node's `exports` field blocks any subpath not declared here, so
   * this is the only way to expose a *narrower* surface than `.`.
   */
  additionalEntries?: Record<string, string>;

  /** Custom DTS configuration */
  dtsConfig?: {
    insertTypesEntry?: boolean;
    exclude?: string[];
    outDir?: string;
    entryRoot?: string;
    transformPaths?: boolean;
  };

  /** Test configuration overrides */
  testConfig?: {
    aliases?: Record<string, string>;
    environment?: 'node' | 'jsdom';
    globals?: boolean;
  };
}

export interface BuildContext {
  packageName: string;
  packagePath: string;
  packageJson: any;
  isMetaPackage: boolean;
  workspaceDependencies: string[];
}
