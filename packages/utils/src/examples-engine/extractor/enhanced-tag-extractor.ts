/**
 * Enhanced tag extraction system with metadata support
 * Handles @extract tags with flexible format and metadata parsing
 */

import type { ExtractBlock, ResolvedMetadata, ConfigLevel } from '../types/enhanced-metadata.types';
import { EnhancedMetadataParser } from '../parser/enhanced-metadata-parser';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * @llm-summary EnhancedTagExtractor class for enhanced tag extractor operations
 * @llm-domain Infrastructure
 * @llm-complexity Medium
 *
 * @description
 * EnhancedTagExtractor class implementing infrastructure service for enhanced tag extractor operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new EnhancedTagExtractor();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new EnhancedTagExtractor());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export class EnhancedTagExtractor {
  private static readonly EXTRACT_START_PATTERN = /@extract:\s*([^:\s]+)(?::([^:\s]+))?(?::([^:\s]+))?(?::([^:\s]+))?/;
  private static readonly EXTRACT_END_PATTERN = /@extract-end/;
  private static readonly GLOBAL_SETTINGS_FILE = 'global-settings.md';
  private static readonly PACKAGE_SETTINGS_FILE = '.md-settings.md';

  private metadataParser: EnhancedMetadataParser;
  private configCache = new Map<string, ConfigLevel[]>();

  constructor() {
    this.metadataParser = new EnhancedMetadataParser();
  }

  /**
   * Extract all tagged sections with resolved metadata
   */
  async extractAllBlocks(
    content: string,
    filePath: string,
    format: 'jsdoc' | 'cli' = 'cli'
  ): Promise<ExtractBlock[]> {
    const lines = content.split('\n');
    const blocks: ExtractBlock[] = [];

    // Load configuration hierarchy
    const configs = await this.loadConfigHierarchy(filePath);

    // Parse file-level global settings
    const fileGlobalSettings = this.metadataParser.parseGlobalSettings(content);
    if (fileGlobalSettings.length > 0) {
      configs.push(...fileGlobalSettings.map(settings => ({
        source: 'file' as const,
        strategy: settings.strategy,
        scope: settings.scope || undefined,
        metadata: settings.metadata,
      })));
    }

    let currentBlock: Partial<ExtractBlock> | null = null;
    let blockContent: string[] = [];
    let blockMetadata: string[] = [];
    let inCodeBlock = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const trimmed = line.trim();

      // Check for extract start
      const startMatch = trimmed.match(EnhancedTagExtractor.EXTRACT_START_PATTERN);
      if (startMatch) {
        // Save previous block if exists
        if (currentBlock && blockContent.length > 0) {
          blocks.push(this.finalizeBlock(
            currentBlock,
            blockContent,
            blockMetadata,
            configs,
            format
          ));
        }

        // Parse tag components
        const [, target, context = 'domain', level = 'basic', variant] = startMatch;

        if (!target) continue; // Skip if no target found

        currentBlock = {
          tag: trimmed.substring('@extract: '.length),
          target,
          context,
          level,
          variant: variant || undefined,
          startLine: i + 1,
        };

        blockContent = [];
        blockMetadata = [];
        inCodeBlock = false;
        continue;
      }

      // Check for extract end
      if (trimmed === '@extract-end' && currentBlock) {
        currentBlock.endLine = i + 1;

        if (blockContent.length > 0) {
          blocks.push(this.finalizeBlock(
            currentBlock,
            blockContent,
            blockMetadata,
            configs,
            format
          ));
        }

        currentBlock = null;
        blockContent = [];
        blockMetadata = [];
        continue;
      }

      // Collect content between tags
      if (currentBlock) {
        // Track code blocks
        if (trimmed.startsWith('```')) {
          inCodeBlock = !inCodeBlock;
          if (inCodeBlock && trimmed === '```typescript') {
            continue; // Skip opening fence
          }
          if (!inCodeBlock && trimmed === '```') {
            continue; // Skip closing fence
          }
        }

        // Separate metadata from code
        if (!inCodeBlock && line && line.trim().startsWith('@') && line.includes(':')) {
          blockMetadata.push(line);
        } else {
          blockContent.push(line);
        }
      }
    }

    // Handle unclosed block
    if (currentBlock && blockContent.length > 0) {
      currentBlock.endLine = lines.length;
      blocks.push(this.finalizeBlock(
        currentBlock,
        blockContent,
        blockMetadata,
        configs,
        format
      ));
    }

    return blocks;
  }

  /**
   * Extract specific block by tag components
   */
  async extractSpecificBlock(
    content: string,
    filePath: string,
    target: string,
    context = 'domain',
    level = 'basic',
    format: 'jsdoc' | 'cli' = 'cli'
  ): Promise<ExtractBlock | null> {
    const allBlocks = await this.extractAllBlocks(content, filePath, format);

    return allBlocks.find(
      block =>
        block.target === target &&
        block.context === context &&
        block.level === level
    ) || null;
  }

  /**
   * Load configuration hierarchy for a file
   */
  private async loadConfigHierarchy(filePath: string): Promise<ConfigLevel[]> {
    const cacheKey = path.dirname(filePath);

    if (this.configCache.has(cacheKey)) {
      return [...this.configCache.get(cacheKey)!];
    }

    const configs: ConfigLevel[] = [];

    // 1. Load library global settings
    try {
      const globalPath = path.join(process.cwd(), 'docs', EnhancedTagExtractor.GLOBAL_SETTINGS_FILE);
      const globalContent = await fs.readFile(globalPath, 'utf-8');
      const globalSettings = this.metadataParser.parseGlobalSettings(globalContent);

      configs.push(...globalSettings.map(settings => ({
        source: 'library' as const,
        strategy: settings.strategy,
        scope: settings.scope || undefined,
        metadata: settings.metadata,
      })));
    } catch (error) {
      // Global settings are optional
    }

    // 2. Load package settings
    let currentDir = path.dirname(filePath);
    while (currentDir !== path.dirname(currentDir)) { // Not root
      try {
        const packageSettingsPath = path.join(currentDir, EnhancedTagExtractor.PACKAGE_SETTINGS_FILE);
        const packageContent = await fs.readFile(packageSettingsPath, 'utf-8');
        const packageSettings = this.metadataParser.parseGlobalSettings(packageContent);

        configs.push(...packageSettings.map(settings => ({
          source: 'package' as const,
          strategy: settings.strategy,
          scope: settings.scope || undefined,
          metadata: settings.metadata,
        })));

        break; // Found package settings
      } catch (error) {
        // Continue searching up the directory tree
        currentDir = path.dirname(currentDir);
      }
    }

    this.configCache.set(cacheKey, configs);
    return [...configs];
  }

  /**
   * Finalize block with resolved metadata
   */
  private finalizeBlock(
    partial: Partial<ExtractBlock>,
    contentLines: string[],
    metadataLines: string[],
    configs: ConfigLevel[],
    format: 'jsdoc' | 'cli'
  ): ExtractBlock {
    // Parse local metadata
    const localMetadata = this.metadataParser.parseMetadata(metadataLines.join('\n'));

    // Resolve metadata with hierarchy
    const resolvedMetadata = this.metadataParser.resolveMetadata(
      configs,
      localMetadata,
      format,
      partial.level // Use level as scope
    );

    // Clean and format code content
    const code = this.cleanCodeContent(contentLines);

    return {
      tag: partial.tag!,
      target: partial.target!,
      context: partial.context!,
      level: partial.level!,
      variant: partial.variant || undefined,
      metadata: resolvedMetadata,
      code,
      startLine: partial.startLine!,
      endLine: partial.endLine!,
    };
  }

  /**
   * Clean code content by removing common indentation
   */
  private cleanCodeContent(lines: string[]): string {
    // Filter out empty lines at start and end
    while (lines.length > 0 && lines[0]?.trim() === '') {
      lines.shift();
    }
    while (lines.length > 0 && lines[lines.length - 1]?.trim() === '') {
      lines.pop();
    }

    if (lines.length === 0) return '';

    // Find minimum indentation
    const nonEmptyLines = lines.filter(line => line.trim() !== '');
    if (nonEmptyLines.length === 0) return lines.join('\n');

    const minIndent = Math.min(
      ...nonEmptyLines.map(line => {
        const match = line.match(/^(\s*)/);
        return match?.[1]?.length ?? 0;
      }).filter(len => len !== undefined)
    );

    // Remove common indentation
    return lines
      .map(line => {
        if (line.trim() === '') return '';
        return line.substring(minIndent);
      })
      .join('\n');
  }

  /**
   * Clear configuration cache
   */
  clearCache(): void {
    this.configCache.clear();
  }
}
