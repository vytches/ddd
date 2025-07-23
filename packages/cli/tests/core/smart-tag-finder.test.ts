import { describe, it, expect, beforeEach, vi } from 'vitest';
import { safeRun } from '@vytches-ddd/utils';
import { SmartTagFinder } from '../../src/core/smart-tag-finder';
import type { ExampleDefinition } from '../../src/types/example-types';
import { PackageConfigLoader } from '../../src/core/package-config-loader';
import { SeededRandom } from '../../src/utils/seeded-random';

// Mock dependencies
vi.mock('../../src/core/package-config-loader');
vi.mock('../../src/utils/seeded-random');

const mockPackageConfigLoader = PackageConfigLoader as any;
const mockSeededRandom = SeededRandom as any;

describe('SmartTagFinder', () => {
  let finder: SmartTagFinder;
  let mockExamples: ExampleDefinition[];
  let mockPackageConfig: any;

  beforeEach(() => {
    vi.clearAllMocks();
    finder = new SmartTagFinder();

    // Mock example definitions
    mockExamples = [
      {
        id: 'core-basic-example',
        name: 'Core Basic Example',
        description: 'Basic core functionality',
        path: 'basic/core.md',
        complexity: 'basic',
        file: 'basic/core.md',
        priority: 'medium',
        package: 'core',
        tags: ['aggregate', 'entity'],
        dependencies: [],
        diSupport: false,
        frameworkIntegrations: ['nestjs'],
      },
      {
        id: 'events-intermediate-example',
        name: 'Events Intermediate Example',
        description: 'Intermediate events functionality',
        path: 'intermediate/events.md',
        complexity: 'intermediate',
        file: 'intermediate/events.md',
        priority: 'high',
        package: 'events',
        tags: ['domain-events', 'aggregate'],
        dependencies: ['core'],
        diSupport: true,
        frameworkIntegrations: [],
      },
      {
        id: 'cqrs-advanced-example',
        name: 'CQRS Advanced Example',
        description: 'Advanced CQRS patterns',
        path: 'advanced/cqrs.md',
        complexity: 'advanced',
        file: 'advanced/cqrs.md',
        priority: 'low',
        package: 'cqrs',
        tags: ['commands', 'queries'],
        dependencies: ['core', 'events'],
        diSupport: true,
        frameworkIntegrations: ['express'],
      },
    ];

    // Mock package config
    mockPackageConfig = {
      packageName: 'core',
      displayName: 'Core Package',
      dependencies: ['contracts'],
      frameworks: ['nestjs', 'express'],
      tags: {
        core: ['aggregate', 'entity'],
        integrations: ['integration:with:events'],
      },
      complexityLevels: {
        basic: {
          level: 'basic',
          description: 'Basic functionality',
          diSupport: false,
        },
        intermediate: {
          level: 'intermediate',
          description: 'Intermediate functionality',
          diSupport: true,
        },
      },
    };

    // Setup mocks
    mockPackageConfigLoader.prototype.getAvailablePackages = vi
      .fn()
      .mockResolvedValue(['core', 'events', 'cqrs']);
    mockPackageConfigLoader.prototype.loadPackageConfig = vi
      .fn()
      .mockResolvedValue(mockPackageConfig);

    // Mock SeededRandom
    mockSeededRandom.mockImplementation(() => ({
      next: vi.fn().mockReturnValue(0.5),
    }));

    // Mock console.warn to avoid noise in tests
    vi.spyOn(console, 'warn').mockImplementation(() => {
      return;
    });
  });

  describe('findExamplesByTag', () => {
    it('should find examples by exact tag match', async () => {
      // Mock loadAllExamples to return our test data
      vi.spyOn(finder as any, 'loadAllExamples').mockResolvedValue(mockExamples);

      const result = await safeRun(async () => {
        return await finder.findExamplesByTag('aggregate');
      });
      const error = result[0] as Error | undefined;
      const examples = result[1] as ExampleDefinition[] | undefined;

      expect(error).toBeUndefined();
      expect(examples).toBeDefined();
      expect(examples!.length).toBe(2); // core and events examples have 'aggregate' tag
      expect(examples!.some(ex => ex.id === 'core-basic-example')).toBe(true);
      expect(examples!.some(ex => ex.id === 'events-intermediate-example')).toBe(true);
    });

    it('should find examples by wildcard pattern', async () => {
      vi.spyOn(finder as any, 'loadAllExamples').mockResolvedValue(mockExamples);

      const result = await safeRun(async () => {
        return await finder.findExamplesByTag('domain-*');
      });
      const error = result[0] as Error | undefined;
      const examples = result[1] as ExampleDefinition[] | undefined;

      expect(error).toBeUndefined();
      expect(examples).toBeDefined();
      expect(examples!.length).toBe(1); // Only events example has 'domain-events' tag
      expect(examples![0]!.id).toBe('events-intermediate-example');
    });

    it('should filter by complexity when specified', async () => {
      vi.spyOn(finder as any, 'loadAllExamples').mockResolvedValue(mockExamples);

      const result = await safeRun(async () => {
        return await finder.findExamplesByTag('aggregate', 'basic');
      });
      const error = result[0] as Error | undefined;
      const examples = result[1] as ExampleDefinition[] | undefined;

      expect(error).toBeUndefined();
      expect(examples).toBeDefined();
      expect(examples!.length).toBe(1); // Only core example is basic complexity
      expect(examples![0]!.id).toBe('core-basic-example');
    });

    it('should filter by framework when specified', async () => {
      vi.spyOn(finder as any, 'loadAllExamples').mockResolvedValue(mockExamples);

      const result = await safeRun(async () => {
        return await finder.findExamplesByTag('aggregate', undefined, { framework: 'nestjs' });
      });
      const error = result[0] as Error | undefined;
      const examples = result[1] as ExampleDefinition[] | undefined;

      expect(error).toBeUndefined();
      expect(examples).toBeDefined();
      expect(examples!.length).toBe(1); // Only core example has nestjs integration
      expect(examples![0]!.id).toBe('core-basic-example');
    });

    it('should return empty array when no matches found', async () => {
      vi.spyOn(finder as any, 'loadAllExamples').mockResolvedValue(mockExamples);

      const result = await safeRun(async () => {
        return await finder.findExamplesByTag('nonexistent-tag');
      });
      const error = result[0] as Error | undefined;
      const examples = result[1] as ExampleDefinition[] | undefined;

      expect(error).toBeUndefined();
      expect(examples!.length).toBe(0);
    });
  });

  describe('selectExamples', () => {
    it('should return all examples when count is less than max', async () => {
      const options = {
        maxExamples: 10,
        randomize: false,
        priorityTags: [],
      };

      const result = await safeRun(async () => {
        return await finder.selectExamples(mockExamples.slice(0, 2), options);
      });
      const error = result[0] as Error | undefined;
      const selected = result[1] as ExampleDefinition[] | undefined;

      expect(error).toBeUndefined();
      expect(selected?.length).toBe(2);
    });

    it('should select examples with priority tags first', async () => {
      const options = {
        maxExamples: 2,
        randomize: false,
        priorityTags: ['domain-events'],
      };

      const result = await safeRun(async () => {
        return await finder.selectExamples(mockExamples, options);
      });
      const error = result[0] as Error | undefined;
      const selected = result[1] as ExampleDefinition[] | undefined;

      expect(error).toBeUndefined();
      expect(selected?.length).toBe(2);
      expect(selected?.some(ex => ex.tags.includes('domain-events'))).toBe(true);
    });

    it('should randomize selection when randomize is true', async () => {
      const options = {
        maxExamples: 2,
        randomize: true,
        seed: 'test-seed',
      };

      const result = await safeRun(async () => {
        return await finder.selectExamples(mockExamples, options);
      });
      const error = result[0] as Error | undefined;
      const selected = result[1] as ExampleDefinition[] | undefined;

      expect(error).toBeUndefined();
      expect(selected?.length).toBe(2);
      expect(mockSeededRandom).toHaveBeenCalledWith('test-seed');
    });

    it('should use default seed when randomize is true but no seed provided', async () => {
      const options = {
        maxExamples: 2,
        randomize: true,
        priorityTags: [],
      };

      const result = await safeRun(async () => {
        return await finder.selectExamples(mockExamples, options);
      });
      const error = result[0] as Error | undefined;

      expect(error).toBeUndefined();
      expect(mockSeededRandom).toHaveBeenCalledWith('default');
    });
  });

  describe('suggestSimilarTags', () => {
    beforeEach(() => {
      // Override resolveTagsForExample to return simple tags for testing
      vi.spyOn(finder as any, 'resolveTagsForExample').mockImplementation((example: any) => {
        return example.tags;
      });
    });

    it('should suggest similar tags based on partial match', async () => {
      vi.spyOn(finder as any, 'loadAllExamples').mockResolvedValue(mockExamples);

      const result = await safeRun(async () => {
        return await finder.suggestSimilarTags('domain');
      });
      const error = result[0] as Error | undefined;
      const suggestions = result[1] as string[] | undefined;

      expect(error).toBeUndefined();
      expect(suggestions).toBeDefined();
      expect(suggestions?.includes('domain-events')).toBe(true);
    });

    it('should suggest tags that contain the pattern', async () => {
      vi.spyOn(finder as any, 'loadAllExamples').mockResolvedValue(mockExamples);

      const result = await safeRun(async () => {
        return await finder.suggestSimilarTags('command');
      });
      const error = result[0] as Error | undefined;
      const suggestions = result[1] as string[] | undefined;

      expect(error).toBeUndefined();
      expect(suggestions?.includes('commands')).toBe(true);
    });

    it('should limit suggestions to 5 items', async () => {
      const manyExamples = Array.from({ length: 10 }, (_, i) => ({
        ...mockExamples[0],
        id: `example-${i}`,
        tags: [`tag-${i}`, `similar-tag-${i}`],
      }));

      vi.spyOn(finder as any, 'loadAllExamples').mockResolvedValue(manyExamples);

      const result = await safeRun(async () => {
        return await finder.suggestSimilarTags('tag');
      });
      const error = result[0] as Error | undefined;
      const suggestions = result[1] as string[] | undefined;

      expect(error).toBeUndefined();
      expect(suggestions?.length).toBeLessThanOrEqual(5);
    });
  });

  describe('clearCache', () => {
    it('should clear the example cache', () => {
      // Set some cache data
      (finder as any).exampleCache.set('test', []);
      expect((finder as any).exampleCache.size).toBe(1);

      finder.clearCache();
      expect((finder as any).exampleCache.size).toBe(0);
    });
  });

  describe('private methods', () => {
    describe('resolveTagsForExample', () => {
      it('should resolve tags with complexity suffix', () => {
        const example = mockExamples[0];
        const resolvedTags = (finder as any).resolveTagsForExample(example);

        expect(resolvedTags).toEqual(['aggregate:basic', 'entity:basic']);
      });
    });

    describe('separateByPriority', () => {
      it('should separate examples by priority tags', () => {
        const result = (finder as any).separateByPriority(mockExamples, ['aggregate']);

        expect(result.priority.length).toBe(2); // core and events examples
        expect(result.regular.length).toBe(1); // cqrs example
      });

      it('should return all as regular when no priority tags specified', () => {
        const result = (finder as any).separateByPriority(mockExamples, []);

        expect(result.priority.length).toBe(0);
        expect(result.regular.length).toBe(3);
      });
    });

    describe('randomSelect', () => {
      it('should return all examples when count is greater than available', () => {
        const result = (finder as any).randomSelect(mockExamples.slice(0, 2), 5, 'test');

        expect(result.length).toBe(2);
      });

      it('should select specified count when enough examples available', () => {
        const result = (finder as any).randomSelect(mockExamples, 2, 'test');

        expect(result.length).toBe(2);
        expect(mockSeededRandom).toHaveBeenCalledWith('test');
      });
    });

    describe('generateExampleDefinitions', () => {
      it('should generate examples from package config', async () => {
        const result = await safeRun(async () => {
          return await (finder as any).generateExampleDefinitions(mockPackageConfig);
        });
        const error = result[0] as Error | undefined;
        const examples = result[1] as ExampleDefinition[] | undefined;

        expect(error).toBeUndefined();
        expect(examples).toBeDefined();
        expect(examples?.length).toBeGreaterThan(0);

        // Check that core examples are generated
        const coreExample = examples?.find(ex => ex.tags.includes('aggregate'));
        expect(coreExample).toBeDefined();
        expect(coreExample?.package).toBe('core');
      });

      it('should generate integration examples when present', async () => {
        const configWithIntegrations = {
          ...mockPackageConfig,
          tags: {
            ...mockPackageConfig.tags,
            integrations: ['integration:with:events', 'integration:with:cqrs'],
          },
        };

        const result = await safeRun(async () => {
          return await (finder as any).generateExampleDefinitions(configWithIntegrations);
        });
        const error = result[0] as Error | undefined;
        const examples = result[1] as ExampleDefinition[] | undefined;

        expect(error).toBeUndefined();
        const integrationExamples = examples?.filter(ex =>
          ex.tags.some(tag => tag.startsWith('integration:'))
        );
        expect(integrationExamples?.length).toBeGreaterThan(0);
      });
    });
  });

  describe('loadAllExamples', () => {
    it('should load and cache examples from all packages', async () => {
      // Mock the configLoader instance directly
      const mockGetAvailablePackages = vi.fn().mockResolvedValue(['core', 'events', 'cqrs']);
      const mockLoadPackageConfig = vi.fn().mockResolvedValue(mockPackageConfig);

      (finder as any).configLoader = {
        getAvailablePackages: mockGetAvailablePackages,
        loadPackageConfig: mockLoadPackageConfig,
      };

      const result = await safeRun(async () => {
        return await (finder as any).loadAllExamples();
      });
      const error = result[0] as Error | undefined;
      const examples = result[1] as ExampleDefinition[] | undefined;

      expect(error).toBeUndefined();
      expect(examples).toBeDefined();
      expect(mockGetAvailablePackages).toHaveBeenCalled();
      expect(mockLoadPackageConfig).toHaveBeenCalledWith('core');
    });

    it('should return cached examples on subsequent calls', async () => {
      // First call
      await (finder as any).loadAllExamples();

      // Clear call count
      vi.clearAllMocks();

      // Second call
      const result = await safeRun(async () => {
        return await (finder as any).loadAllExamples();
      });
      const error = result[0] as Error | undefined;

      expect(error).toBeUndefined();
      expect(mockPackageConfigLoader.prototype.getAvailablePackages).not.toHaveBeenCalled();
    });

    it('should handle package loading errors gracefully', async () => {
      // Setup console.warn spy
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
        return;
      });

      // Mock the configLoader instance directly with error
      const mockGetAvailablePackages = vi.fn().mockResolvedValue(['core', 'events', 'cqrs']);
      const mockLoadPackageConfig = vi
        .fn()
        .mockResolvedValueOnce(mockPackageConfig)
        .mockRejectedValueOnce(new Error('Package load failed'))
        .mockResolvedValueOnce(mockPackageConfig);

      (finder as any).configLoader = {
        getAvailablePackages: mockGetAvailablePackages,
        loadPackageConfig: mockLoadPackageConfig,
      };

      const result = await safeRun(async () => {
        return await (finder as any).loadAllExamples();
      });
      const error = result[0] as Error | undefined;
      const examples = result[1] as ExampleDefinition[] | undefined;

      expect(error).toBeUndefined();
      expect(examples).toBeDefined();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '⚠️  Failed to load examples from package: events'
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete workflow with realistic data', async () => {
      vi.spyOn(finder as any, 'loadAllExamples').mockResolvedValue(mockExamples);

      // Find examples by tag pattern
      const findResult = await safeRun(async () => {
        return await finder.findExamplesByTag('*aggregate*', undefined, {
          framework: 'nestjs',
          maxExamples: 3,
          randomize: true,
          seed: 'integration-test',
        });
      });
      const findError = findResult[0] as Error | undefined;
      const foundExamples = findResult[1] as ExampleDefinition[] | undefined;

      expect(findError).toBeUndefined();
      expect(foundExamples).toBeDefined();

      // Select from found examples
      const selectResult = await safeRun(async () => {
        return await finder.selectExamples(foundExamples!, {
          maxExamples: 2,
          randomize: true,
          seed: 'selection-test',
          priorityTags: ['domain-events'],
        });
      });
      const selectError = selectResult[0] as Error | undefined;
      const selectedExamples = selectResult[1] as ExampleDefinition[] | undefined;

      expect(selectError).toBeUndefined();
      expect(selectedExamples).toBeDefined();
      expect(selectedExamples?.length).toBeLessThanOrEqual(2);
    });
  });
});
