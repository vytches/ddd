import { existsSync } from 'fs';
import { join } from 'path';
import type { PackageExampleConfig, ExampleDefinition } from '../types/example-types';
import { logger } from '../core/utils/logger';

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: string[];
  fixed?: ValidationFix[];
  packagesValidated?: number;
  examplesValidated?: number;
}

export interface ValidationFix {
  package: string;
  example: string;
  description: string;
  type: 'created-file' | 'updated-config' | 'fixed-syntax';
}

export interface ValidationError {
  type: 'file_not_found' | 'invalid_config' | 'syntax_error' | 'missing_metadata';
  message: string;
  exampleId?: string;
  file?: string;
  line?: number;
  package?: string;
  example?: string;
}

export interface ValidationWarning {
  type: 'missing_tag' | 'low_priority' | 'outdated_example' | 'missing_description';
  message: string;
  exampleId?: string;
  file?: string;
  package?: string;
  example?: string;
}

export interface ValidationOptions {
  packageName?: string | undefined;
  fix?: boolean | undefined;
  autoFix?: boolean | undefined;
  verbose?: boolean | undefined;
  checkSyntax?: boolean | undefined;
  checkLinks?: boolean | undefined;
}

export class ExampleValidator {
  private projectRoot: string;

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || process.cwd();
  }

  /**
   * Validate examples (alias for validatePackage for backward compatibility)
   */
  async validateExamples(
    packageName: string,
    options: ValidationOptions = {}
  ): Promise<ValidationResult> {
    return this.validatePackage(packageName, options);
  }

  /**
   * Validate all examples in a package
   */
  async validatePackage(
    packageName: string,
    options: ValidationOptions = {}
  ): Promise<ValidationResult> {
    logger.info(`Validating examples for package: ${packageName}`);

    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: [],
    };

    try {
      // Load package configuration
      const config = await this.loadPackageConfig(packageName);

      // Validate each example
      for (const example of config.examples) {
        const exampleResult = await this.validateExample(example, packageName, options);

        result.errors.push(...exampleResult.errors);
        result.warnings.push(...exampleResult.warnings);
        result.suggestions.push(...exampleResult.suggestions);
      }

      // Validate configuration itself
      const configResult = this.validateConfiguration(config);
      result.errors.push(...configResult.errors);
      result.warnings.push(...configResult.warnings);

      result.isValid = result.errors.length === 0;
    } catch (error) {
      result.isValid = false;
      result.errors.push({
        type: 'invalid_config',
        message: `Failed to load package configuration: ${error}`,
      });
    }

    return result;
  }

  /**
   * Validate a single example
   */
  async validateExample(
    example: ExampleDefinition,
    packageName: string,
    options: ValidationOptions = {}
  ): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: [],
    };

    // Check if example file exists
    const examplePath = this.getExamplePath(packageName, example.file);
    if (!existsSync(examplePath)) {
      result.errors.push({
        type: 'file_not_found',
        message: `Example file not found: ${example.file}`,
        exampleId: example.id,
        file: example.file,
      });
    }

    // Check required metadata
    if (!example.name || example.name.trim() === '') {
      result.errors.push({
        type: 'missing_metadata',
        message: `Example is missing name: ${example.id}`,
        exampleId: example.id,
      });
    }

    if (!example.description || example.description.trim() === '') {
      result.warnings.push({
        type: 'missing_description',
        message: `Example is missing description: ${example.id}`,
        exampleId: example.id,
      });
    }

    // Check tags
    if (!example.tags || example.tags.length === 0) {
      result.warnings.push({
        type: 'missing_tag',
        message: `Example has no tags: ${example.id}`,
        exampleId: example.id,
      });
    }

    // Check complexity level
    const validComplexityLevels = ['basic', 'intermediate', 'advanced'];
    if (!validComplexityLevels.includes(example.complexity)) {
      result.errors.push({
        type: 'invalid_config',
        message: `Invalid complexity level '${example.complexity}' for example: ${example.id}`,
        exampleId: example.id,
      });
    }

    // Check priority
    const validPriorities = ['low', 'medium', 'high'];
    if (!validPriorities.includes(example.priority)) {
      result.warnings.push({
        type: 'low_priority',
        message: `Invalid priority '${example.priority}' for example: ${example.id}`,
        exampleId: example.id,
      });
    }

    // Syntax validation if requested
    if (options.checkSyntax && existsSync(examplePath)) {
      const syntaxResult = await this.validateSyntax(examplePath, example.id);
      result.errors.push(...syntaxResult.errors);
      result.warnings.push(...syntaxResult.warnings);
    }

    result.isValid = result.errors.length === 0;
    return result;
  }

  /**
   * Validate package configuration
   */
  private validateConfiguration(config: PackageExampleConfig): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: [],
    };

    // Check for duplicate example IDs
    const ids = new Set<string>();
    for (const example of config.examples) {
      if (ids.has(example.id)) {
        result.errors.push({
          type: 'invalid_config',
          message: `Duplicate example ID: ${example.id}`,
          exampleId: example.id,
        });
      }
      ids.add(example.id);
    }

    // Check for balanced complexity distribution
    const complexityCount = config.examples.reduce(
      (acc, example) => {
        acc[example.complexity] = (acc[example.complexity] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    if (complexityCount.basic && complexityCount.basic > config.examples.length * 0.8) {
      result.suggestions.push('Consider adding more intermediate and advanced examples');
    }

    result.isValid = result.errors.length === 0;
    return result;
  }

  /**
   * Validate syntax of example file
   */
  private async validateSyntax(filePath: string, exampleId: string): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: [],
    };

    try {
      // Basic syntax validation - could be enhanced with actual TypeScript compiler
      const fs = await import('fs/promises');
      const content = await fs.readFile(filePath, 'utf-8');

      // Check for basic syntax issues
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]?.trim();

        if (!line) continue;

        // Check for unmatched braces (very basic check)
        const openBraces = (line.match(/\{/g) || []).length;
        const closeBraces = (line.match(/\}/g) || []).length;

        if (openBraces !== closeBraces && line.includes('```')) {
          result.warnings.push({
            type: 'missing_tag',
            message: `Potential syntax issue in code block at line ${i + 1}`,
            exampleId,
            file: filePath,
          });
        }
      }
    } catch (error) {
      result.errors.push({
        type: 'syntax_error',
        message: `Failed to validate syntax: ${error}`,
        exampleId,
        file: filePath,
      });
    }

    result.isValid = result.errors.length === 0;
    return result;
  }

  /**
   * Get full path to example file
   */
  private getExamplePath(packageName: string, fileName: string): string {
    return join(this.projectRoot, 'packages', packageName, 'examples', fileName);
  }

  /**
   * Load package configuration
   */
  private async loadPackageConfig(packageName: string): Promise<PackageExampleConfig> {
    // This would normally load from the package's config file
    // For now, return a basic structure
    return {
      packageName,
      displayName: packageName,
      version: '1.0.0',
      description: `Documentation for ${packageName}`,
      domain: 'example',
      patterns: [],
      dependencies: [],
      complexityLevels: {},
      frameworks: [],
      examples: [],
      tags: {
        core: [],
        integrations: [],
        frameworks: [],
        patterns: [],
      },
      contentConfig: {
        showImportStatements: true,
        showErrorHandling: true,
        showTesting: false,
        showPerformance: false,
        includeBestPractices: true,
        includeCommonPitfalls: false,
        showVersionHistory: false,
      },
      llmSupport: {
        enabled: false,
        includePrompts: false,
        includeTips: false,
        includePatterns: false,
        optimizeForCodeGeneration: false,
      },
      sections: [],
      relatedPackages: {},
    };
  }

  /**
   * Fix validation issues automatically
   */
  async fixIssues(packageName: string, options: ValidationOptions = {}): Promise<void> {
    logger.info(`Attempting to fix validation issues for package: ${packageName}`);

    const result = await this.validatePackage(packageName, options);

    for (const error of result.errors) {
      if (error.type === 'file_not_found' && error.file) {
        await this.createMissingFile(packageName, error.file, error.exampleId);
      }
    }
  }

  /**
   * Create missing example file
   */
  private async createMissingFile(
    packageName: string,
    fileName: string,
    exampleId?: string
  ): Promise<void> {
    const filePath = this.getExamplePath(packageName, fileName);

    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      // Ensure directory exists
      await fs.mkdir(path.dirname(filePath), { recursive: true });

      // Create basic example file
      const content = `# ${exampleId || 'Example'}

## Description
TODO: Add description

## Code Example
\`\`\`typescript
// TODO: Add example code
\`\`\`

## Usage
TODO: Add usage instructions
`;

      await fs.writeFile(filePath, content, 'utf-8');
      logger.info(`Created missing example file: ${fileName}`);
    } catch (error) {
      logger.error(`Failed to create missing file ${fileName}:`, error);
    }
  }
}
