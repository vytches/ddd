import type { PackageExampleConfig, ExampleDefinition } from '../types/legacy-contracts';
import path from 'path';
import fs from 'fs/promises';
import yaml from 'js-yaml';
import { logger } from './utils/logger';

interface YamlPackageSettings {
  'package-name': string;
  'display-name': string;
  version?: string;
  description?: string;
  'business-context'?: string;
  domain?: string;
  complexity?: string;
  patterns?: string[];
  hierarchy?: {
    strategy?: string;
    scope?: string;
  };
}

export class YamlPackageConfigLoader {
  private configCache: Map<string, PackageExampleConfig> = new Map();

  async loadPackageConfig(packageName: string): Promise<PackageExampleConfig> {
    if (this.configCache.has(packageName)) {
      return this.configCache.get(packageName)!;
    }

    // Find the root directory
    let rootDir = process.cwd();
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        await fs.access(path.join(rootDir, 'packages'));
        break;
      } catch {
        const parent = path.dirname(rootDir);
        if (parent === rootDir) {
          break;
        }
        rootDir = parent;
      }
    }

    try {
      // First try to load from YAML metadata
      const yamlConfig = await this.loadYamlConfig(rootDir, packageName);
      if (yamlConfig) {
        this.configCache.set(packageName, yamlConfig);
        return yamlConfig;
      }

      // Fallback to TypeScript config for packages without YAML
      const tsConfig = await this.loadTypescriptConfig(rootDir, packageName);
      this.configCache.set(packageName, tsConfig);
      return tsConfig;
    } catch (error) {
      throw new Error(
        `Failed to load package config for ${packageName}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async loadYamlConfig(
    rootDir: string,
    packageName: string
  ): Promise<PackageExampleConfig | null> {
    const yamlPath = path.join(
      rootDir,
      'docs',
      'examples',
      'domain',
      packageName,
      '.md-settings.yaml'
    );

    try {
      await fs.access(yamlPath);
      const yamlContent = await fs.readFile(yamlPath, 'utf-8');
      const yamlData = yaml.load(yamlContent) as YamlPackageSettings;

      // Convert YAML to PackageExampleConfig format
      return {
        packageName: yamlData['package-name'] || packageName,
        displayName: yamlData['display-name'] || this.formatDisplayName(packageName),
        version: yamlData.version || '1.0.0',
        description: yamlData.description || '',
        domain: yamlData.domain || 'domain-modeling',
        patterns: yamlData.patterns || [],
        complexityLevels: this.generateComplexityLevels(yamlData.complexity),
        examples: await this.findYamlExamples(rootDir, packageName),
        sections: ['hero', 'description', 'examples'],
        tags: {
          core: [`${packageName}:core`],
          patterns: yamlData.patterns || [],
        },
      };
    } catch (error) {
      logger.debug(`No YAML config found for ${packageName}, will try TypeScript config`);
      return null;
    }
  }

  private async loadTypescriptConfig(
    rootDir: string,
    packageName: string
  ): Promise<PackageExampleConfig> {
    const configPath = path.join(rootDir, 'packages', packageName, 'src', 'examples', 'config.ts');

    try {
      await fs.access(configPath);
      const configModule = await import(configPath);

      const config =
        configModule.default || configModule.config || configModule.packageExampleConfig;

      if (!config) {
        throw new Error(`No valid config export found in ${configPath}`);
      }

      return config;
    } catch (error) {
      // Generate minimal config for packages without any config
      return this.generateMinimalConfig(packageName);
    }
  }

  private async findYamlExamples(
    rootDir: string,
    packageName: string
  ): Promise<ExampleDefinition[]> {
    const examples: ExampleDefinition[] = [];
    const examplesDir = path.join(rootDir, 'docs', 'examples', 'domain', packageName);

    try {
      const items = await fs.readdir(examplesDir, { withFileTypes: true });

      for (const item of items) {
        if (item.isFile() && item.name.endsWith('.yaml') && item.name !== '.md-settings.yaml') {
          const className = item.name.replace('.yaml', '');
          const yamlPath = path.join(examplesDir, item.name);

          try {
            const yamlContent = await fs.readFile(yamlPath, 'utf-8');
            const yamlData = yaml.load(yamlContent) as Record<string, unknown>;

            // Extract basic example info
            examples.push({
              id: `${className}-basic`,
              name: (yamlData.title as string) || this.formatDisplayName(className),
              file: `${className}.yaml`,
              tags: [`${packageName}:core`],
              complexity: 'basic',
              priority: 'high',
              description: (yamlData.description as string) || '',
            });
          } catch (err) {
            logger.debug(`Failed to parse YAML file ${item.name}`);
          }
        }
      }
    } catch (error) {
      logger.debug(`No examples directory found for ${packageName}`);
    }

    return examples;
  }

  private generateComplexityLevels(complexity?: string): Record<string, any> {
    const defaultLevel = complexity || 'intermediate';

    return {
      basic: {
        level: 'basic',
        description: 'Basic patterns and usage',
      },
      intermediate: {
        level: 'intermediate',
        description: 'Advanced patterns with capabilities',
      },
      advanced: {
        level: 'advanced',
        description: 'Enterprise patterns and complex scenarios',
      },
    };
  }

  private generateMinimalConfig(packageName: string): PackageExampleConfig {
    return {
      packageName,
      displayName: this.formatDisplayName(packageName),
      version: '1.0.0',
      description: `${this.formatDisplayName(packageName)} package`,
      domain: 'domain-modeling',
      patterns: [],
      complexityLevels: this.generateComplexityLevels(),
      examples: [],
      sections: ['hero', 'description'],
      tags: {
        core: [`${packageName}:core`],
        patterns: [],
      },
    };
  }

  private formatDisplayName(name: string): string {
    return name
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  async getAvailablePackages(): Promise<string[]> {
    const packages: string[] = [];
    let rootDir = process.cwd();

    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        await fs.access(path.join(rootDir, 'packages'));
        break;
      } catch {
        const parent = path.dirname(rootDir);
        if (parent === rootDir) {
          break;
        }
        rootDir = parent;
      }
    }

    // Check YAML configs
    try {
      const yamlDir = path.join(rootDir, 'docs', 'examples', 'domain');
      const items = await fs.readdir(yamlDir, { withFileTypes: true });

      for (const item of items) {
        if (item.isDirectory()) {
          const settingsPath = path.join(yamlDir, item.name, '.md-settings.yaml');
          try {
            await fs.access(settingsPath);
            packages.push(item.name);
          } catch {
            // Skip packages without YAML settings
          }
        }
      }
    } catch {
      logger.debug('No YAML examples directory found');
    }

    // Check TypeScript configs
    try {
      const packagesPath = path.join(rootDir, 'packages');
      const items = await fs.readdir(packagesPath, { withFileTypes: true });

      for (const item of items) {
        if (item.isDirectory() && !packages.includes(item.name)) {
          const configPath = path.join(packagesPath, item.name, 'src', 'examples', 'config.ts');
          try {
            await fs.access(configPath);
            packages.push(item.name);
          } catch {
            // Skip packages without config
          }
        }
      }
    } catch {
      logger.debug('No packages directory found');
    }

    return packages.sort();
  }

  clearCache(): void {
    this.configCache.clear();
  }
}
