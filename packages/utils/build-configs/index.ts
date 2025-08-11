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
import type { PackageConfigOptions } from './types';

// Utilities for advanced usage
export { detectPackageType, createBuildContext, getWorkspaceAliases } from './package-detection';

export { getBundleStrategy, createExternalFunction, getBuildAliases } from './bundle-strategies';

// Import for internal usage
import { createPackageConfig } from './config-builders';

// Specialized configurations for common patterns
export function createFoundationConfig(
  packagePath: string,
  options: Partial<PackageConfigOptions> = {}
) {
  return createPackageConfig(packagePath, {
    packageType: 'foundation',
    bundleStrategy: 'bundle-all',
    jsdocExamples: {
      enabled: options.jsdocExamples?.enabled ?? true,
      verbose: true,
      cache: true,
      fallbackBehavior: 'skip',
      include: ['*.ts', '**/*.ts', '**/src/*.ts', '**/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.spec.ts'],
    },
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

export function createPatternConfig(
  packagePath: string,
  customOptions: Partial<PackageConfigOptions> = {}
) {
  return createPackageConfig(packagePath, {
    packageType: 'pattern',
    bundleStrategy: 'externalize-workspace',
    jsdocExamples: {
      enabled: true,
      verbose: true,
      cache: true,
      fallbackBehavior: 'skip',
      include: ['*.ts', '**/*.ts', '**/src/*.ts', '**/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.spec.ts'],
    },
    ...customOptions,
  });
}

export function createArchitectureConfig(packagePath: string) {
  return createPackageConfig(packagePath, {
    packageType: 'architecture',
    bundleStrategy: 'externalize-workspace',
    jsdocExamples: {
      enabled: true,
      verbose: true,
      cache: true,
      fallbackBehavior: 'skip',
      include: ['*.ts', '**/*.ts', '**/src/*.ts', '**/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.spec.ts'],
    },
  });
}

export function createInfrastructureConfig(packagePath: string) {
  return createPackageConfig(packagePath, {
    packageType: 'infrastructure',
    bundleStrategy: 'externalize-workspace',
    jsdocExamples: {
      enabled: true,
      verbose: true,
      cache: true,
      fallbackBehavior: 'skip',
      include: ['*.ts', '**/*.ts', '**/src/*.ts', '**/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.spec.ts'],
    },
  });
}

export function createToolingConfig(packagePath: string) {
  return createPackageConfig(packagePath, {
    packageType: 'tooling',
    bundleStrategy: 'bundle-all',
    jsdocExamples: {
      enabled: true,
      verbose: true,
      cache: true,
      fallbackBehavior: 'skip',
      include: ['*.ts', '**/*.ts', '**/src/*.ts', '**/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.spec.ts'],
    },
  });
}

export function createMetaConfig(packagePath: string) {
  return createPackageConfig(packagePath, {
    packageType: 'meta',
    bundleStrategy: 'meta-reexport',
    dtsConfig: {
      transformPaths: true,
    },
    // Meta packages nie potrzebują JSDoc - są to tylko re-exporty
    jsdocExamples: {
      enabled: false,
    },
  });
}
