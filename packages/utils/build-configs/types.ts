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

  /** JSDoc examples plugin configuration */
  jsdocExamples?: {
    enabled?: boolean;
    verbose?: boolean;
    cache?: boolean;
    fallbackBehavior?: 'generate' | 'skip' | 'error';
  };
}

export interface BuildContext {
  packageName: string;
  packagePath: string;
  packageJson: any;
  isMetaPackage: boolean;
  workspaceDependencies: string[];
}
