/**
 * Tag extraction system for @extract comments
 * Parses HTML-like comment tags from markdown files
 */

import type { ExtractedExample, ExtractionTag, LayerType, ComplexityLevel } from '../types';

export class TagExtractor {
  private static readonly EXTRACT_START_PATTERN = /@extract:\s*([^:]+):([^:]+):([^:\s]+)/;
  private static readonly EXTRACT_END_PATTERN = /@extract-end/;

  /**
   * Extract all tagged sections from content
   */
  extractAllTags(content: string, packageName: string): ExtractedExample[] {
    const lines = content.split('\n');
    const examples: ExtractedExample[] = [];
    
    let currentTag: ExtractionTag | null = null;
    let extractedLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const trimmed = line.trim();

      // Check for start tag
      const startMatch = trimmed.match(TagExtractor.EXTRACT_START_PATTERN);
      if (startMatch && startMatch[1] && startMatch[2] && startMatch[3]) {
        // Save previous extraction if exists
        if (currentTag && extractedLines.length > 0) {
          examples.push(this.createExtractedExample(currentTag, extractedLines, packageName));
        }

        // Start new extraction
        currentTag = {
          methodName: startMatch[1].trim(),
          layer: startMatch[2].trim() as LayerType,
          complexity: startMatch[3].trim() as ComplexityLevel,
          startLine: i + 1,
          endLine: -1,
        };
        extractedLines = [];
        continue;
      }

      // Check for end tag
      if (trimmed.match(TagExtractor.EXTRACT_END_PATTERN) && currentTag) {
        currentTag.endLine = i + 1;
        
        if (extractedLines.length > 0) {
          examples.push(this.createExtractedExample(currentTag, extractedLines, packageName));
        }
        
        currentTag = null;
        extractedLines = [];
        continue;
      }

      // Collect content lines between tags
      if (currentTag) {
        // Skip markdown code fence markers
        if (trimmed === '```typescript' || trimmed === '```') {
          continue;
        }
        
        extractedLines.push(line);
      }
    }

    // Handle unclosed tag
    if (currentTag && extractedLines.length > 0) {
      currentTag.endLine = lines.length;
      examples.push(this.createExtractedExample(currentTag, extractedLines, packageName));
    }

    return examples;
  }

  /**
   * Extract specific tagged section by method and layer
   */
  extractSpecificTag(
    content: string,
    methodName: string,
    layer: LayerType,
    complexity: ComplexityLevel,
    packageName: string
  ): ExtractedExample | null {
    const allExamples = this.extractAllTags(content, packageName);
    
    return allExamples.find(
      example =>
        example.methodName === methodName &&
        example.layer === layer &&
        example.complexity === complexity
    ) || null;
  }

  /**
   * Find all extraction tags without extracting content
   */
  findAllTags(content: string): ExtractionTag[] {
    const lines = content.split('\n');
    const tags: ExtractionTag[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const trimmed = line.trim();
      const startMatch = trimmed.match(TagExtractor.EXTRACT_START_PATTERN);
      
      if (startMatch && startMatch[1] && startMatch[2] && startMatch[3]) {
        tags.push({
          methodName: startMatch[1].trim(),
          layer: startMatch[2].trim() as LayerType,
          complexity: startMatch[3].trim() as ComplexityLevel,
          startLine: i + 1,
          endLine: -1, // Will be found later if needed
        });
      }
    }

    return tags;
  }

  /**
   * Validate tag format and structure
   */
  validateTagFormat(tag: string): boolean {
    const match = tag.match(TagExtractor.EXTRACT_START_PATTERN);
    if (!match || !match[1] || !match[2] || !match[3]) return false;

    const [, methodName, layer, complexity] = match;
    
    // Validate layer
    const validLayers: LayerType[] = ['domain', 'service', 'integration'];
    if (!validLayers.includes(layer as LayerType)) return false;

    // Validate complexity
    const validComplexities: ComplexityLevel[] = ['basic', 'intermediate', 'advanced'];
    if (!validComplexities.includes(complexity as ComplexityLevel)) return false;

    // Validate method name (basic pattern)
    if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(methodName)) return false;

    return true;
  }

  /**
   * Create ExtractedExample from tag and content
   */
  private createExtractedExample(
    tag: ExtractionTag,
    lines: string[],
    packageName: string
  ): ExtractedExample {
    // Clean up extracted content
    const cleanedLines = lines
      .filter(line => line.trim() !== '') // Remove empty lines
      .map(line => line.trimEnd()); // Remove trailing whitespace

    // Remove common leading whitespace
    const content = this.removeCommonIndentation(cleanedLines).join('\n');

    return {
      methodName: tag.methodName,
      layer: tag.layer,
      complexity: tag.complexity,
      content,
      lineCount: cleanedLines.length,
      packageName,
    };
  }

  /**
   * Remove common leading whitespace from all lines
   */
  private removeCommonIndentation(lines: string[]): string[] {
    if (lines.length === 0) return lines;

    // Find minimum indentation (excluding empty lines)
    const nonEmptyLines = lines.filter(line => line.trim() !== '');
    if (nonEmptyLines.length === 0) return lines;

    const minIndent = Math.min(
      ...nonEmptyLines.map(line => {
        const match = line.match(/^(\s*)/);
        return match?.[1]?.length ?? 0;
      })
    );

    // Remove common indentation
    return lines.map(line => {
      if (line.trim() === '') return line;
      return line.substring(minIndent);
    });
  }

  /**
   * Get tag statistics for a file
   */
  getTagStatistics(content: string): {
    totalTags: number;
    tagsByLayer: Record<LayerType, number>;
    tagsByComplexity: Record<ComplexityLevel, number>;
    methods: string[];
  } {
    const tags = this.findAllTags(content);
    
    const stats = {
      totalTags: tags.length,
      tagsByLayer: { domain: 0, service: 0, integration: 0 } as Record<LayerType, number>,
      tagsByComplexity: { basic: 0, intermediate: 0, advanced: 0 } as Record<ComplexityLevel, number>,
      methods: [...new Set(tags.map(tag => tag.methodName).filter(Boolean))],
    };

    tags.forEach(tag => {
      if (tag.layer) stats.tagsByLayer[tag.layer]++;
      if (tag.complexity) stats.tagsByComplexity[tag.complexity]++;
    });

    return stats;
  }
}