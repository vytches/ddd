/**
 * Pure CLI Output Adapter - Clean Architecture
 * Handles ONLY CLI/markdown formatting, no metadata loading
 * Metadata comes from YamlMetadataEngine
 */

import type { ResolvedMetadata } from '../hierarchy/types';

/**
 * Pure CLI/markdown formatting adapter - no metadata loading logic
 * Follows single responsibility principle
 */
export class CliOutputAdapter {
  /**
   * Format resolved metadata as CLI/markdown output
   * This is the main public method - everything else is implementation detail
   */
  format(metadata: ResolvedMetadata): string {
    console.log(
      `[cli-output-adapter] Formatting metadata with ${Object.keys(metadata).length} keys`
    );

    const sections: string[] = [];

    // Add description as main header
    if (metadata.description) {
      sections.push(`## ${metadata.description}`);
      sections.push('');
    }

    // Add business context section
    this.addBusinessContext(sections, metadata);

    // Add metadata information
    this.addMetadataInfo(sections, metadata);

    // Add warnings section
    this.addWarnings(sections, metadata);

    // Add examples section
    this.addExamples(sections, metadata);

    // Add custom sections
    this.addCustomSections(sections, metadata);

    const result = sections.join('\n').trim();
    console.log(`[cli-output-adapter] Generated CLI output with ${sections.length} sections`);

    return result;
  }

  /**
   * Format metadata as compact one-line summary
   */
  formatSummary(metadata: ResolvedMetadata): string {
    const parts: string[] = [];

    if (metadata.description) {
      parts.push(metadata.description);
    }

    const metaParts: string[] = [];
    if (metadata.author) metaParts.push(`Author: ${metadata.author}`);
    if (metadata.since) metaParts.push(`Since: ${metadata.since}`);

    if (metaParts.length > 0) {
      parts.push(`(${metaParts.join(' | ')})`);
    }

    return parts.join(' ');
  }

  /**
   * Format only examples section
   */
  formatExamplesOnly(metadata: ResolvedMetadata): string {
    if (!metadata.examples || metadata.examples.length === 0) {
      return '';
    }

    const sections: string[] = [];
    this.addExamples(sections, metadata);

    return sections.join('\n').trim();
  }

  // Private implementation methods

  private addBusinessContext(sections: string[], metadata: ResolvedMetadata): void {
    if (!metadata.businessContext) {
      return;
    }

    sections.push('### Business Context');

    // Handle multiline business context (convert \n to actual newlines)
    const businessContext = this.enhanceForCLI(metadata.businessContext);
    sections.push(businessContext);
    sections.push('');
  }

  private addMetadataInfo(sections: string[], metadata: ResolvedMetadata): void {
    const metaInfo: string[] = [];

    if (metadata.author) metaInfo.push(`Author: ${metadata.author}`);
    if (metadata.since) metaInfo.push(`Since: ${metadata.since}`);
    if (metadata.license) metaInfo.push(`License: ${metadata.license}`);

    // Add tags if available
    if (metadata.tags && metadata.tags.length > 0) {
      metaInfo.push(`Tags: ${metadata.tags.join(', ')}`);
    }

    if (metaInfo.length > 0) {
      sections.push(metaInfo.join(' | '));
      sections.push('');
    }
  }

  private addWarnings(sections: string[], metadata: ResolvedMetadata): void {
    if (!metadata.warnings || metadata.warnings.length === 0) {
      return;
    }

    sections.push('### ⚠️ Warnings');
    metadata.warnings.forEach(warning => {
      sections.push(`- ${warning}`);
    });
    sections.push('');
  }

  private addExamples(sections: string[], metadata: ResolvedMetadata): void {
    if (!metadata.examples || metadata.examples.length === 0) {
      return;
    }

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

  private addCustomSections(sections: string[], metadata: ResolvedMetadata): void {
    // Track what we've already processed
    const processedFields = new Set([
      'description',
      'businessContext',
      'author',
      'since',
      'license',
      'tags',
      'warnings',
      'examples',
    ]);

    // Process custom fields as additional sections
    Object.keys(metadata).forEach(key => {
      if (!processedFields.has(key) && metadata[key]) {
        const value = metadata[key];

        // Skip empty values and format-specific keys
        if (!value || (Array.isArray(value) && value.length === 0) || key.includes('.')) {
          return;
        }

        // Format section header
        const sectionTitle = this.formatSectionTitle(key);
        sections.push(`### ${sectionTitle}`);

        // Format section content
        if (Array.isArray(value)) {
          value.forEach(item => {
            sections.push(`- ${item}`);
          });
        } else if (typeof value === 'object') {
          sections.push('```json');
          sections.push(JSON.stringify(value, null, 2));
          sections.push('```');
        } else {
          // Handle multiline content
          const content = this.enhanceForCLI(String(value));
          sections.push(content);
        }

        sections.push('');
      }
    });
  }

  /**
   * Convert metadata key to readable section title
   * Examples:
   * - "performanceNote" -> "Performance Note"
   * - "validation-rules" -> "Validation Rules"
   * - "customField" -> "Custom Field"
   */
  private formatSectionTitle(key: string): string {
    // Convert camelCase and kebab-case to Title Case
    return key
      .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase -> camel Case
      .replace(/-/g, ' ') // kebab-case -> kebab case
      .replace(/\b\w/g, l => l.toUpperCase()) // Title Case
      .trim();
  }

  /**
   * Enhance text for CLI display (convert literal \n to actual newlines)
   */
  private enhanceForCLI(text: string): string {
    if (!text) return text;

    // Convert literal \n to actual newlines for better CLI readability
    return text.replace(/\\n/g, '\n');
  }
}
