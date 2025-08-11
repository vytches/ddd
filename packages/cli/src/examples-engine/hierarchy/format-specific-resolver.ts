/**
 * Format-Specific Metadata Resolver for Enhanced Metadata System V2
 * Handles different output formats (jsdoc vs cli)
 */

import type { ResolvedMetadata } from './types';

export class FormatSpecificResolver {
  /**
   * Resolve metadata for specific output format (jsdoc vs cli)
   */
  static resolveForFormat(metadata: ResolvedMetadata, format: 'jsdoc' | 'cli'): ResolvedMetadata {
    const result = { ...metadata };

    // Apply format-specific overrides
    Object.keys(result).forEach(key => {
      const formatSpecificKey = `${key}.${format}`;

      if (metadata[formatSpecificKey]) {
        // Replace base value with format-specific value
        result[key] = metadata[formatSpecificKey];
      }
    });

    // Clean up format-specific keys from result
    Object.keys(result).forEach(key => {
      if (key.includes('.')) {
        delete result[key];
      }
    });

    // Special handling for CLI format
    if (format === 'cli') {
      result.description = this.enhanceForCLI(result.description);
      result.businessContext = this.enhanceForCLI(result.businessContext);
    }

    return result;
  }

  /**
   * Enhance text for CLI display (convert \n to actual newlines)
   */
  private static enhanceForCLI(text: string): string {
    if (!text) return text;

    // Convert literal \n to actual newlines
    return text.replace(/\\n/g, '\n');
  }

  /**
   * Format metadata as JSDoc comment
   */
  static formatAsJSDoc(metadata: ResolvedMetadata): string {
    const lines: string[] = ['/**'];

    // Known fields that need special handling
    const specialFields = ['description', 'businessContext', 'examples', 'warnings', 'tags'];

    // Add description first (no tag needed)
    if (metadata.description) {
      lines.push(` * ${metadata.description}`);
    }

    // Process all metadata fields
    const processedFields = new Set(['description']); // Track what we've already processed

    // Standard fields with known tags
    const standardFields: Array<[string, string]> = [
      ['businessContext', '@businessContext'],
      ['author', '@author'],
      ['since', '@since'],
      ['deprecated', '@deprecated'],
      ['see', '@see'],
      ['link', '@link'],
      ['todo', '@todo'],
      ['note', '@note'],
      ['license', '@license'],
    ];

    // Process standard fields
    for (const [field, tag] of standardFields) {
      if (metadata[field]) {
        lines.push(` * ${tag} ${metadata[field]}`);
        processedFields.add(field);
      }
    }

    // Add warnings (array field)
    if (metadata.warnings && Array.isArray(metadata.warnings) && metadata.warnings.length > 0) {
      metadata.warnings.forEach(warning => {
        lines.push(` * @warning ${warning}`);
      });
      processedFields.add('warnings');
    }

    // Add tags (array field)
    if (metadata.tags && Array.isArray(metadata.tags) && metadata.tags.length > 0) {
      lines.push(` * @tags ${metadata.tags.join(', ')}`);
      processedFields.add('tags');
    }

    // Process ANY other custom fields not yet processed
    Object.keys(metadata).forEach(key => {
      if (!processedFields.has(key) && !specialFields.includes(key) && metadata[key]) {
        const value = metadata[key];

        // Skip empty values
        if (!value || (Array.isArray(value) && value.length === 0)) {
          return;
        }

        // Format the tag name (convert camelCase to @camel-case)
        const tagName = this.formatCustomTag(key);

        // Handle different value types
        if (Array.isArray(value)) {
          // Array values - join with commas
          lines.push(` * ${tagName} ${value.join(', ')}`);
        } else if (typeof value === 'object') {
          // Object values - stringify
          lines.push(` * ${tagName} ${JSON.stringify(value)}`);
        } else {
          // Simple values - add as-is
          lines.push(` * ${tagName} ${value}`);
        }
      }
    });

    // Add examples last with TypeScript formatting
    if (metadata.examples && metadata.examples.length > 0) {
      processedFields.add('examples');
      metadata.examples.forEach(example => {
        lines.push(' * @example');
        lines.push(' * ```typescript');

        // Handle both string examples and object examples with { id, code }
        let exampleCode: string;
        if (typeof example === 'string') {
          exampleCode = example;
        } else if (
          example &&
          typeof example === 'object' &&
          'code' in example &&
          typeof (example as any).code === 'string'
        ) {
          exampleCode = (example as any).code;
        } else {
          // Fallback for unexpected format
          exampleCode = String(example);
        }

        // Split example by lines and add proper indentation
        const exampleLines = exampleCode.split('\n');
        exampleLines.forEach(line => {
          lines.push(` * ${line}`);
        });

        lines.push(' * ```');
      });
    }

    lines.push(' */');

    return lines.join('\n');
  }

  /**
   * Format custom tag name from key
   * Examples:
   * - "abc" -> "@abc"
   * - "customTag" -> "@custom-tag"
   * - "documentation-url" -> "@documentation-url"
   * - "complexityNote" -> "@complexity-note"
   */
  private static formatCustomTag(key: string): string {
    // If already starts with @, return as-is
    if (key.startsWith('@')) {
      return key;
    }

    // Convert camelCase to kebab-case
    const kebabCase = key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

    return `@${kebabCase}`;
  }

  /**
   * Format metadata for CLI display
   */
  static formatForCLI(metadata: ResolvedMetadata): string {
    const sections: string[] = [];

    // Add description as header
    if (metadata.description) {
      sections.push(`## ${metadata.description}`);
      sections.push('');
    }

    // Add business context
    if (metadata.businessContext) {
      sections.push('### Business Context');
      sections.push(metadata.businessContext);
      sections.push('');
    }

    // Add metadata info
    const metaInfo: string[] = [];
    if (metadata.author) metaInfo.push(`Author: ${metadata.author}`);
    if (metadata.since) metaInfo.push(`Since: ${metadata.since}`);
    if (metaInfo.length > 0) {
      sections.push(metaInfo.join(' | '));
      sections.push('');
    }

    // Add warnings
    if (metadata.warnings && metadata.warnings.length > 0) {
      sections.push('### ⚠️ Warnings');
      metadata.warnings.forEach(warning => {
        sections.push(`- ${warning}`);
      });
      sections.push('');
    }

    // Add examples
    if (metadata.examples && metadata.examples.length > 0) {
      sections.push('### Examples');
      metadata.examples.forEach((example, index) => {
        if (metadata.examples.length > 1) {
          sections.push(`#### Example ${index + 1}`);
        }
        sections.push('```typescript');
        sections.push(example);
        sections.push('```');
        sections.push('');
      });
    }

    return sections.join('\n').trim();
  }
}
