import { describe, expect, it } from 'vitest';
import { EnhancedJSDocAdapter } from '../src/examples-engine/adapters/enhanced-jsdoc-adapter';
import { EnhancedMetadataParser } from '../src/examples-engine/parser/enhanced-metadata-parser';

describe('Enhanced Metadata System', () => {
  describe('EnhancedMetadataParser', () => {
    const parser = new EnhancedMetadataParser();

    it('should parse simple metadata', () => {
      const content = `
@description: Basic factory method
@business-context: API endpoint usage
@author: DDD Team
      `;

      const metadata = parser.parseMetadata(content);

      expect(metadata).toEqual({
        description: { default: 'Basic factory method' },
        'business-context': { default: 'API endpoint usage' },
        author: { default: 'DDD Team' },
      });
    });

    it('should parse dot notation overrides', () => {
      const content = `
@description: Simple description
@description.cli: ## Extended Description\\n\\nWith markdown formatting
@business-context: Basic context
@business-context.jsdoc: Concise JSDoc context
      `;

      const metadata = parser.parseMetadata(content);

      expect(metadata.description).toEqual({
        default: 'Simple description',
        cli: '## Extended Description\\n\\nWith markdown formatting',
      });

      expect(metadata['business-context']).toEqual({
        default: 'Basic context',
        jsdoc: 'Concise JSDoc context',
      });
    });

    it('should parse global settings with strategy', () => {
      const content = `
@global-settings
@strategy: merge
@description: Global description
@author: Team
@global-settings-end

@global-settings:advanced
@strategy: replace
@description: Advanced only
@warning: Complex patterns
@global-settings-end
      `;

      const settings = parser.parseGlobalSettings(content);

      expect(settings).toHaveLength(2);
      expect(settings[0]).toEqual({
        strategy: 'merge',
        metadata: {
          description: { default: 'Global description' },
          author: { default: 'Team' },
        },
        scope: undefined,
      });

      expect(settings[1]).toEqual({
        strategy: 'replace',
        metadata: {
          description: { default: 'Advanced only' },
          warning: { default: 'Complex patterns' },
        },
        scope: 'advanced',
      });
    });

    it('should resolve metadata with hierarchy', () => {
      const configs = [
        {
          source: 'library' as const,
          strategy: 'merge' as const,
          metadata: {
            description: { default: 'Library default' },
            author: { default: 'Library Team' },
          },
        },
        {
          source: 'package' as const,
          strategy: 'merge' as const,
          metadata: {
            description: { default: 'Package override' },
            domain: { default: 'aggregates' },
          },
        },
      ];

      const localMetadata = {
        description: { cli: 'CLI specific description' },
        warning: { default: 'Local warning' },
      };

      const resolvedCLI = parser.resolveMetadata(configs, localMetadata, 'cli');
      expect(resolvedCLI).toEqual({
        description: '## Description\n\nCLI specific description', // CLI override
        author: '**Author**: Library Team', // Inherited with CLI format
        domain: 'aggregates', // From package
        warning: '> **Warning**: Local warning', // Local with CLI format
      });

      const resolvedJSDoc = parser.resolveMetadata(configs, localMetadata, 'jsdoc');
      expect(resolvedJSDoc).toEqual({
        description: 'Package override', // No JSDoc override, uses default
        author: '@author Library Team', // Inherited with JSDoc format
        domain: 'aggregates', // From package
        warning: '@warning Local warning', // Local with JSDoc format
      });
    });
  });

  describe('Enhanced JSDoc Adapter', () => {
    const adapter = new EnhancedJSDocAdapter();

    it('should format block for JSDoc', () => {
      const block = {
        tag: 'create:domain:basic',
        target: 'create',
        context: 'domain',
        level: 'basic',
        metadata: {
          description: 'Factory method for creating aggregates',
          'business-context': 'Used in API endpoints',
          author: 'DDD Team',
        },
        code: 'const order = OrderAggregate.create(data);',
        startLine: 10,
        endLine: 15,
      };

      const formatted = adapter.formatBlock(block);

      expect(formatted).toContain('Factory method for creating aggregates');
      expect(formatted).toContain('@business Used in API endpoints');
      expect(formatted).toContain('@author DDD Team');
      expect(formatted).toContain('@example');
      expect(formatted).toContain('const order = OrderAggregate.create(data);');
    });

    it('should generate complete JSDoc comment', () => {
      const blocks = [
        {
          tag: 'create:domain:basic',
          target: 'create',
          context: 'domain',
          level: 'basic',
          metadata: {
            description: 'Creates new aggregate',
            'business-context': 'Standard creation pattern',
          },
          code: 'const agg = Aggregate.create(data);',
          startLine: 1,
          endLine: 5,
        },
      ];

      const comment = adapter.generateJSDocComment(blocks, '  ');

      expect(comment).toBe(`  /**
   * Creates new aggregate
   * @business Standard creation pattern
   * @example
   * const agg = Aggregate.create(data);
   */`);
    });
  });
});
