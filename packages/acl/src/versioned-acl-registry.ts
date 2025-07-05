/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Result } from '@vytches-ddd/utils';

import type { ACLError } from './acl-errors';
import type { ExecuteOptions, IACLAdapter } from './acl.interfaces';
import type { ACLRegistrationMetadata } from './base-acl-registry';
import { BaseACLRegistry } from './base-acl-registry';

export interface ACLVersionMetadata extends ACLRegistrationMetadata {
  version: string;
  isLatest: boolean;
  deprecated: boolean;
  deprecationReason?: string;
  compatibleWith?: string[];
}

export class VersionedACLRegistry extends BaseACLRegistry {
  private versionedAdapters = new Map<string, Map<string, IACLAdapter<any, any>>>();
  private latestVersions = new Map<string, string>();

  protected getRegistryName(): string {
    return 'VersionedACLRegistry';
  }

  registerVersioned<TDomain, TExternal>(
    contextName: string,
    version: string,
    adapter: IACLAdapter<TDomain, TExternal>,
    metadata?: Partial<ACLVersionMetadata>
  ): this {
    if (!this.isValidVersion(version)) {
      throw new Error(`Invalid version format: ${version}`);
    }

    if (!this.versionedAdapters.has(contextName)) {
      this.versionedAdapters.set(contextName, new Map());
    }

    const contextVersions = this.versionedAdapters.get(contextName);
    if (!contextVersions) {
      throw new Error(`Context ${contextName} not found`);
    }
    contextVersions.set(version, adapter);

    this.updateLatestVersion(contextName, version);
    super.register(contextName, adapter, {
      ...metadata,
      version,
      source: 'versioned',
    });

    return this;
  }

  override get<TDomain, TExternal>(
    contextName: string,
    version?: string
  ): IACLAdapter<TDomain, TExternal> | undefined {
    const contextVersions = this.versionedAdapters.get(contextName);
    if (!contextVersions) return undefined;

    const targetVersion = version || this.getLatestVersion(contextName);
    return targetVersion ? contextVersions.get(targetVersion) : undefined;
  }

  getVersions(contextName: string): string[] {
    const contextVersions = this.versionedAdapters.get(contextName);
    return contextVersions ? Array.from(contextVersions.keys()).sort(this.compareVersions) : [];
  }

  getLatestVersion(contextName: string): string | undefined {
    return this.latestVersions.get(contextName);
  }

  private updateLatestVersion(contextName: string, newVersion: string): void {
    const currentLatest = this.latestVersions.get(contextName);
    if (!currentLatest || this.compareVersions(newVersion, currentLatest) > 0) {
      this.latestVersions.set(contextName, newVersion);
    }
  }

  private isValidVersion(version: string): boolean {
    const semverRegex = /^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9.-]+))?$/;
    return (
      semverRegex.test(version) &&
      !/^0\d/.test(version.split('.')[0] as string) &&
      !/\.0\d/.test(version) &&
      !version.endsWith('-')
    );
  }

  private compareVersions(a: string, b: string): number {
    const parseVersion = (v: string) => {
      const [versionPart, ...preReleaseParts] = v.split('-');
      const parts = versionPart?.split('.').map(Number) || [0, 0, 0];
      return {
        major: parts[0] || 0,
        minor: parts[1] || 0,
        patch: parts[2] || 0,
        preRelease: preReleaseParts.length > 0 ? preReleaseParts.join('-') : null,
      };
    };

    const vA = parseVersion(a);
    const vB = parseVersion(b);

    // Compare major.minor.patch first
    if (vA.major !== vB.major) return vA.major - vB.major;
    if (vA.minor !== vB.minor) return vA.minor - vB.minor;
    if (vA.patch !== vB.patch) return vA.patch - vB.patch;

    // Handle pre-release comparison according to semver:
    // 1. Stable version (no pre-release) > pre-release version
    // 2. Compare pre-release tags alphabetically if both have them
    if (!vA.preRelease && !vB.preRelease) return 0;
    if (!vA.preRelease && vB.preRelease) return 1; // stable > pre-release
    if (vA.preRelease && !vB.preRelease) return -1; // pre-release < stable

    // Both have pre-release tags - compare alphabetically
    return (vA.preRelease || '').localeCompare(vB.preRelease || '');
  }
}

export class VersionedACLAdapter<TDomain, TExternal, TResult = any> {
  constructor(
    private registry: VersionedACLRegistry,
    private defaultContextName: string
  ) {}

  async execute(
    operation: string,
    domainModel: TDomain,
    options?: ExecuteOptions
  ): Promise<Result<TResult, ACLError>> {
    const adapter = this.resolveAdapter(options?.version);
    return adapter.execute(operation, domainModel);
  }

  getAvailableVersions(): string[] {
    return this.registry.getVersions(this.defaultContextName);
  }

  private resolveAdapter(version?: string): IACLAdapter<TDomain, TExternal, TResult> {
    const targetVersion = version || this.registry.getLatestVersion(this.defaultContextName);
    const adapter = this.registry.get<TDomain, TExternal>(this.defaultContextName, targetVersion);

    if (!adapter) {
      throw new Error(
        `ACL adapter not found for context: ${this.defaultContextName}, version: ${targetVersion}`
      );
    }

    return adapter;
  }
}
