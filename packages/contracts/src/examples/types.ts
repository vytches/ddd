/**
 * Examples Configuration Types
 *
 * Shared types for example generation across all packages.
 * These types are used by CLI and individual packages to avoid circular dependencies.
 */

/**
 * Complexity level configuration for examples
 */
export interface ComplexityLevel {
  level: 'basic' | 'intermediate' | 'advanced';
  diSupport: boolean;
  diRequired: boolean;
  description: string;
}

/**
 * Framework integration configuration
 */
export interface FrameworkIntegration {
  name: string;
  displayName: string;
  description: string;
  complexityLevels: string[];
  dependencies: string[];
  minimumVersion?: string;
}

/**
 * Individual example definition
 */
export interface ExampleDefinition {
  id: string;
  name: string;
  file: string;
  path?: string; // File path for compatibility
  tags: string[];
  complexity: 'basic' | 'intermediate' | 'advanced';
  framework?: string;
  priority: 'high' | 'medium' | 'low';
  description: string;
  prerequisites?: string[];
  dependencies?: string[];
  deprecated?: boolean;
  package?: string; // Package name for cross-package references
  diSupport?: boolean; // DI support flag
  frameworkIntegrations?: string[]; // Framework integrations
  validation?: {
    fileExists?: boolean;
    syntaxCheck?: boolean;
    compilationTest?: boolean;
    lintCheck?: boolean;
    exampleTest?: string;
  };
}

/**
 * Content configuration for examples
 */
export interface ContentConfig {
  showImportStatements: boolean;
  showErrorHandling: boolean;
  showTesting: boolean;
  showPerformance: boolean;
  includeBestPractices: boolean;
  includeCommonPitfalls: boolean;
  showVersionHistory: boolean;
}

/**
 * LLM optimization settings
 */
export interface LLMSupport {
  enabled: boolean;
  includePrompts: boolean;
  includeTips: boolean;
  includePatterns: boolean;
  optimizeForCodeGeneration: boolean;
}

/**
 * Related package configuration
 */
export interface RelatedPackage {
  priority: 'high' | 'medium' | 'low';
  relationship: 'depends-on' | 'enables' | 'publishes-to' | 'consumes-from';
  integrationExamples: string[];
}

/**
 * Tag system configuration
 */
export interface TagSystem {
  core: string[];
  integrations: string[];
  frameworks: string[];
  patterns: string[];
}

/**
 * Main package example configuration
 */
export interface PackageExampleConfig {
  packageName: string;
  displayName: string;
  version: string;
  description: string;
  domain: string;
  patterns: string[];

  // Dependencies for cross-package integration
  dependencies: string[];

  // Complexity levels with DI awareness
  complexityLevels: Record<string, ComplexityLevel>;

  // Framework integrations
  frameworks: FrameworkIntegration[];

  // Individual examples
  examples: ExampleDefinition[];

  // Smart tag system for cross-package discovery
  tags: TagSystem;

  // Content configuration
  contentConfig: ContentConfig;

  // LLM optimization settings
  llmSupport: LLMSupport;

  // Available sections for template generation
  sections: string[];

  // Cross-package example priorities
  relatedPackages: Record<string, RelatedPackage>;

  // Tag finder instance (optional)
  tagFinder?: any;
}

/**
 * Documentation generation options
 */
export interface GenerateDocumentationOptions {
  packageName: string;
  complexityLevels?: string[] | undefined;
  framework?: string | undefined;
  sections?: string[] | undefined;
  llmOptimized?: boolean | undefined;
  showRelated?: boolean | undefined;
  maxExamples?: number | undefined;
  randomize?: boolean | undefined;
  seed?: string | undefined;
  diOnly?: boolean | undefined;
  outputPath?: string | undefined;
}

/**
 * Bundle generation options
 */
export interface BundleGenerationOptions {
  packages?: string[];
  framework?: string;
  complexityLevels?: string[];
  sections?: string[];
  llmOptimized?: boolean;
  diOnly?: boolean;
  outputPath?: string;
}

/**
 * Generation result
 */
export interface GenerateDocumentationResult {
  outputPath: string;
  packageName: string;
  exampleCount: number;
  randomizedExamples?: string[];
  usedSections: string[];
  framework?: string;
  complexityLevels: string[];
}

/**
 * Bundle result
 */
export interface BundleResult {
  outputPath: string;
  packageCount: number;
  exampleCount: number;
  packages: string[];
  framework?: string;
  complexityLevels: string[];
}

/**
 * Example finder options
 */
export interface FindOptions {
  framework?: string | undefined;
  maxExamples?: number | undefined;
  randomize?: boolean | undefined;
  seed?: string | undefined;
  priorityFilter?: 'high' | 'medium' | 'low' | undefined;
}

/**
 * Validation result
 */
export interface ValidationResult {
  errors: ValidationError[];
  warnings: ValidationWarning[];
  fixed?: ValidationFix[];
  packagesValidated: number;
  examplesValidated: number;
}

/**
 * Validation error
 */
export interface ValidationError {
  package: string;
  example: string;
  message: string;
  type: 'file-missing' | 'syntax-error' | 'compilation-error' | 'lint-error';
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  package: string;
  example: string;
  message: string;
  type: 'deprecated' | 'missing-tags' | 'missing-description' | 'low-priority';
}

/**
 * Validation fix
 */
export interface ValidationFix {
  package: string;
  example: string;
  description: string;
  type: 'created-file' | 'updated-config' | 'fixed-syntax';
}
