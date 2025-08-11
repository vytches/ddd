/**
 * Types for Hierarchical Metadata Resolution System V2
 */

export enum MetadataLevel {
  GLOBAL = 0, // docs/global-settings.md
  PACKAGE = 1, // packages/[package]/.md-settings.md
  CLASS = 2, // docs/examples/domain/[package]/[class].md
  METHOD = 3, // docs/examples/domain/[package]/[class]/[method].md
  INLINE = 4, // Direct in TypeScript code
}

export type ResolutionStrategy = 'merge' | 'replace' | 'append';

export interface MetadataSource {
  level: MetadataLevel;
  filePath: string;
  metadata: Record<string, any>;
  strategy: ResolutionStrategy;
}

export interface ResolvedMetadata {
  description: string;
  businessContext: string;
  examples: string[];
  author?: string;
  since?: string;
  tags?: string[];
  warnings?: string[];
  // Format-specific fields
  [key: string]: any;
}

export interface HierarchyConfig {
  packageName: string;
  className: string;
  methodName: string;
  format?: 'jsdoc' | 'cli';
}

export interface MetadataParseResult {
  metadata: Record<string, any>;
  strategy: ResolutionStrategy;
  errors?: string[];
}

export interface PerformanceMetrics {
  cacheHits: number;
  cacheMisses: number;
  filesProcessed: number;
  totalTime: number;
  averageTime: number;
}
