import type { PackageExampleConfig, ExampleDefinition } from '../types/example-types';
import { DocumentationGenerator } from './documentation-generator';
import { PackageConfigLoader } from '../core/package-config-loader';
import { logger } from '../core/utils/logger';
import fs from 'fs/promises';
import path from 'path';

export interface BundleOptions {
  packages: string[];
  complexityLevels?: string[] | undefined;
  framework?: string | undefined;
  sections?: string[] | undefined;
  llmOptimized?: boolean | undefined;
  showRelated?: boolean | undefined;
  maxExamples?: number | undefined;
  randomize?: boolean | undefined;
  seed?: string | undefined;
  outputPath?: string | undefined;
  diOnly?: boolean | undefined;
}

export interface DocumentationBundle {
  metadata: {
    title: string;
    packages: string[];
    generatedAt: string;
    version: string;
  };
  content: string;
  examples: ExampleDefinition[];
  outputPath?: string | undefined;
  packageCount?: number | undefined;
  exampleCount?: number | undefined;
}

export class DocumentationBundler {
  private generator: DocumentationGenerator;
  private configLoader: PackageConfigLoader;

  constructor() {
    this.generator = new DocumentationGenerator();
    this.configLoader = new PackageConfigLoader();
  }

  /**
   * Generate bundle (alias for createBundle for backward compatibility)
   */
  async generateBundle(options: BundleOptions): Promise<DocumentationBundle> {
    return this.createBundle(options);
  }

  /**
   * Create a documentation bundle from multiple packages
   */
  async createBundle(options: BundleOptions): Promise<DocumentationBundle> {
    logger.info(`Creating documentation bundle for packages: ${options.packages.join(', ')}`);

    const allExamples: ExampleDefinition[] = [];
    const packageConfigs: PackageExampleConfig[] = [];

    // Load configurations from all packages
    for (const packageName of options.packages) {
      try {
        const config = await this.loadPackageConfig(packageName);
        packageConfigs.push(config);
        allExamples.push(...config.examples);
      } catch (error) {
        logger.warn(`Failed to load config for package ${packageName}:`, error);
      }
    }

    // Filter examples based on options
    const filteredExamples = this.filterExamples(allExamples, options);

    // Generate bundled documentation
    const content = await this.generateBundledContent(filteredExamples, options);

    // Determine output path
    const outputPath =
      options.outputPath || this.generateBundleOutputPath(options.packages, options.framework);

    return {
      metadata: {
        title: `Documentation Bundle - ${options.packages.join(', ')}`,
        packages: options.packages,
        generatedAt: new Date().toISOString(),
        version: '1.0.0',
      },
      content,
      examples: filteredExamples,
      outputPath,
      packageCount: options.packages.length,
      exampleCount: filteredExamples.length,
    };
  }

  /**
   * Load package configuration
   */
  private async loadPackageConfig(packageName: string): Promise<PackageExampleConfig> {
    return await this.configLoader.loadPackageConfig(packageName);
  }

  /**
   * Filter examples based on bundle options
   */
  private filterExamples(
    examples: ExampleDefinition[],
    options: BundleOptions
  ): ExampleDefinition[] {
    let filtered = examples;

    // Filter by complexity levels
    if (options.complexityLevels && options.complexityLevels.length > 0) {
      filtered = filtered.filter(example => options.complexityLevels!.includes(example.complexity));
    }

    // Filter by framework - more flexible approach
    if (options.framework) {
      filtered = filtered.filter(example => {
        // Check if any tag includes the framework name
        const hasFrameworkTag = example.tags.some(tag => tag.includes(options.framework!));
        // For core examples, include them if they're marked as basic or don't have framework-specific tags
        const isCoreExample =
          example.tags.some(tag => tag.includes(':core')) && example.complexity === 'basic';
        return hasFrameworkTag || isCoreExample;
      });
    }

    // Randomize if requested
    if (options.randomize) {
      filtered = this.randomizeExamples(filtered, options.seed);
    }

    // Limit number of examples
    if (options.maxExamples && filtered.length > options.maxExamples) {
      filtered = filtered.slice(0, options.maxExamples);
    }

    return filtered;
  }

  /**
   * Generate bundled content
   */
  private async generateBundledContent(
    examples: ExampleDefinition[],
    options: BundleOptions
  ): Promise<string> {
    const sections: string[] = [];

    // Add introduction
    sections.push(`# ${options.packages.join(' + ')} Documentation Bundle`);
    sections.push('');
    sections.push('This documentation bundle combines examples from multiple packages.');
    sections.push('');

    // Group examples by package
    const examplesByPackage = this.groupExamplesByPackage(examples);

    for (const [packageName, packageExamples] of Object.entries(examplesByPackage)) {
      sections.push(`## ${packageName}`);
      sections.push('');

      for (const example of packageExamples) {
        sections.push(`### ${example.name}`);
        sections.push('');
        sections.push(example.description || '');
        sections.push('');

        // Load actual example content
        try {
          const content = await this.loadExampleContent(packageName, example.file);
          sections.push(content);
        } catch (error) {
          sections.push('```typescript');
          sections.push(
            `// Unable to load example content: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
          sections.push('```');
        }
        sections.push('');
      }
    }

    return sections.join('\n');
  }

  /**
   * Group examples by package
   */
  private groupExamplesByPackage(
    examples: ExampleDefinition[]
  ): Record<string, ExampleDefinition[]> {
    const grouped: Record<string, ExampleDefinition[]> = {};

    for (const example of examples) {
      // Extract package name from tags or ID
      const packageName = example.tags.find(tag => tag.includes(':'))?.split(':')[0] || 'unknown';

      if (!grouped[packageName]) {
        grouped[packageName] = [];
      }

      grouped[packageName].push(example);
    }

    return grouped;
  }

  /**
   * Randomize examples with optional seed
   */
  private randomizeExamples(examples: ExampleDefinition[], seed?: string): ExampleDefinition[] {
    // Simple randomization - could be enhanced with seeded random
    const shuffled = [...examples];

    if (seed) {
      // Use seed for reproducible randomization
      let seedValue = this.hashCode(seed);

      for (let i = shuffled.length - 1; i > 0; i--) {
        seedValue = (seedValue * 9301 + 49297) % 233280;
        const j = Math.floor((seedValue / 233280) * (i + 1));
        const temp = shuffled[i];
        if (temp && shuffled[j]) {
          shuffled[i] = shuffled[j];
          shuffled[j] = temp;
        }
      }
    } else {
      // Regular random shuffle
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = shuffled[i];
        if (temp && shuffled[j]) {
          shuffled[i] = shuffled[j];
          shuffled[j] = temp;
        }
      }
    }

    return shuffled;
  }

  /**
   * Generate hash code from string
   */
  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Generate bundle output path
   */
  private generateBundleOutputPath(packages: string[], framework?: string): string {
    const dateStr = new Date().toISOString().split('T')[0];
    const packagesStr = packages.join('-');
    const frameworkStr = framework ? `-${framework}` : '';

    return `${packagesStr}-Bundle${frameworkStr}-v1.0.0-${dateStr}.md`;
  }

  /**
   * Load example content from file
   */
  private async loadExampleContent(packageName: string, filePath: string): Promise<string> {
    // Find the root directory by going up until we find packages/
    let rootDir = process.cwd();
    // eslint-disable-next-line no-constant-condition
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

    const fullPath = path.join(rootDir, 'packages', packageName, 'src', 'examples', filePath);

    try {
      const content = await fs.readFile(fullPath, 'utf8');
      return content;
    } catch (error) {
      throw new Error(`Could not load example file: ${fullPath}`);
    }
  }
}
