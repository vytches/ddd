/**
 * @llm-summary Documentation registry for managing example definitions
 * @llm-domain Infrastructure
 * @llm-complexity Medium
 *
 * @description
 * Centralized registry for managing example definitions and providing query capabilities.
 * Replaces the old globalExampleRegistry with better naming and structure.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const registry = new DocumentationRegistry();
 * await registry.loadAll();
 * const example = registry.findById('user-service');
 * ```
 *
 * @example
 * ```typescript
 * // Query examples
 * const examples = registry.query({
 *   package: 'domain-services',
 *   complexity: 'intermediate',
 *   framework: 'nestjs'
 * });
 * ```
 *
 * @since 1.0.0
 * @public
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import type {
  IDocumentationRegistry,
  EnhancedExampleDefinition,
  ExampleQueryOptions,
  FrameworkComponentType,
} from '../types/documentation-types';

/**
 * Implementation of documentation registry
 */
export class DocumentationRegistry implements IDocumentationRegistry {
  private examples = new Map<string, EnhancedExampleDefinition>();
  private packageExamples = new Map<string, string[]>();
  private frameworkExamples = new Map<string, Set<string>>();
  private workspaceRoot: string;

  constructor(workspaceRoot = process.cwd()) {
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Load all example definitions from packages
   */
  async loadAll(): Promise<void> {
    this.examples.clear();
    this.packageExamples.clear();
    this.frameworkExamples.clear();

    const packagesDir = path.join(this.workspaceRoot, 'packages');

    try {
      const packages = await fs.readdir(packagesDir);

      for (const packageName of packages) {
        const packagePath = path.join(packagesDir, packageName);
        const examplesConfigPath = path.join(packagePath, 'src', 'examples', 'config.ts');

        try {
          // Try to load package example configuration
          await this.loadPackageExamples(packageName, examplesConfigPath);
        } catch (error) {
          // Skip packages without example configuration
          continue;
        }
      }
    } catch (error) {
      console.warn('Failed to load examples:', error);
    }
  }

  /**
   * Find example by ID
   */
  findById(id: string): EnhancedExampleDefinition | undefined {
    return this.examples.get(id);
  }

  /**
   * Query examples by criteria
   */
  query(options: ExampleQueryOptions): EnhancedExampleDefinition[] {
    let results = Array.from(this.examples.values());

    if (options.package) {
      results = results.filter(example => example.package === options.package);
    }

    if (options.complexity) {
      results = results.filter(example => example.complexity === options.complexity);
    }

    if (options.domain) {
      results = results.filter(
        example =>
          example.tags.includes(`domain:${options.domain}`) ||
          example.description.toLowerCase().includes(options.domain!.toLowerCase())
      );
    }

    if (options.pattern) {
      results = results.filter(
        example =>
          example.tags.includes(`pattern:${options.pattern}`) ||
          example.tags.includes(options.pattern!)
      );
    }

    if (options.framework) {
      results = results.filter(example =>
        example.frameworkIntegrations?.some(fi => fi.framework === options.framework)
      );
    }

    if (options.tags && options.tags.length > 0) {
      results = results.filter(example => options.tags!.some(tag => example.tags.includes(tag)));
    }

    return results;
  }

  /**
   * Get available frameworks for an example
   */
  getAvailableFrameworks(exampleId: string): string[] {
    const example = this.examples.get(exampleId);
    if (!example?.frameworkIntegrations) {
      return [];
    }

    return example.frameworkIntegrations.map(fi => fi.framework);
  }

  /**
   * Get available components for framework integration
   */
  getAvailableComponents(exampleId: string, framework: string): FrameworkComponentType[] {
    const example = this.examples.get(exampleId);
    if (!example?.frameworkIntegrations) {
      return [];
    }

    const integration = example.frameworkIntegrations.find(fi => fi.framework === framework);
    return integration?.components || [];
  }

  /**
   * Get all packages with examples
   */
  getPackages(): string[] {
    return Array.from(this.packageExamples.keys());
  }

  /**
   * Get all available frameworks
   */
  getAllFrameworks(): string[] {
    return Array.from(this.frameworkExamples.keys());
  }

  /**
   * Load examples from a package configuration
   */
  private async loadPackageExamples(packageName: string, configPath: string): Promise<void> {
    try {
      // Read and evaluate the config file
      const configContent = await fs.readFile(configPath, 'utf-8');

      // Extract examples from config (this is a simplified approach)
      // In a real implementation, you might use dynamic imports or a more sophisticated parser
      const examples = this.parseConfigExamples(configContent, packageName);

      if (examples.length > 0) {
        this.packageExamples.set(
          packageName,
          examples.map(e => e.id)
        );

        for (const example of examples) {
          this.examples.set(example.id, example);

          // Track frameworks
          if (example.frameworkIntegrations) {
            for (const integration of example.frameworkIntegrations) {
              if (!this.frameworkExamples.has(integration.framework)) {
                this.frameworkExamples.set(integration.framework, new Set());
              }
              this.frameworkExamples.get(integration.framework)!.add(example.id);
            }
          }
        }
      }
    } catch (error) {
      throw new Error(`Failed to load examples from ${configPath}: ${error}`);
    }
  }

  /**
   * Parse example definitions from config content
   */
  private parseConfigExamples(
    configContent: string,
    packageName: string
  ): EnhancedExampleDefinition[] {
    // This is a simplified parser - in reality you'd want more sophisticated parsing
    const examples: EnhancedExampleDefinition[] = [];

    // Basic regex-based parsing (this should be replaced with proper AST parsing in production)
    const exampleMatches = configContent.matchAll(/examples:\s*\[([\s\S]*?)\]/g);

    for (const match of exampleMatches) {
      try {
        // Extract example objects (simplified)
        const exampleText = match[1];
        if (exampleText) {
          const exampleObjects = this.extractExampleObjects(exampleText, packageName);
          examples.push(...exampleObjects);
        }
      } catch (error) {
        console.warn(`Failed to parse examples from ${packageName}:`, error);
      }
    }

    return examples;
  }

  /**
   * Extract example objects from configuration text
   */
  private extractExampleObjects(text: string, packageName: string): EnhancedExampleDefinition[] {
    // This is a placeholder implementation
    // In production, you'd use proper TypeScript/JavaScript parsing
    return [
      {
        id: `${packageName}-basic-example`,
        name: `${packageName} Basic Example`,
        file: 'basic/implementation.md',
        path: 'basic/implementation.md',
        tags: [`package:${packageName}`, 'basic'],
        complexity: 'basic' as const,
        priority: 'medium' as const,
        description: `Basic example for ${packageName} package`,
        package: packageName,
        diSupport: true,
      },
    ];
  }
}

/**
 * Global instance of the documentation registry
 */
export const globalDocumentationRegistry = new DocumentationRegistry();
