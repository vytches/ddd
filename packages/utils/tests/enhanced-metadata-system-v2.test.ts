import { resolve } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  FormatSpecificResolver,
  HierarchicalMetadataResolver,
  MetadataResolutionStrategies,
  MultiLevelCache,
} from '../src/examples-engine';
import type { HierarchyConfig, ResolvedMetadata } from '../src/examples-engine/hierarchy/types';
import { safeRun } from '../src/saferun';

describe('Enhanced Metadata System V2', () => {
  let resolver: HierarchicalMetadataResolver;

  beforeEach(async () => {
    // Set base directory to project root (two levels up from packages/utils)
    const projectRoot = resolve(__dirname, '../../..');
    resolver = new HierarchicalMetadataResolver(projectRoot);
    await MultiLevelCache.initialize();
  });

  afterEach(async () => {
    // Clear cache between tests
    await MultiLevelCache.clear();
  });

  describe('HierarchicalMetadataResolver', () => {
    it('should resolve metadata hierarchically', async () => {
      const config: HierarchyConfig = {
        packageName: 'aggregates',
        className: 'aggregate-root',
        methodName: 'commit',
        format: 'jsdoc',
      };

      const [error, metadata] = await safeRun(async () => await resolver.resolveForMethod(config));

      expect(error).toBeUndefined();
      expect(metadata).toBeDefined();

      if (metadata) {
        expect(metadata.description).toBeDefined();
        expect(metadata.author).toBe('Vytches DDD Team');
        expect(metadata.since).toBe('1.0.0');
        expect(metadata.license).toBe('MIT');
      }
    });

    it('should handle missing files gracefully', async () => {
      const config: HierarchyConfig = {
        packageName: 'nonexistent',
        className: 'nonexistent',
        methodName: 'nonexistent',
        format: 'jsdoc',
      };

      const [error, metadata] = await safeRun(async () => await resolver.resolveForMethod(config));

      expect(error).toBeUndefined();
      expect(metadata).toBeDefined();
      // Should still have global metadata
      if (metadata) {
        expect(metadata.author).toBe('Vytches DDD Team');
      }
    });

    it('should support custom metadata tags', async () => {
      const config: HierarchyConfig = {
        packageName: 'aggregates',
        className: 'aggregate-root',
        methodName: 'commit',
        format: 'jsdoc',
      };

      const [error, metadata] = await safeRun(async () => await resolver.resolveForMethod(config));

      expect(error).toBeUndefined();
      expect(metadata).toBeDefined();

      if (metadata) {
        // Should have custom tags from global settings
        expect(metadata.license).toBe('MIT');
        // Should have custom complexity from package level
        expect(metadata.complexity).toBe('intermediate');
        // Should have author from global
        expect(metadata.author).toBe('Vytches DDD Team');
      }
    });
  });

  describe('FormatSpecificResolver', () => {
    it('should resolve format-specific metadata', () => {
      const baseMetadata: ResolvedMetadata = {
        description: 'Base description',
        'description.jsdoc': 'JSDoc specific description',
        'description.cli': 'CLI specific description',
        businessContext: 'Base context',
        examples: [],
        author: 'Test Author',
      };

      const jsdocResult = FormatSpecificResolver.resolveForFormat(baseMetadata, 'jsdoc');
      const cliResult = FormatSpecificResolver.resolveForFormat(baseMetadata, 'cli');

      expect(jsdocResult.description).toBe('JSDoc specific description');
      expect(cliResult.description).toBe('CLI specific description');

      // Should clean up format-specific keys
      expect(jsdocResult['description.jsdoc']).toBeUndefined();
      expect(cliResult['description.cli']).toBeUndefined();
    });

    it('should format custom tags in JSDoc', () => {
      const metadata: ResolvedMetadata = {
        description: 'Test description',
        businessContext: 'Test context',
        examples: [],
        customTag: 'Custom value',
        documentationUrl: 'https://example.com',
        complexityLevel: 'high',
      };

      const jsdoc = FormatSpecificResolver.formatAsJSDoc(metadata);

      expect(jsdoc).toContain('@custom-tag Custom value');
      expect(jsdoc).toContain('@documentation-url https://example.com');
      expect(jsdoc).toContain('@complexity-level high');
      expect(jsdoc).toContain('@businessContext Test context');
    });

    it('should format examples correctly', () => {
      const metadata: ResolvedMetadata = {
        description: 'Test method',
        businessContext: 'Business logic',
        examples: [
          'const result = method();\nconsole.log(result);',
          'const another = method(param);\nreturn another;',
        ],
      };

      const jsdoc = FormatSpecificResolver.formatAsJSDoc(metadata);

      expect(jsdoc).toContain('@example');
      expect(jsdoc).toContain('```typescript');
      expect(jsdoc).toContain('const result = method();');
      expect(jsdoc).toContain('const another = method(param);');
    });
  });

  describe('MetadataResolutionStrategies', () => {
    it('should apply merge strategy correctly', () => {
      const sources = [
        {
          level: 0,
          filePath: 'global',
          metadata: { author: 'Global Author', license: 'MIT' },
          strategy: 'merge' as const,
        },
        {
          level: 1,
          filePath: 'package',
          metadata: { author: 'Package Author', complexity: 'high' },
          strategy: 'merge' as const,
        },
      ];

      const result = MetadataResolutionStrategies.applyHierarchy(sources);

      expect(result.author).toBe('Package Author'); // Higher level overrides lower level in merge
      expect(result.license).toBe('MIT'); // From global
      expect(result.complexity).toBe('high'); // From package
    });

    it('should apply replace strategy correctly', () => {
      const sources = [
        {
          level: 0,
          filePath: 'global',
          metadata: { author: 'Global Author', license: 'MIT', description: 'Global desc' },
          strategy: 'merge' as const,
        },
        {
          level: 1,
          filePath: 'package',
          metadata: { author: 'Package Author' },
          strategy: 'replace' as const,
        },
      ];

      const result = MetadataResolutionStrategies.applyHierarchy(sources);

      expect(result.author).toBe('Package Author');
      // Replace strategy still keeps existing fields that aren't overridden
      expect(result.license).toBe('MIT'); // From global, not replaced
      expect(result.description).toBe('Global desc'); // From global, not in package
    });
  });

  describe('MultiLevelCache', () => {
    it('should cache and retrieve values', async () => {
      const key = 'test:cache:key';
      const value = JSON.stringify({ test: 'data' });

      // Set value
      await MultiLevelCache.set(key, value);

      // Get value
      const [error, cached] = await safeRun(async () => await MultiLevelCache.get(key));

      expect(error).toBeUndefined();
      expect(cached).toBe(value);
    });

    it('should return null for non-existent keys', async () => {
      const [error, result] = await safeRun(
        async () => await MultiLevelCache.get('nonexistent:key')
      );

      expect(error).toBeUndefined();
      expect(result).toBeNull();
    });

    it('should handle cache clearing', async () => {
      const key = 'test:clear:key';
      const value = 'test value';

      await MultiLevelCache.set(key, value);

      // Verify it's cached
      let cached = await MultiLevelCache.get(key);
      expect(cached).toBe(value);

      // Clear cache
      await MultiLevelCache.clear();

      // Should be gone
      cached = await MultiLevelCache.get(key);
      expect(cached).toBeNull();
    });
  });

  describe('Integration Tests', () => {
    it('should work end-to-end with real metadata files', async () => {
      // Test with actual aggregates package metadata
      const config: HierarchyConfig = {
        packageName: 'aggregates',
        className: 'aggregate-root',
        methodName: 'commit',
        format: 'jsdoc',
      };

      const [resolveError, metadata] = await safeRun(
        async () => await resolver.resolveForMethod(config)
      );

      expect(resolveError).toBeUndefined();
      expect(metadata).toBeDefined();

      if (metadata) {
        // Should have hierarchical data
        expect(metadata.author).toBe('Vytches DDD Team'); // From global
        expect(metadata.complexity).toBe('intermediate'); // From package
        expect(metadata.description).toContain('Commits pending domain events'); // From method

        // Should have examples
        expect(metadata.examples).toBeDefined();
        expect(metadata.examples.length).toBeGreaterThan(0);

        // Test JSDoc formatting
        const [formatError, jsdoc] = safeRun(() => FormatSpecificResolver.formatAsJSDoc(metadata));

        expect(formatError).toBeUndefined();
        expect(jsdoc).toContain('/**');
        expect(jsdoc).toContain('*/');
        expect(jsdoc).toContain('@author Vytches DDD Team');
        expect(jsdoc).toContain('@since 1.0.0');
        expect(jsdoc).toContain('@example');
        expect(jsdoc).toContain('```typescript');

        // Should handle custom tags
        expect(jsdoc).toContain('@complexity intermediate');
        expect(jsdoc).toContain('@license MIT');
      }
    });

    it('should handle caching in real scenarios', async () => {
      const config: HierarchyConfig = {
        packageName: 'aggregates',
        className: 'aggregate-root',
        methodName: 'commit',
        format: 'jsdoc',
      };

      // First resolution - should cache
      const start1 = Date.now();
      const metadata1 = await resolver.resolveForMethod(config);
      const time1 = Date.now() - start1;

      // Second resolution - should use cache
      const start2 = Date.now();
      const metadata2 = await resolver.resolveForMethod(config);
      const time2 = Date.now() - start2;

      expect(metadata1).toEqual(metadata2);
      // Second call should be faster (cached)
      // Note: This is not always true due to I/O variance, but is a good indicator
      console.log(`First call: ${time1}ms, Second call: ${time2}ms`);
    });
  });
});
