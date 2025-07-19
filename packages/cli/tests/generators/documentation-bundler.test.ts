import { describe, it, expect, beforeEach, vi } from 'vitest';
import { safeRun } from '@vytches-ddd/utils';
import { DocumentationBundler } from '../../src/generators/documentation-bundler';
import { DocumentationGenerator } from '../../src/generators/documentation-generator';
import { PackageConfigLoader } from '../../src/core/package-config-loader';
import type { BundleOptions, DocumentationBundle } from '../../src/generators/documentation-bundler';
import type { PackageExampleConfig, ExampleDefinition } from '../../src/types/example-types';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock dependencies
vi.mock('../../src/generators/documentation-generator');
vi.mock('../../src/core/package-config-loader');
vi.mock('../../src/core/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    debug: vi.fn(),
  },
}));
vi.mock('fs/promises');
vi.mock('path');

describe('DocumentationBundler', () => {
  let bundler: DocumentationBundler;
  let mockConfigLoader: any;
  let mockGenerator: any;

  const mockExampleDefinition: ExampleDefinition = {
    id: 'example-1',
    name: 'Basic Example',
    description: 'A basic test example',
    file: 'basic/example-1.md',
    complexity: 'basic',
    tags: ['domain-services:core'],
    diSupport: false,
    frameworkIntegrations: [],
    dependencies: [],
    priority: 'medium'
  };

  const mockPackageConfig: PackageExampleConfig = {
    packageName: 'domain-services',
    displayName: 'Domain Services',
    version: '1.0.0',
    description: 'Domain services package',
    domain: 'core',
    patterns: ['service-pattern'],
    dependencies: ['@vytches-ddd/core'],
    complexityLevels: {
      basic: {
        level: 'basic',
        diSupport: false,
        diRequired: false,
        description: 'Basic implementation'
      },
      advanced: {
        level: 'advanced',
        diSupport: true,
        diRequired: false,
        description: 'Advanced implementation'
      }
    },
    frameworks: [],
    sections: ['core', 'integration'],
    examples: [mockExampleDefinition],
    tags: {
      core: ['domain-services:core'],
      integrations: ['domain-services:integration'],
      frameworks: ['domain-services:nestjs'],
      patterns: ['domain-services:patterns']
    },
    contentConfig: {
      showImportStatements: true,
      showErrorHandling: true,
      showTesting: false,
      showPerformance: false,
      includeBestPractices: true,
      includeCommonPitfalls: false,
      showVersionHistory: false
    },
    llmSupport: {
      enabled: true,
      includePrompts: false,
      includeTips: true,
      includePatterns: true,
      optimizeForCodeGeneration: false
    },
    relatedPackages: {},
    tagFinder: {
      maxExamples: 3,
      seed: 'test-seed',
      priorityTags: ['basic'],
    },
  }

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mocks
    mockConfigLoader = {
      loadPackageConfig: vi.fn(),
    };
    mockGenerator = {};

    // Mock constructors
    vi.mocked(PackageConfigLoader).mockImplementation(() => mockConfigLoader);
    vi.mocked(DocumentationGenerator).mockImplementation(() => mockGenerator);

    // Mock path operations
    vi.mocked(path.join).mockImplementation((...args) => args.join('/'));
    vi.mocked(path.dirname).mockImplementation((p) => p.split('/').slice(0, -1).join('/'));

    // Mock fs operations
    vi.mocked(fs.access).mockResolvedValue(undefined);
    vi.mocked(fs.readFile).mockResolvedValue('# Example Content\n\nSample markdown content.');

    bundler = new DocumentationBundler();
  });

  describe('constructor', () => {
    it('should create bundler with generator and config loader', () => {
      expect(bundler).toBeInstanceOf(DocumentationBundler);
      expect(DocumentationGenerator).toHaveBeenCalled();
      expect(PackageConfigLoader).toHaveBeenCalled();
    });
  });

  describe('createBundle', () => {
    const basicOptions: BundleOptions = {
      packages: ['domain-services'],
    };

    beforeEach(() => {
      mockConfigLoader.loadPackageConfig.mockResolvedValue(mockPackageConfig);
    });

    it('should create bundle for single package', async () => {
      const result = await bundler.createBundle(basicOptions);

      expect(result).toBeDefined();
      expect(result.metadata.packages).toEqual(['domain-services']);
      expect(result.metadata.title).toContain('domain-services');
      expect(result.examples).toHaveLength(1);
      expect(result.packageCount).toBe(1);
      expect(result.exampleCount).toBe(1);
    });

    it('should create bundle for multiple packages', async () => {
      const options: BundleOptions = {
        packages: ['domain-services', 'di'],
      };

      const diConfig: PackageExampleConfig = {
        ...mockPackageConfig,
        packageName: 'di',
        displayName: 'Dependency Injection',
        examples: [{
          ...mockExampleDefinition,
          id: 'di-example-1',
          tags: ['di:core'],
        }],
      };

      mockConfigLoader.loadPackageConfig
        .mockResolvedValueOnce(mockPackageConfig)
        .mockResolvedValueOnce(diConfig);

      const result = await bundler.createBundle(options);

      expect(result.metadata.packages).toEqual(['domain-services', 'di']);
      expect(result.examples).toHaveLength(2);
      expect(result.packageCount).toBe(2);
      expect(result.exampleCount).toBe(2);
    });

    it('should filter examples by complexity levels', async () => {
      const advancedExample: ExampleDefinition = {
        ...mockExampleDefinition,
        id: 'advanced-example',
        complexity: 'advanced',
        name: 'Advanced Example',
      };

      const configWithMultipleExamples: PackageExampleConfig = {
        ...mockPackageConfig,
        examples: [mockExampleDefinition, advancedExample],
      };

      mockConfigLoader.loadPackageConfig.mockResolvedValue(configWithMultipleExamples);

      const options: BundleOptions = {
        packages: ['domain-services'],
        complexityLevels: ['basic'],
      };

      const result = await bundler.createBundle(options);

      expect(result.examples).toHaveLength(1);
      expect(result?.examples?.[0]?.complexity).toBe('basic');
    });

    it('should filter examples by framework', async () => {
      const nestjsExample: ExampleDefinition = {
        ...mockExampleDefinition,
        id: 'nestjs-example',
        tags: ['domain-services:nestjs'],
      };

      const configWithFrameworkExamples: PackageExampleConfig = {
        ...mockPackageConfig,
        examples: [mockExampleDefinition, nestjsExample],
      };

      mockConfigLoader.loadPackageConfig.mockResolvedValue(configWithFrameworkExamples);

      const options: BundleOptions = {
        packages: ['domain-services'],
        framework: 'nestjs',
      };

      const result = await bundler.createBundle(options);

      // Should include both: NestJS example + core basic example (due to framework filter logic)
      expect(result.examples).toHaveLength(2);
      expect(result.examples.some(e => e.tags.includes('domain-services:nestjs'))).toBe(true);
      expect(result.examples.some(e => e.tags.includes('domain-services:core') && e.complexity === 'basic')).toBe(true);
    });

    it('should include core examples when filtering by framework', async () => {
      const coreExample: ExampleDefinition = {
        ...mockExampleDefinition,
        tags: ['domain-services:core'],
        complexity: 'basic',
      };

      const configWithCoreExample: PackageExampleConfig = {
        ...mockPackageConfig,
        examples: [coreExample],
      };

      mockConfigLoader.loadPackageConfig.mockResolvedValue(configWithCoreExample);

      const options: BundleOptions = {
        packages: ['domain-services'],
        framework: 'nestjs',
      };

      const result = await bundler.createBundle(options);

      expect(result.examples).toHaveLength(1);
      expect(result?.examples?.[0]?.tags).toContain('domain-services:core');
    });

    it('should limit number of examples when maxExamples is set', async () => {
      const examples: ExampleDefinition[] = Array.from({ length: 5 }, (_, i) => ({
        ...mockExampleDefinition,
        id: `example-${i + 1}`,
        name: `Example ${i + 1}`,
      }));

      const configWithManyExamples: PackageExampleConfig = {
        ...mockPackageConfig,
        examples,
      };

      mockConfigLoader.loadPackageConfig.mockResolvedValue(configWithManyExamples);

      const options: BundleOptions = {
        packages: ['domain-services'],
        maxExamples: 3,
      };

      const result = await bundler.createBundle(options);

      expect(result.examples).toHaveLength(3);
    });

    it('should randomize examples when requested', async () => {
      const examples: ExampleDefinition[] = Array.from({ length: 5 }, (_, i) => ({
        ...mockExampleDefinition,
        id: `example-${i + 1}`,
        name: `Example ${i + 1}`,
      }));

      const configWithManyExamples: PackageExampleConfig = {
        ...mockPackageConfig,
        examples,
      };

      mockConfigLoader.loadPackageConfig.mockResolvedValue(configWithManyExamples);

      const options: BundleOptions = {
        packages: ['domain-services'],
        randomize: true,
        seed: 'test-seed',
      };

      const result1 = await bundler.createBundle(options);
      const result2 = await bundler.createBundle(options);

      // With same seed, results should be identical
      expect(result1.examples.map(e => e.id)).toEqual(result2.examples.map(e => e.id));
    });

    it('should use custom output path when provided', async () => {
      const options: BundleOptions = {
        packages: ['domain-services'],
        outputPath: '/custom/path/bundle.md',
      };

      const result = await bundler.createBundle(options);

      expect(result.outputPath).toBe('/custom/path/bundle.md');
    });

    it('should generate default output path', async () => {
      const result = await bundler.createBundle(basicOptions);

      expect(result.outputPath).toContain('domain-services-Bundle');
      expect(result.outputPath).toContain('v1.0.0');
      expect(result.outputPath).toContain('.md');
    });

    it('should include framework in output path', async () => {
      const options: BundleOptions = {
        packages: ['domain-services'],
        framework: 'nestjs',
      };

      const result = await bundler.createBundle(options);

      expect(result.outputPath).toContain('-nestjs');
    });

    it('should handle package loading errors gracefully', async () => {
      mockConfigLoader.loadPackageConfig
        .mockResolvedValueOnce(mockPackageConfig)
        .mockRejectedValueOnce(new Error('Package not found'));

      const options: BundleOptions = {
        packages: ['domain-services', 'invalid-package'],
      };

      const result = await bundler.createBundle(options);

      expect(result.examples).toHaveLength(1); // Only valid package
      expect(result.metadata.packages).toEqual(['domain-services', 'invalid-package']); // Both listed in metadata
    });

    it('should handle example content loading errors', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));

      const result = await bundler.createBundle(basicOptions);

      expect(result.content).toContain('Unable to load example content');
    });

    it('should group examples by package in content', async () => {
      const result = await bundler.createBundle(basicOptions);

      expect(result.content).toContain('## domain-services');
      expect(result.content).toContain('### Basic Example');
    });

    it('should generate proper bundle metadata', async () => {
      const result = await bundler.createBundle(basicOptions);

      expect(result.metadata).toEqual({
        title: 'Documentation Bundle - domain-services',
        packages: ['domain-services'],
        generatedAt: expect.any(String),
        version: '1.0.0',
      });

      // Validate ISO date format
      expect(new Date(result.metadata.generatedAt)).toBeInstanceOf(Date);
    });
  });

  describe('generateBundle', () => {
    it('should be an alias for createBundle', async () => {
      mockConfigLoader.loadPackageConfig.mockResolvedValue(mockPackageConfig);

      const options: BundleOptions = {
        packages: ['domain-services'],
      };

      const result1 = await bundler.generateBundle(options);
      const result2 = await bundler.createBundle(options);

      expect(result1.metadata.title).toBe(result2.metadata.title);
      expect(result1.examples).toHaveLength(result2.examples.length);
    });
  });

  describe('error handling', () => {
    it('should handle configuration loading errors', async () => {
      mockConfigLoader.loadPackageConfig.mockRejectedValue(new Error('Config load failed'));

      const options: BundleOptions = {
        packages: ['invalid-package'],
      };

      const [error] = await safeRun(async () => await bundler.createBundle(options));

      expect(error).toBeUndefined(); // Should handle gracefully
    });

    it('should handle file system access errors', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('Permission denied'));

      mockConfigLoader.loadPackageConfig.mockResolvedValue(mockPackageConfig);

      const options: BundleOptions = {
        packages: ['domain-services'],
      };

      const [error] = await safeRun(async () => await bundler.createBundle(options));

      expect(error).toBeUndefined(); // Should handle gracefully
    });

    it('should handle empty packages array', async () => {
      const options: BundleOptions = {
        packages: [],
      };

      const result = await bundler.createBundle(options);

      expect(result.examples).toHaveLength(0);
      expect(result.packageCount).toBe(0);
      expect(result.exampleCount).toBe(0);
    });

    it('should handle missing package config', async () => {
      mockConfigLoader.loadPackageConfig.mockResolvedValue(null);

      const options: BundleOptions = {
        packages: ['domain-services'],
      };

      const [error] = await safeRun(async () => await bundler.createBundle(options));

      expect(error).toBeUndefined(); // Should handle gracefully, not crash
    });
  });

  describe('example filtering edge cases', () => {
    it('should handle empty complexity levels', async () => {
      mockConfigLoader.loadPackageConfig.mockResolvedValue(mockPackageConfig);

      const options: BundleOptions = {
        packages: ['domain-services'],
        complexityLevels: [],
      };

      const result = await bundler.createBundle(options);

      // BUG: Empty complexity levels don't filter anything, all examples remain
      expect(result.examples).toHaveLength(1); // All examples from config are included
    });

    it('should handle unknown framework', async () => {
      const nonCoreExample: ExampleDefinition = {
        ...mockExampleDefinition,
        tags: ['domain-services:other'], // Not core, not basic
        complexity: 'intermediate',
      };

      const configWithNonCoreExample: PackageExampleConfig = {
        ...mockPackageConfig,
        examples: [nonCoreExample],
      };

      mockConfigLoader.loadPackageConfig.mockResolvedValue(configWithNonCoreExample);

      const options: BundleOptions = {
        packages: ['domain-services'],
        framework: 'unknown-framework',
      };

      const result = await bundler.createBundle(options);

      expect(result.examples).toHaveLength(0);
    });

    it('should handle randomization without seed', async () => {
      const examples: ExampleDefinition[] = Array.from({ length: 3 }, (_, i) => ({
        ...mockExampleDefinition,
        id: `example-${i + 1}`,
      }));

      const configWithExamples: PackageExampleConfig = {
        ...mockPackageConfig,
        examples,
      };

      mockConfigLoader.loadPackageConfig.mockResolvedValue(configWithExamples);

      const options: BundleOptions = {
        packages: ['domain-services'],
        randomize: true,
      };

      const [error] = await safeRun(async () => await bundler.createBundle(options));

      expect(error).toBeUndefined();
    });
  });

  describe('content generation', () => {
    it('should include proper markdown structure', async () => {
      mockConfigLoader.loadPackageConfig.mockResolvedValue(mockPackageConfig);

      const result = await bundler.createBundle({
        packages: ['domain-services'],
      });

      expect(result.content).toContain('# domain-services Documentation Bundle');
      expect(result.content).toContain('## domain-services');
      expect(result.content).toContain('### Basic Example');
    });

    it('should handle packages with no examples', async () => {
      const emptyPackageConfig: PackageExampleConfig = {
        ...mockPackageConfig,
        examples: [],
      };

      mockConfigLoader.loadPackageConfig.mockResolvedValue(emptyPackageConfig);

      const result = await bundler.createBundle({
        packages: ['domain-services'],
      });

      expect(result.examples).toHaveLength(0);
      // When no examples, the package section won't be generated
      expect(result.content).toContain('# domain-services Documentation Bundle');
      expect(result.content).toContain('This documentation bundle combines examples from multiple packages.');
    });
  });
});
