/**
 * @llm-summary Documentation parsing and generation types for CLI
 * @llm-domain Infrastructure
 * @llm-complexity Medium
 *
 * @description
 * Types for parsing, processing and generating documentation from example files.
 * These types replace the old *Example naming pattern with more descriptive names.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const parsed: ParsedDocumentationSet = await parser.parseDocumentation(options);
 * ```
 *
 * @example
 * ```typescript
 * // Registry usage
 * const registry = new DocumentationRegistry();
 * await registry.loadAll();
 * const content = registry.findById('example-id');
 * ```
 *
 * @since 1.0.0
 * @public
 */

// No need to import ComponentType from './index' since we define FrameworkComponentType

/**
 * Framework component types for documentation generation
 */
export type FrameworkComponentType =
  | 'module'
  | 'service'
  | 'controller'
  | 'repository'
  | 'dto'
  | 'config'
  | 'middleware'
  | 'guard'
  | 'interceptor';
import type { ExampleDefinition } from '@vytches/ddd-contracts';

/**
 * Parsed documentation set containing base content and optional framework integration
 */
export interface ParsedDocumentationSet {
  base: BaseDocumentationContent;
  framework?: FrameworkIntegrationContent;
  merged: MergedDocumentationContent;
}

/**
 * Base documentation content extracted from markdown files
 */
export interface BaseDocumentationContent {
  metadata: EnhancedExampleDefinition;
  content: {
    description: string;
    businessContext: string;
    codeExample: string;
    supportingTypes: string;
    usageExample: string;
    testExample: string;
    commonPitfalls: string[];
    migrationNotes: string;
  };
}

/**
 * Framework-specific integration content
 */
export interface FrameworkIntegrationContent {
  framework: 'nestjs' | 'express' | 'fastify';
  baseExampleId: string;
  components: Map<FrameworkComponentType, string>;
  configuration: string;
  installation: string;
  errorHandling: string;
  testing: string;
  deployment: string;
}

/**
 * Merged documentation containing both base and framework content
 */
export interface MergedDocumentationContent {
  metadata: EnhancedExampleDefinition;
  baseContent: BaseDocumentationContent['content'];
  frameworkContent?: FrameworkIntegrationContent;
  availableComponents: FrameworkComponentType[];
}

/**
 * Framework integration definition for examples
 */
export interface FrameworkIntegrationDefinition {
  framework: 'nestjs' | 'express' | 'fastify';
  path: string;
  components: FrameworkComponentType[];
}

/**
 * Enhanced example definition with framework integration support
 */
export interface EnhancedExampleDefinition {
  id: string;
  name: string;
  file: string;
  path?: string;
  tags: string[];
  complexity: 'basic' | 'intermediate' | 'advanced';
  framework?: string;
  priority: 'high' | 'medium' | 'low';
  description: string;
  prerequisites?: string[];
  dependencies?: string[];
  deprecated?: boolean;
  package?: string;
  diSupport?: boolean;
  // Enhanced field with rich framework integration support
  frameworkIntegrations?: FrameworkIntegrationDefinition[];
  validation?: {
    fileExists?: boolean;
    syntaxCheck?: boolean;
    compilationTest?: boolean;
    lintCheck?: boolean;
    exampleTest?: string;
  };
  // Additional fields for enhanced functionality
  domain?: string;
  patterns?: string[];
}

/**
 * Query options for finding documentation content
 */
export interface ExampleQueryOptions {
  package?: string;
  complexity?: 'basic' | 'intermediate' | 'advanced';
  domain?: string;
  pattern?: string;
  framework?: 'nestjs' | 'express' | 'fastify';
  tags?: string[];
}

/**
 * Documentation registry for managing example definitions and content
 */
export interface IDocumentationRegistry {
  /**
   * Load all example definitions from packages
   */
  loadAll(): Promise<void>;

  /**
   * Find example by ID
   */
  findById(id: string): EnhancedExampleDefinition | undefined;

  /**
   * Query examples by criteria
   */
  query(options: ExampleQueryOptions): EnhancedExampleDefinition[];

  /**
   * Get available frameworks for an example
   */
  getAvailableFrameworks(exampleId: string): string[];

  /**
   * Get available components for framework integration
   */
  getAvailableComponents(exampleId: string, framework: string): FrameworkComponentType[];

  /**
   * Get all packages with examples
   */
  getPackages(): string[];

  /**
   * Get all available frameworks
   */
  getAllFrameworks(): string[];
}

/**
 * Component section mapping for framework integrations
 */
export type ComponentSectionMapping = Record<FrameworkComponentType, string>;

/**
 * Documentation parsing options
 */
export interface DocumentationParseOptions {
  exampleId: string;
  framework?: 'nestjs' | 'express' | 'fastify' | undefined;
  version?: string | undefined;
}

/**
 * Documentation content filtering options
 */
export interface DocumentationFilterOptions {
  only?: FrameworkComponentType[];
  exclude?: FrameworkComponentType[];
}

/**
 * Global documentation registry instance
 */
export declare const globalDocumentationRegistry: IDocumentationRegistry;
