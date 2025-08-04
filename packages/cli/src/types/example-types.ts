/**
 * @llm-summary Example types for backward compatibility
 * @llm-domain Infrastructure
 * @llm-complexity Medium
 *
 * @description
 * Legacy example types - now deprecated in favor of documentation-types.
 * This file provides backward compatibility for existing code.
 *
 * @example
 * ```typescript
 * // Import from new location instead
 * import type { ExampleDefinition } from '@vytches/ddd-contracts';
 * import type { ParsedDocumentationSet } from './documentation-types';
 * ```
 *
 * @since 1.0.0
 * @deprecated Use documentation-types.ts instead
 * @public
 */

// Re-export for backward compatibility
export type {
  ParsedDocumentationSet as ParsedExample,
  BaseDocumentationContent as BaseExample,
  FrameworkIntegrationContent as FrameworkExample,
  MergedDocumentationContent as MergedExample,
  DocumentationParseOptions as ParseExampleOptions,
  DocumentationFilterOptions as FilterOptions,
  FrameworkComponentType as ComponentType,
} from './documentation-types';

export type {
  ExampleDefinition,
  PackageExampleConfig,
  ComplexityLevel,
  FrameworkIntegration,
  ContentConfig,
  LLMSupport,
  TagSystem,
  RelatedPackage,
} from './legacy-contracts';
