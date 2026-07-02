/**
 * Bundle strategies for different package types
 *
 * F-M20 (VB-002) — instanceof identity decision, documented per task
 * acceptance criteria item 10:
 *
 * `bundle-all` inlines a package's `@vytches/ddd-*` dependencies into its own
 * dist instead of externalizing them. If two packages both inline the SAME
 * class from a shared dependency, `instanceof` checks between an instance
 * created by one and a class reference imported from the other would fail
 * (they'd be two different, duplicated class definitions at runtime).
 *
 * `bundle-all` is used by exactly two packages: `utils` (packageType
 * 'tooling', zero @vytches deps of its own) and `contracts` (via
 * `createFoundationConfig`, which only ever inlines `utils` + `contracts`
 * itself — see `utils/vite.config.mts`'s explicit `external` function, which
 * force-externalizes `@vytches/ddd-contracts` with an inline comment
 * documenting this exact concern, REL-008). Since neither of these two
 * bundle-all packages re-bundles a class that a THIRD package also inlines,
 * there is no pair of packages sharing a duplicated foundation class today.
 *
 * Every other package in the F-H1 phantom-dependency fix (acl, aggregates,
 * cqrs, di, domain-services, events, messaging, projections, repositories,
 * testing) uses `externalize-workspace`, which never inlines `@vytches/ddd-*`
 * imports at all — consumers always get the single shared instance of a
 * class from `node_modules`, so `instanceof` identity is preserved by
 * construction. F-H1 only added missing `dependencies` entries to these
 * packages' manifests; it did not touch this externalization logic, so this
 * conclusion holds after that fix as before it.
 *
 * Verified via `pnpm test:smoke` (AC1): the smoke test installs every
 * package's real tarball in isolation and exercises `require()`/`import()`
 * end-to-end, which would surface a broken `instanceof` chain as a runtime
 * failure if one existed.
 */
import type { BundleStrategy, PackageType, BuildContext } from './types';

/**
 * Determine appropriate bundle strategy based on package type
 */
export function getBundleStrategy(packageType: PackageType, context: BuildContext): BundleStrategy {
  switch (packageType) {
    case 'foundation':
      // Foundation packages should bundle their minimal dependencies
      return 'bundle-all';

    case 'pattern':
    case 'architecture':
    case 'integration':
      // Higher-level packages should externalize workspace dependencies
      return 'externalize-workspace';

    case 'infrastructure':
      // Infrastructure can externalize workspace deps but bundle utilities
      return 'externalize-workspace';

    case 'meta':
      // Meta packages should NOT bundle - they re-export
      return 'meta-reexport';

    case 'tooling':
      // Tooling packages like utils should bundle everything
      if (context.packageName === 'utils') {
        return 'bundle-all';
      }
      // Testing and CLI can externalize workspace deps
      return 'externalize-workspace';

    default:
      return 'externalize-workspace';
  }
}

/**
 * Create external function based on bundle strategy
 */
export function createExternalFunction(
  strategy: BundleStrategy,
  context: BuildContext,
  additionalExternals: string[] = [],
  additionalBundles: string[] = []
): (id: string) => boolean {
  return (id: string) => {
    // Always bundle explicitly requested packages
    if (additionalBundles.includes(id)) {
      return false;
    }

    // Always externalize explicitly requested packages
    if (additionalExternals.includes(id)) {
      return true;
    }

    switch (strategy) {
      case 'bundle-all':
        // Bundle everything except real npm packages
        if (id.startsWith('@vytches/ddd-')) return false;
        if (id.includes('src/')) return false;
        if (id.startsWith('./') || id.startsWith('../')) return false;
        if (id.includes('packages/') && id.includes('vytches-ddd')) return false;
        return true; // Externalize only real npm packages

      case 'externalize-workspace':
        // Externalize @vytches packages, bundle everything else
        return (
          id.startsWith('@vytches/ddd-') ||
          (!id.includes('src/') && !id.startsWith('./') && !id.startsWith('../'))
        );

      case 'externalize-all':
        // Externalize everything except relative imports
        if (id.startsWith('./') || id.startsWith('../')) return false;
        if (id.includes('src/')) return false;
        return true;

      case 'meta-reexport':
        // Meta packages should externalize ALL @vytches deps (thin re-export layer)
        if (id.startsWith('@vytches/ddd-')) return true;
        if (!id.startsWith('.') && !id.startsWith('/')) return true;
        return false;

      default:
        return id.startsWith('@vytches/ddd-');
    }
  };
}

/**
 * Get build aliases based on package type and strategy
 */
export function getBuildAliases(
  packageType: PackageType,
  strategy: BundleStrategy,
  context: BuildContext,
  workspaceAliases: Record<string, string>
): Record<string, string> {
  // Meta packages don't need aliases - they re-export
  if (strategy === 'meta-reexport') {
    return {};
  }

  // Foundation packages need minimal aliases for bundling
  if (packageType === 'foundation') {
    return {
      '@vytches/ddd-utils': workspaceAliases['@vytches/ddd-utils'],
      '@vytches/ddd-contracts': workspaceAliases['@vytches/ddd-contracts'],
    };
  }

  // Higher-level packages with externalization don't need build aliases
  if (strategy === 'externalize-workspace') {
    return {};
  }

  // Bundle-all strategy needs all aliases
  if (strategy === 'bundle-all') {
    return workspaceAliases;
  }

  return {};
}
