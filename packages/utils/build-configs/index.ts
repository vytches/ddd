/**
 * Modern build configuration system for VytchesDDD monorepo
 *
 * Provides type-specific, optimized build configurations with clear separation
 * of concerns and explicit bundle strategies.
 */

// Main configuration builder
export { createPackageConfig } from './config-builders';

// Type definitions
export type { PackageType, BundleStrategy, PackageConfigOptions, BuildContext } from './types';

// Utilities for advanced usage
export { detectPackageType, createBuildContext, getWorkspaceAliases } from './package-detection';

export { getBundleStrategy, createExternalFunction, getBuildAliases } from './bundle-strategies';

// Import for internal usage
import { createPackageConfig } from './config-builders';

// Specialized configurations for common patterns
export function createFoundationConfig(packagePath: string) {
  return createPackageConfig(packagePath, {
    packageType: 'foundation',
    bundleStrategy: 'bundle-all',
  });
}

export function createMetaPackageConfig(packagePath: string) {
  return createPackageConfig(packagePath, {
    packageType: 'meta',
    bundleStrategy: 'meta-reexport',
    dtsConfig: {
      transformPaths: true,
    },
  });
}

export function createPatternConfig(packagePath: string) {
  return createPackageConfig(packagePath, {
    packageType: 'pattern',
    bundleStrategy: 'externalize-workspace',
  });
}

export function createArchitectureConfig(packagePath: string) {
  return createPackageConfig(packagePath, {
    packageType: 'architecture',
    bundleStrategy: 'externalize-workspace',
  });
}

export function createInfrastructureConfig(packagePath: string) {
  return createPackageConfig(packagePath, {
    packageType: 'infrastructure',
    bundleStrategy: 'externalize-workspace',
  });
}

export function createToolingConfig(packagePath: string) {
  return createPackageConfig(packagePath, {
    packageType: 'tooling',
    bundleStrategy: 'bundle-all',
  });
}

export function createMetaConfig(packagePath: string) {
  return createPackageConfig(packagePath, {
    packageType: 'meta',
    bundleStrategy: 'meta-reexport',
    dtsConfig: {
      transformPaths: true,
    },
  });
}
