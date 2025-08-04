/**
 * Legacy contracts types that were removed from @vytches/ddd-contracts
 * These are now defined locally in the CLI package for backward compatibility
 * while transitioning to the YAML-based metadata system
 */

export type ComplexityLevel = 'basic' | 'intermediate' | 'advanced';

export interface ExampleDefinition {
  id: string;
  name: string;
  file: string;
  path?: string;
  tags: string[];
  complexity: ComplexityLevel;
  framework?: string;
  priority: 'high' | 'medium' | 'low';
  description: string;
  prerequisites?: string[];
  dependencies?: string[];
  deprecated?: boolean;
  package?: string;
  diSupport?: boolean;
  frameworkIntegrations?: FrameworkIntegration[];
  validation?: {
    fileExists?: boolean;
    syntaxCheck?: boolean;
    compilationTest?: boolean;
    lintCheck?: boolean;
    exampleTest?: string;
  };
}

export interface PackageExampleConfig {
  package?: string;
  packageName?: string;
  displayName: string;
  description: string;
  version: string;
  domain?: string;
  patterns?: string[];
  dependencies?: string[];
  examples: ExampleDefinition[];
  framework?: FrameworkIntegration;
  frameworks?: FrameworkIntegration[];
  content?: ContentConfig;
  contentConfig?: ContentConfig;
  llmSupport?: LLMSupport;
  tags?: TagSystem;
  relatedPackages?: RelatedPackage[] | Record<string, any>;
  sections?: string[];
  complexityLevels?: Record<string, any>;
  tagFinder?: {
    seed?: string;
    [key: string]: any;
  };
}

export interface FrameworkIntegration {
  name: string;
  displayName?: string;
  description?: string;
  supported?: string[];
  complexityLevels?: ComplexityLevel[];
  dependencies?: string[];
  defaultComplexity?: ComplexityLevel;
}

export interface ContentConfig {
  baseExamplesPath?: string;
  frameworkExamplesPath?: string;
  sections?: string[];
  complexityLevels?: ComplexityLevel[];
  showImportStatements?: boolean;
  showErrorHandling?: boolean;
  showTesting?: boolean;
  showPerformance?: boolean;
  includeBestPractices?: boolean;
  includeCommonPitfalls?: boolean;
  showVersionHistory?: boolean;
}

export interface LLMSupport {
  enabled: boolean;
  summaryFormat?: 'default' | 'enhanced';
  includeTypes?: boolean;
  includeTests?: boolean;
  includePrompts?: boolean;
  includeTips?: boolean;
  includePatterns?: boolean;
  optimizeForCodeGeneration?: boolean;
  metadata?: Record<string, unknown>;
}

export interface TagSystem {
  core?: string[];
  integrations?: string[];
  frameworks?: string[];
  domain?: string[];
  patterns?: string[];
  features?: string[];
  custom?: string[];
}

export interface RelatedPackage {
  name: string;
  optional: boolean;
  description: string;
}

// Documentation generation types
export interface GenerateDocumentationOptions {
  package: string;
  complexity?: ComplexityLevel;
  framework?: string;
  sections?: string[];
  format?: 'jsdoc' | 'cli';
  llmOptimized?: boolean;
  enhancedMetadata?: boolean;
  maxExamples?: number;
  randomize?: boolean;
  seed?: string;
}

export interface GenerateDocumentationResult {
  content: string;
  metadata: {
    package: string;
    complexity?: ComplexityLevel;
    framework?: string;
    exampleCount: number;
    generatedAt: Date;
  };
}

// Bundle generation types
export interface BundleGenerationOptions {
  packages: string[];
  framework?: string;
  complexity?: ComplexityLevel;
  outputPath?: string;
  includeIndex?: boolean;
  llmOptimized?: boolean;
}

export interface BundleResult {
  files: string[];
  totalExamples: number;
  packages: string[];
}

// Find options
export interface FindOptions {
  tag: string;
  complexity?: ComplexityLevel;
  framework?: string;
  maxExamples?: number;
  randomize?: boolean;
  seed?: string;
}

// Validation types
export interface ValidationResult {
  valid: boolean;
  warnings: ValidationWarning[];
  errors: ValidationError[];
  fixes?: ValidationFix[];
}

export interface ValidationWarning {
  file: string;
  line?: number;
  message: string;
  type: string;
}

export interface ValidationError {
  file: string;
  line?: number;
  message: string;
  type: string;
}

export interface ValidationFix {
  file: string;
  line?: number;
  fix: string;
  description: string;
}
