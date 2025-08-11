/**
 * Pure JSDoc Output Adapter - Clean Architecture
 * Handles ONLY JSDoc formatting, no metadata loading
 * Metadata comes from YamlMetadataEngine
 */

import type { ResolvedMetadata } from '../hierarchy/types';

/**
 * Pure JSDoc formatting adapter - no metadata loading logic
 * Follows single responsibility principle
 */
export class JsDocOutputAdapter {
  /**
   * Format resolved metadata as JSDoc comment
   * This is the main public method - everything else is implementation detail
   */
  format(metadata: ResolvedMetadata): string {
    console.log(
      `[jsdoc-output-adapter] Formatting metadata with ${Object.keys(metadata).length} keys`
    );

    const lines: string[] = ['/**'];

    // Add description first (no tag needed)
    if (metadata.description) {
      lines.push(` * ${metadata.description}`);
      lines.push(' *');
    }

    // Process standard JSDoc tags in logical order
    this.addStandardTags(lines, metadata);

    // Add custom tags (any metadata not in standard set)
    this.addCustomTags(lines, metadata);

    // Add examples last with proper TypeScript formatting
    this.addExamples(lines, metadata);

    lines.push(' */');

    const result = lines.join('\n');
    console.log(`[jsdoc-output-adapter] Generated JSDoc with ${lines.length} lines`);

    return result;
  }

  /**
   * Format metadata as single-line JSDoc tag (for injection)
   */
  formatSingleTag(key: string, value: string): string {
    const tagName = this.getJSDocTagName(key);
    return `${tagName} ${value}`;
  }

  /**
   * Format examples as JSDoc @example blocks
   */
  formatExamples(examples: string[]): string {
    if (!examples || examples.length === 0) {
      return '';
    }

    const lines: string[] = [];

    examples.forEach((example, index) => {
      if (index > 0) {
        lines.push(' *');
      }
      lines.push(' * @example');
      lines.push(' * ```typescript');

      // Split example by lines and add proper JSDoc formatting
      const exampleLines = example.split('\n');
      exampleLines.forEach(line => {
        lines.push(` * ${line}`);
      });

      lines.push(' * ```');
    });

    return lines.join('\n');
  }

  // Private implementation methods

  private addStandardTags(lines: string[], metadata: ResolvedMetadata): void {
    // Standard JSDoc tags in logical order
    const standardTags: Array<[string, string]> = [
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

    let addedAny = false;

    for (const [field, tag] of standardTags) {
      if (metadata[field]) {
        lines.push(` * ${tag} ${metadata[field]}`);
        addedAny = true;
      }
    }

    // Add warnings (array field)
    if (metadata.warnings && Array.isArray(metadata.warnings) && metadata.warnings.length > 0) {
      metadata.warnings.forEach(warning => {
        lines.push(` * @warning ${warning}`);
      });
      addedAny = true;
    }

    // Add tags (array field)
    if (metadata.tags && Array.isArray(metadata.tags) && metadata.tags.length > 0) {
      lines.push(` * @tags ${metadata.tags.join(', ')}`);
      addedAny = true;
    }

    // Add separator if we added any standard tags
    if (addedAny) {
      lines.push(' *');
    }
  }

  private addCustomTags(lines: string[], metadata: ResolvedMetadata): void {
    // Track what we've already processed
    const processedFields = new Set([
      'description',
      'businessContext',
      'author',
      'since',
      'deprecated',
      'see',
      'link',
      'todo',
      'note',
      'license',
      'warnings',
      'tags',
      'examples',
    ]);

    const customFields: string[] = [];

    // Process any custom fields not in standard set
    Object.keys(metadata).forEach(key => {
      if (!processedFields.has(key) && metadata[key]) {
        const value = metadata[key];

        // Skip empty values and format-specific keys
        if (!value || (Array.isArray(value) && value.length === 0) || key.includes('.')) {
          return;
        }

        // Format the tag name
        const tagName = this.formatCustomTagName(key);

        // Handle different value types
        if (Array.isArray(value)) {
          customFields.push(` * ${tagName} ${value.join(', ')}`);
        } else if (typeof value === 'object') {
          customFields.push(` * ${tagName} ${JSON.stringify(value)}`);
        } else {
          customFields.push(` * ${tagName} ${value}`);
        }
      }
    });

    // Add custom fields
    customFields.forEach(field => lines.push(field));

    // Add separator if we added any custom tags
    if (customFields.length > 0) {
      lines.push(' *');
    }
  }

  private addExamples(lines: string[], metadata: ResolvedMetadata): void {
    if (!metadata.examples || !metadata.examples.length) {
      return;
    }

    metadata.examples.forEach((example, index) => {
      if (index > 0) {
        lines.push(' *');
      }
      lines.push(' * @example');
      lines.push(' * ```typescript');

      // Split example by lines and add proper indentation
      const exampleLines = example.split('\n');
      exampleLines.forEach(line => {
        lines.push(` * ${line}`);
      });

      lines.push(' * ```');
    });
  }

  /**
   * Map metadata keys to JSDoc tag names
   */
  private getJSDocTagName(key: string): string {
    const mapping: Record<string, string> = {
      description: '@description',
      'business-context': '@businessContext',
      businessContext: '@businessContext',
      author: '@author',
      since: '@since',
      warning: '@warning',
      deprecated: '@deprecated',
      see: '@see',
      'performance-note': '@performance',
      'complexity-note': '@complexity',
      'validation-rules': '@validation',
      'documentation-url': '@see',
      license: '@license',
      'recommended-for': '@note',
      'learning-focus': '@note',
    };

    return mapping[key] || `@${key}`;
  }

  /**
   * Format custom tag name from metadata key
   * Examples:
   * - "customTag" -> "@custom-tag"
   * - "documentation-url" -> "@documentation-url"
   * - "complexityNote" -> "@complexity-note"
   */
  private formatCustomTagName(key: string): string {
    // If already starts with @, return as-is
    if (key.startsWith('@')) {
      return key;
    }

    // Convert camelCase to kebab-case
    const kebabCase = key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

    return `@${kebabCase}`;
  }
}
