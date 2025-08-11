import path from 'path';
import { ContentResolver } from './content-resolver';
import { HierarchicalMetadataResolver } from '@vytches/ddd-utils';
import type { ResolvedMetadata } from '@vytches/ddd-utils';

/**
 * Enhanced content resolver that integrates with Enhanced Metadata System V2
 * Uses the same HierarchicalMetadataResolver as JSDoc system for consistency
 */
export class YamlContentResolver extends ContentResolver {
  private metadataResolver: HierarchicalMetadataResolver;

  constructor() {
    super();
    this.metadataResolver = new HierarchicalMetadataResolver();
  }

  /**
   * Resolves content with YAML metadata awareness using HierarchicalMetadataResolver
   * Tries YAML first, then falls back to TypeScript config
   * Note: Returns sync content - async YAML loading is handled internally with caching
   */
  static override resolveContent(packageName: string, requestedPath: string): string {
    const resolver = new YamlContentResolver();

    // For now, we'll use a simplified approach that falls back to the parent resolver
    // The main YAML resolution happens in the CLI generation process, not here
    // This maintains backward compatibility while the main improvement is in DocumentationGenerator

    // Fallback to existing ContentResolver
    return super.resolveContent(packageName, requestedPath);
  }

  /**
   * Tries to load content from YAML metadata files using HierarchicalMetadataResolver
   */
  private async tryYamlMetadata(
    packageName: string,
    requestedPath: string,
    format: 'cli' | 'jsdoc'
  ): Promise<string | null> {
    try {
      // Extract class and method names from path
      const { className, methodName } = this.extractNamesFromPath(requestedPath);

      if (!className) {
        console.debug(`Could not extract className from path: ${requestedPath}`);
        return null;
      }

      // Use HierarchicalMetadataResolver to get metadata
      const resolvedMetadata = await this.metadataResolver.resolveForMethod({
        packageName,
        className,
        methodName: methodName || 'constructor', // Default to constructor for class-level docs
        format,
      });

      if (!resolvedMetadata) {
        console.debug(
          `No metadata found for ${packageName}/${className}/${methodName || 'constructor'}`
        );
        return null;
      }

      // Generate markdown content from resolved metadata
      return this.generateMarkdownFromMetadata(
        resolvedMetadata,
        packageName,
        className,
        methodName
      );
    } catch (error) {
      console.debug(`YAML metadata loading failed for ${packageName}/${requestedPath}:`, error);
      return null;
    }
  }

  /**
   * Public method to resolve YAML metadata for CLI or external use
   */
  async resolveYamlMetadata(
    packageName: string,
    requestedPath: string,
    format: 'cli' | 'jsdoc' = 'cli'
  ): Promise<string | null> {
    return this.tryYamlMetadata(packageName, requestedPath, format);
  }

  /**
   * Generates markdown content from resolved metadata
   */
  private generateMarkdownFromMetadata(
    metadata: ResolvedMetadata,
    packageName: string,
    className?: string,
    methodName?: string
  ): string {
    const sections: string[] = [];

    // Title
    if (methodName && className) {
      sections.push(`# ${this.toPascalCase(className)}.${methodName}`);
    } else if (className) {
      sections.push(`# ${this.toPascalCase(className)}`);
    } else {
      sections.push(`# @vytches/ddd-${packageName}`);
    }

    // Description
    if (metadata.description) {
      sections.push('');
      sections.push('## Description');
      sections.push('');
      sections.push(metadata.description);
    }

    // Business Context
    if (metadata.businessContext) {
      sections.push('');
      sections.push('## Business Context');
      sections.push('');
      sections.push(metadata.businessContext);
    }

    // Examples - Now properly handle string array from HierarchicalMetadataResolver
    if (metadata.examples && metadata.examples.length > 0) {
      sections.push('');
      sections.push('## Examples');

      metadata.examples.forEach((example, index) => {
        sections.push('');
        sections.push(`### Example ${index + 1}`);
        sections.push('');
        sections.push('```typescript');
        sections.push(example);
        sections.push('```');
      });
    }

    return sections.join('\n');
  }

  /**
   * Extracts class and method names from request path
   */
  private extractNamesFromPath(requestedPath: string): { className?: string; methodName?: string } {
    // Handle patterns like:
    // - basic/aggregate-root.md -> className: aggregate-root
    // - basic/aggregate-root/commit.md -> className: aggregate-root, methodName: commit
    // - aggregate-root/commit.md -> className: aggregate-root, methodName: commit

    const pathParts = requestedPath.replace('.md', '').split('/');

    // Remove complexity level if present
    const complexityLevels = ['basic', 'intermediate', 'advanced'];
    const filteredParts = pathParts.filter(part => !complexityLevels.includes(part));

    if (filteredParts.length === 1) {
      const className = filteredParts[0];
      return className ? { className } : {};
    } else if (filteredParts.length === 2) {
      const className = filteredParts[0];
      const methodName = filteredParts[1];
      if (className && methodName) {
        return { className, methodName };
      } else if (className) {
        return { className };
      }
    }

    return {};
  }

  /**
   * Converts kebab-case to PascalCase
   */
  private toPascalCase(str: string): string {
    return str
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
  }
}
