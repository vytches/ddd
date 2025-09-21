/**
 * Package type detection and classification
 */
import { resolve } from 'path';
import { readFileSync } from 'fs';
import type { PackageType, BuildContext } from './types';

/**
 * Detect package type based on name and dependencies
 */
export function detectPackageType(
  packageName: string,
  _packageJson: Record<string, unknown>
): PackageType {
  // Meta packages (enterprise bundle)
  if (packageName === 'enterprise' || packageName === 'ddd') {
    return 'meta';
  }

  // Tooling packages
  if (['cli', 'testing', 'utils'].includes(packageName)) {
    return 'tooling';
  }

  // Foundation layer (minimal dependencies)
  if (
    ['contracts', 'domain-primitives', 'value-objects', 'repositories', 'aggregates'].includes(
      packageName
    )
  ) {
    return 'foundation';
  }

  // Pattern layer (domain patterns)
  if (['validation', 'policies', 'domain-services'].includes(packageName)) {
    return 'pattern';
  }

  // Architecture layer (event-driven)
  if (
    [
      'events',
      'cqrs',
      'projections',
      'event-store',
      'event-scheduling',
      'process-managers',
    ].includes(packageName)
  ) {
    return 'architecture';
  }

  // Integration layer
  if (['acl', 'messaging'].includes(packageName)) {
    return 'integration';
  }

  // Infrastructure layer
  if (['resilience', 'logging', 'di', 'core'].includes(packageName)) {
    return 'infrastructure';
  }

  // Default to pattern if unknown
  return 'pattern';
}

/**
 * Create build context for a package
 */
export function createBuildContext(packagePath: string): BuildContext {
  // Input validation for defensive programming
  if (!packagePath || typeof packagePath !== 'string') {
    throw new Error('Invalid packagePath: must be a non-empty string');
  }

  try {
    const packageJsonContent = readFileSync(resolve(packagePath, 'package.json'), 'utf-8');
    const packageJson = JSON.parse(packageJsonContent);
    const packageName = packageJson.name?.split('/')[1] || 'unknown';

    // Detect workspace dependencies
    const workspaceDependencies = Object.keys(packageJson.dependencies || {}).filter(dep =>
      dep.startsWith('@vytches/ddd-')
    );

    const isMetaPackage =
      detectPackageType(packageName, packageJson) === 'meta' || workspaceDependencies.length >= 5;

    return {
      packageName,
      packagePath,
      packageJson,
      isMetaPackage,
      workspaceDependencies,
    };
  } catch (error) {
    throw new Error(
      `Failed to create build context for ${packagePath}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get all workspace aliases for testing
 */
export function getWorkspaceAliases(packagePath: string): Record<string, string> {
  return {
    '@vytches/ddd-utils': resolve(packagePath, '../utils/src/index.ts'),
    '@vytches/ddd-contracts': resolve(packagePath, '../contracts/src/index.ts'),
    '@vytches/ddd-domain-primitives': resolve(packagePath, '../domain-primitives/src/index.ts'),
    '@vytches/ddd-value-objects': resolve(packagePath, '../value-objects/src/index.ts'),
    '@vytches/ddd-repositories': resolve(packagePath, '../repositories/src/index.ts'),
    '@vytches/ddd-aggregates': resolve(packagePath, '../aggregates/src/index.ts'),
    '@vytches/ddd-core': resolve(packagePath, '../core/src/index.ts'),
    '@vytches/ddd-logging': resolve(packagePath, '../logging/src/index.ts'),
    '@vytches/ddd-events': resolve(packagePath, '../events/src/index.ts'),
    '@vytches/ddd-cqrs': resolve(packagePath, '../cqrs/src/index.ts'),
    '@vytches/ddd-di': resolve(packagePath, '../di/src/index.ts'),
    '@vytches/ddd-validation': resolve(packagePath, '../validation/src/index.ts'),
    '@vytches/ddd-policies': resolve(packagePath, '../policies/src/index.ts'),
    '@vytches/ddd-domain-services': resolve(packagePath, '../domain-services/src/index.ts'),
    '@vytches/ddd-projections': resolve(packagePath, '../projections/src/index.ts'),
    '@vytches/ddd-acl': resolve(packagePath, '../acl/src/index.ts'),
    '@vytches/ddd-messaging': resolve(packagePath, '../messaging/src/index.ts'),
    '@vytches/ddd-resilience': resolve(packagePath, '../resilience/src/index.ts'),
    '@vytches/ddd-event-store': resolve(packagePath, '../event-store/src/index.ts'),
    '@vytches/ddd-event-scheduling': resolve(packagePath, '../event-scheduling/src/index.ts'),
    '@vytches/ddd-testing': resolve(packagePath, '../testing/src/index.ts'),
    '@vytches/ddd-enterprise': resolve(packagePath, '../enterprise/src/index.ts'),
  };
}
