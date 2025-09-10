/* eslint-disable no-constant-condition */
import type { PackageExampleConfig } from '../types/example-types';
import path from 'path';
import fs from 'fs/promises';

export class PackageConfigLoader {
  private configCache: Map<string, PackageExampleConfig> = new Map();

  async loadPackageConfig(packageName: string): Promise<PackageExampleConfig> {
    if (this.configCache.has(packageName)) {
      return this.configCache.get(packageName)!;
    }

    // Find the root directory by going up until we find packages/
    let rootDir = process.cwd();
    while (true) {
      try {
        await fs.access(path.join(rootDir, 'packages'));
        break; // Found packages directory
      } catch {
        const parent = path.dirname(rootDir);
        if (parent === rootDir) {
          break; // Reached filesystem root
        }
        rootDir = parent;
      }
    }

    const configPath = path.join(rootDir, 'packages', packageName, 'src', 'examples', 'config.ts');

    try {
      // Check if config file exists
      await fs.access(configPath);

      // Dynamic import the config
      const configModule = await import(configPath);

      // Try different export patterns
      const camelCasePackageName = packageName.replace(/-([a-z])/g, g => g[1]?.toUpperCase() || '');
      const config =
        configModule.default ||
        configModule[`${packageName}ExampleConfig`] ||
        configModule[`${camelCasePackageName}ExampleConfig`] ||
        configModule.config ||
        configModule.packageExampleConfig;

      if (!config) {
        throw new Error(`No valid config export found in ${configPath}`);
      }

      // Validate config
      this.validateConfig(config, packageName);

      // Cache the config
      this.configCache.set(packageName, config);

      return config;
    } catch (error) {
      throw new Error(
        `Failed to load package config for ${packageName}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async getAvailablePackages(): Promise<string[]> {
    // Find the root directory by going up until we find packages/
    let rootDir = process.cwd();
    while (true) {
      try {
        await fs.access(path.join(rootDir, 'packages'));
        break; // Found packages directory
      } catch {
        const parent = path.dirname(rootDir);
        if (parent === rootDir) {
          break; // Reached filesystem root
        }
        rootDir = parent;
      }
    }

    const packagesPath = path.join(rootDir, 'packages');

    try {
      const items = await fs.readdir(packagesPath, { withFileTypes: true });
      const packages: string[] = [];

      for (const item of items) {
        if (item.isDirectory()) {
          const examplesPath = path.join(packagesPath, item.name, 'src', 'examples');
          const configPath = path.join(examplesPath, 'config.ts');

          try {
            // Check if examples config exists
            await fs.access(configPath);
            packages.push(item.name);
          } catch {
            // Skip packages without examples config
          }
        }
      }

      return packages.sort();
    } catch (error) {
      throw new Error(
        `Failed to read packages directory: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private validateConfig(config: PackageExampleConfig, packageName: string): void {
    // Check required fields
    if (!config.packageName) {
      throw new Error(`Package config missing packageName for ${packageName}`);
    }

    if (!config.displayName) {
      throw new Error(`Package config missing displayName for ${packageName}`);
    }

    if (!config.complexityLevels) {
      throw new Error(`Package config missing complexityLevels for ${packageName}`);
    }

    if (!config.tags || !config.tags.core) {
      throw new Error(`Package config missing core tags for ${packageName}`);
    }

    if (!config.sections) {
      throw new Error(`Package config missing sections for ${packageName}`);
    }

    // Validate complexity levels
    const validComplexityLevels = ['basic', 'intermediate', 'advanced'];
    for (const [key, complexityConfig] of Object.entries(config.complexityLevels)) {
      const level = (complexityConfig as Record<string, unknown>).level as string;
      if (!validComplexityLevels.includes(level)) {
        throw new Error(`Invalid complexity level: ${level} in ${packageName}`);
      }
    }

    // Validate tags format
    for (const coreTag of config.tags.core) {
      if (!coreTag.startsWith(packageName)) {
        throw new Error(`Core tag must start with package name: ${coreTag} in ${packageName}`);
      }
    }
  }

  clearCache(): void {
    this.configCache.clear();
  }
}
