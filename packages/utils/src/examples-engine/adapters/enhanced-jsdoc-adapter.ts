/**
 * Enhanced JSDoc adapter for new metadata format
 */

import type { ExtractBlock } from '../types/enhanced-metadata.types';

export class EnhancedJSDocAdapter {
  /**
   * Convert extract block to JSDoc format
   */
  formatBlock(block: ExtractBlock): string {
    const parts: string[] = [];

    // Add description if present
    if (block.metadata.description) {
      parts.push(block.metadata.description);
    }

    // Add other metadata as JSDoc tags
    Object.entries(block.metadata).forEach(([key, value]) => {
      if (key === 'description') return; // Already added

      // Convert metadata key to JSDoc tag format
      const tagName = this.getJSDocTagName(key);
      if (tagName) {
        parts.push(`${tagName} ${value}`);
      }
    });

    // Add code example
    if (block.code) {
      parts.push('@example');
      parts.push(block.code);
    }

    return parts.join('\n');
  }

  /**
   * Format multiple blocks for method documentation
   */
  formatMethodDoc(blocks: ExtractBlock[]): string {
    if (blocks.length === 0) return '';

    // Use first block's description/business-context as main doc
    const mainBlock = blocks[0];
    if (!mainBlock) return '';

    const mainParts: string[] = [];

    if (mainBlock.metadata.description) {
      mainParts.push(mainBlock.metadata.description);
    }

    if (mainBlock.metadata['business-context']) {
      mainParts.push(`@business ${mainBlock.metadata['business-context']}`);
    }

    // Add all examples
    blocks.forEach((block, index) => {
      if (block.code) {
        const exampleLabel =
          blocks.length > 1 ? `@example <caption>${block.level} example</caption>` : '@example';
        mainParts.push(exampleLabel);
        mainParts.push(block.code);
      }
    });

    return mainParts.join('\n');
  }

  /**
   * Map metadata keys to JSDoc tags
   */
  private getJSDocTagName(key: string): string | null {
    const mapping: Record<string, string> = {
      'business-context': '@business',
      author: '@author',
      since: '@since',
      warning: '@warning',
      deprecated: '@deprecated',
      see: '@see',
      'performance-note': '@performance',
      'complexity-note': '@complexity',
      'validation-rules': '@validation',
    };

    return mapping[key] || null;
  }

  /**
   * Generate complete JSDoc comment
   */
  generateJSDocComment(blocks: ExtractBlock[], indent = ''): string {
    const content = this.formatMethodDoc(blocks);
    if (!content) return '';

    const lines = content.split('\n');
    const commentLines = [
      `${indent}/**`,
      ...lines.map(line => `${indent} * ${line}`),
      `${indent} */`,
    ];

    return commentLines.join('\n');
  }
}
