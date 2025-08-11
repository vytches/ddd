/**
 * Metadata Resolution Strategies for Enhanced Metadata System V2
 * Implements merge, replace, and append strategies
 */

import type { MetadataSource, ResolvedMetadata } from './types';

export class MetadataResolutionStrategies {
  /**
   * Apply hierarchical resolution with different strategies
   */
  static applyHierarchy(sources: MetadataSource[]): ResolvedMetadata {
    const result: ResolvedMetadata = {
      description: '',
      businessContext: '',
      examples: [],
      author: '',
      since: '',
      tags: [],
      warnings: [],
    };

    for (const source of sources) {
      switch (source.strategy) {
        case 'merge':
          this.mergeStrategy(result, source.metadata);
          break;
        case 'replace':
          this.replaceStrategy(result, source.metadata);
          break;
        case 'append':
          this.appendStrategy(result, source.metadata);
          break;
      }
    }

    return result;
  }

  /**
   * Merge strategy - combines content from lower levels, higher levels override lower levels
   */
  private static mergeStrategy(target: ResolvedMetadata, source: Record<string, unknown>): void {
    // Merge simple string fields - higher levels (later in iteration) override lower levels
    const stringFields = ['description', 'businessContext', 'author', 'since'];
    for (const field of stringFields) {
      if (source[field]) {
        target[field] = source[field];
        console.log(
          `[resolution-strategies] Merged ${field}: ${source[field]} (hierarchy override)`
        );
      }

      // Handle format-specific fields (e.g., description.jsdoc)
      Object.keys(source).forEach(key => {
        if (key.startsWith(`${field}.`)) {
          (target as Record<string, unknown>)[key] = source[key];
        }
      });
    }

    // Merge arrays (combine unique values)
    if (source.examples && Array.isArray(source.examples)) {
      target.examples = Array.from(new Set([...target.examples, ...source.examples]));
      console.log(
        `[resolution-strategies] Merged examples: ${source.examples.length} added, total: ${target.examples.length}`
      );
    }

    if (source.tags && Array.isArray(source.tags)) {
      target.tags = Array.from(new Set([...(target.tags || []), ...source.tags]));
    }

    if (source.warnings && Array.isArray(source.warnings)) {
      target.warnings = Array.from(new Set([...(target.warnings || []), ...source.warnings]));
    }

    // Copy any additional fields not in base structure
    Object.keys(source).forEach(key => {
      if (!Object.prototype.hasOwnProperty.call(target, key) && !key.includes('.')) {
        (target as Record<string, unknown>)[key] = source[key];
      }
    });
  }

  /**
   * Replace strategy - completely overrides content from lower levels
   */
  private static replaceStrategy(target: ResolvedMetadata, source: Record<string, unknown>): void {
    // Replace all matching fields from source
    Object.keys(source).forEach(key => {
      // Handle base fields
      if (Object.prototype.hasOwnProperty.call(target, key) || key.includes('.')) {
        (target as Record<string, unknown>)[key] = source[key];
      } else {
        // Add new fields
        (target as Record<string, unknown>)[key] = source[key];
      }
    });

    // Special handling for arrays - complete replacement
    if (source.examples !== undefined) {
      target.examples = Array.isArray(source.examples) ? source.examples : [];
    }
    if (source.tags !== undefined) {
      target.tags = Array.isArray(source.tags) ? source.tags : [];
    }
    if (source.warnings !== undefined) {
      target.warnings = Array.isArray(source.warnings) ? source.warnings : [];
    }
  }

  /**
   * Append strategy - adds content to existing metadata
   */
  private static appendStrategy(target: ResolvedMetadata, source: Record<string, unknown>): void {
    // Append to string fields with newlines
    if (source.description && typeof source.description === 'string') {
      target.description = target.description
        ? `${target.description}\n\n${source.description}`
        : source.description;
    }

    if (source.businessContext && typeof source.businessContext === 'string') {
      target.businessContext = target.businessContext
        ? `${target.businessContext}\n\n${source.businessContext}`
        : source.businessContext;
    }

    // Handle format-specific appends
    Object.keys(source).forEach(key => {
      if (key.includes('.') && key.startsWith('description.')) {
        const existingValue = (target as Record<string, unknown>)[key] as string | undefined;
        (target as Record<string, unknown>)[key] = existingValue
          ? `${existingValue}\n\n${source[key]}`
          : source[key];
      } else if (key.includes('.') && key.startsWith('businessContext.')) {
        const existingValue = (target as Record<string, unknown>)[key] as string | undefined;
        (target as Record<string, unknown>)[key] = existingValue
          ? `${existingValue}\n\n${source[key]}`
          : source[key];
      }
    });

    // For arrays, always append (no deduplication)
    if (source.examples && Array.isArray(source.examples)) {
      target.examples = [...target.examples, ...source.examples];
    }

    if (source.tags && Array.isArray(source.tags)) {
      target.tags = [...(target.tags || []), ...source.tags];
    }

    if (source.warnings && Array.isArray(source.warnings)) {
      target.warnings = [...(target.warnings || []), ...source.warnings];
    }

    // Other fields use merge logic
    const skipFields = ['description', 'businessContext', 'examples', 'tags', 'warnings'];
    Object.keys(source).forEach(key => {
      if (
        !skipFields.includes(key) &&
        !key.includes('.') &&
        !(target as Record<string, unknown>)[key]
      ) {
        (target as Record<string, unknown>)[key] = source[key];
      }
    });
  }
}
