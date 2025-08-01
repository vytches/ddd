/**
 * Enhanced metadata types for hierarchical documentation system
 */

export interface MetadataValue {
  default?: string;
  jsdoc?: string;
  cli?: string;
  [format: string]: string | undefined;
}

/**
 * @llm-summary Contract for parsed metadata functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 * 
 * @description
 * ParsedMetadata interface implementing infrastructure service for parsed metadata operations.
 * 
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteParsedMetadata implements ParsedMetadata {
 *   // Implementation
 * }
 * ```
 * 
 * @since 1.0.0
 * @public
 */
export interface ParsedMetadata {
  [key: string]: MetadataValue;
}

/**
 * @llm-summary Contract for config level functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 * 
 * @description
 * ConfigLevel interface implementing infrastructure service for config level operations.
 * 
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteConfigLevel implements ConfigLevel {
 *   // Implementation
 * }
 * ```
 * 
 * @since 1.0.0
 * @public
 */
export interface ConfigLevel {
  source: 'library' | 'package' | 'file' | 'local';
  strategy: 'merge' | 'replace';
  scope?: string | undefined; // e.g., 'advanced', 'basic'
  metadata: ParsedMetadata;
}

/**
 * @llm-summary Contract for resolved metadata functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 * 
 * @description
 * ResolvedMetadata interface implementing infrastructure service for resolved metadata operations.
 * 
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteResolvedMetadata implements ResolvedMetadata {
 *   // Implementation
 * }
 * ```
 * 
 * @since 1.0.0
 * @public
 */
export interface ResolvedMetadata {
  [key: string]: string;
}

/**
 * @llm-summary Contract for extract block functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 * 
 * @description
 * ExtractBlock interface implementing infrastructure service for extract block operations.
 * 
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteExtractBlock implements ExtractBlock {
 *   // Implementation
 * }
 * ```
 * 
 * @since 1.0.0
 * @public
 */
export interface ExtractBlock {
  tag: string;
  target: string;
  context: string;
  level: string;
  variant?: string | undefined;
  metadata: ResolvedMetadata;
  code: string;
  startLine: number;
  endLine: number;
}

/**
 * @llm-summary Contract for global settings functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 * 
 * @description
 * GlobalSettings interface implementing infrastructure service for global settings operations.
 * 
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteGlobalSettings implements GlobalSettings {
 *   // Implementation
 * }
 * ```
 * 
 * @since 1.0.0
 * @public
 */
export interface GlobalSettings {
  strategy: 'merge' | 'replace';
  metadata: ParsedMetadata;
  scope?: string | undefined;
}

/**
 * @llm-summary Contract for format rules functionality
 * @llm-domain Infrastructure
 * @llm-contract Required
 * 
 * @description
 * FormatRules interface implementing infrastructure service for format rules operations.
 * 
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteFormatRules implements FormatRules {
 *   // Implementation
 * }
 * ```
 * 
 * @since 1.0.0
 * @public
 */
export interface FormatRules {
  [format: string]: {
    [metadataKey: string]: (content: string) => string;
  };
}