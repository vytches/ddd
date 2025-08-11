/**
 * Enhanced metadata types for hierarchical documentation system
 */

export interface MetadataValue {
  default?: string;
  jsdoc?: string;
  cli?: string;
  [format: string]: string | undefined;
}

export interface ParsedMetadata {
  [key: string]: MetadataValue;
}

export interface ConfigLevel {
  source: 'library' | 'package' | 'file' | 'local';
  strategy: 'merge' | 'replace';
  scope?: string | undefined; // e.g., 'advanced', 'basic'
  metadata: ParsedMetadata;
}

export interface ResolvedMetadata {
  [key: string]: string;
}

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

export interface GlobalSettings {
  strategy: 'merge' | 'replace';
  metadata: ParsedMetadata;
  scope?: string | undefined;
}

export interface FormatRules {
  [format: string]: {
    [metadataKey: string]: (content: string) => string;
  };
}
