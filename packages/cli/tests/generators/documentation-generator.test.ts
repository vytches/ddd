import { describe, it, expect, beforeEach, vi } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import { DocumentationGenerator } from '../../src/generators/documentation-generator';
import { HybridTemplateEngine } from '../../src/core/hybrid-template-engine';
import { SmartTagFinder } from '../../src/core/smart-tag-finder';
import { PackageConfigLoader } from '../../src/core/package-config-loader';
import type {
  GenerateDocumentationOptions,
  GenerateDocumentationResult,
} from '../../src/generators/documentation-generator';
import type { PackageExampleConfig, ExampleDefinition } from '../../src/types/example-types';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock dependencies
vi.mock('../../src/core/hybrid-template-engine');
vi.mock('../../src/core/smart-tag-finder');
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

describe('DocumentationGenerator', () => {
  let generator: DocumentationGenerator;
  let mockTemplateEngine: any;
  let mockTagFinder: any;
  let mockConfigLoader: any;

  const mockExampleDefinition: ExampleDefinition = {
    id: 'example-1',
    name: 'Basic Example',
    description: 'A basic test example',
    file: 'basic/example-1.md',
    complexity: 'basic',
    tags: ['domain-services:core'],
    diSupport: false,
    frameworkIntegrations: [],
    priority: 'medium',
    dependencies: [],
  };

  const mockAdvancedExample: ExampleDefinition = {
    ...mockExampleDefinition,
    id: 'advanced-example',
    name: 'Advanced Example',
    complexity: 'advanced',
    diSupport: true,
    tags: ['domain-services:core', 'domain-services:advanced'],
  };

  const mockPackageConfig: PackageExampleConfig = {
    packageName: 'domain-services',
    displayName: 'Domain Services',
    version: '1.0.0',
    description: 'Domain services package',
    domain: 'core',
    patterns: ['service-pattern', 'repository-pattern'],
    dependencies: ['@vytches/ddd-core'],
    complexityLevels: {
      basic: {
        level: 'basic',
        diSupport: false,
        diRequired: false,
        description: 'Basic implementation',
      },
      advanced: {
        level: 'advanced',
        diSupport: true,
        diRequired: false,
        description: 'Advanced implementation',
      },
    },
    frameworks: [],
    sections: ['core', 'integration', 'patterns'],
    examples: [mockExampleDefinition, mockAdvancedExample],
    tags: {
      core: ['domain-services:core'],
      integrations: ['domain-services:integration'],
      frameworks: ['domain-services:nestjs'],
      patterns: ['domain-services:patterns'],
    },
    contentConfig: {
      showImportStatements: true,
      showErrorHandling: true,
      showTesting: false,
      showPerformance: false,
      includeBestPractices: true,
      includeCommonPitfalls: false,
      showVersionHistory: false,
    },
    llmSupport: {
      enabled: true,
      includePrompts: false,
      includeTips: true,
      includePatterns: true,
      optimizeForCodeGeneration: false,
    },
    relatedPackages: {},
    tagFinder: {
      maxExamples: 3,
      seed: 'test-seed',
      priorityTags: ['basic', 'core'],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mocks
    mockTemplateEngine = {
      render: vi.fn(),
    };
    mockTagFinder = {
      findExamplesByTag: vi.fn(),
      selectExamples: vi.fn(),
    };
    mockConfigLoader = {
      loadPackageConfig: vi.fn(),
    };

    // Mock constructors
    vi.mocked(HybridTemplateEngine).mockImplementation(() => mockTemplateEngine);
    vi.mocked(SmartTagFinder).mockImplementation(() => mockTagFinder);
    vi.mocked(PackageConfigLoader).mockImplementation(() => mockConfigLoader);

    // Mock path operations
    vi.mocked(path.join).mockImplementation((...args) => args.join('/'));

    // Mock fs operations
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);

    // Setup default mock returns
    mockConfigLoader.loadPackageConfig.mockResolvedValue(mockPackageConfig);
    // Mock findExamplesByTag to return examples based on complexity
    mockTagFinder.findExamplesByTag.mockImplementation(
      (tagPattern: string, complexity?: string) => {
        if (complexity === 'basic') {
          return Promise.resolve([mockExampleDefinition]);
        } else if (complexity === 'advanced') {
          return Promise.resolve([mockAdvancedExample]);
        } else {
          return Promise.resolve([]); // No intermediate examples in our mock
        }
      }
    );
    mockTagFinder.selectExamples.mockResolvedValue([mockExampleDefinition]);
    mockTemplateEngine.render.mockResolvedValue('# Generated Documentation\n\nContent here...');

    generator = new DocumentationGenerator();
  });

  describe('constructor', () => {
    it('should create generator with all dependencies', () => {
      expect(generator).toBeInstanceOf(DocumentationGenerator);
      expect(HybridTemplateEngine).toHaveBeenCalled();
      expect(SmartTagFinder).toHaveBeenCalled();
      expect(PackageConfigLoader).toHaveBeenCalled();
    });
  });

  describe('generate', () => {
    const basicOptions: GenerateDocumentationOptions = {
      packageName: 'domain-services',
    };

    it('should generate documentation with basic options', async () => {
      const result = await generator.generate(basicOptions);

      expect(result).toBeDefined();
      expect(result.outputPath).toBeTruthy();
      expect(result.packageConfig).toBe(mockPackageConfig);
      expect(result.examplesUsed).toHaveLength(2); // Both basic and advanced examples (default complexityLevels)
      expect(result.sectionsIncluded).toEqual(['core', 'integration', 'patterns']);
      expect(mockConfigLoader.loadPackageConfig).toHaveBeenCalledWith('domain-services');
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should use custom complexity levels', async () => {
      const options: GenerateDocumentationOptions = {
        packageName: 'domain-services',
        complexityLevels: ['advanced'],
      };

      await generator.generate(options);

      expect(mockTagFinder.findExamplesByTag).toHaveBeenCalledWith(
        'domain-services:core',
        'advanced'
      );
    });

    it('should filter by framework', async () => {
      const options: GenerateDocumentationOptions = {
        packageName: 'domain-services',
        framework: 'nestjs',
      };

      const nestjsExample: ExampleDefinition = {
        ...mockExampleDefinition,
        id: 'nestjs-example',
        tags: ['domain-services:nestjs'],
      };

      mockTagFinder.findExamplesByTag.mockResolvedValue([nestjsExample]);

      await generator.generate(options);

      expect(mockTagFinder.findExamplesByTag).toHaveBeenCalled();
    });

    it('should filter examples for DI-only mode', async () => {
      const options: GenerateDocumentationOptions = {
        packageName: 'domain-services',
        diOnly: true,
        complexityLevels: ['basic', 'advanced'],
      };

      mockTagFinder.findExamplesByTag.mockResolvedValue([
        mockExampleDefinition, // diSupport: false
        mockAdvancedExample, // diSupport: true
      ]);

      await generator.generate(options);

      // Should have filtered out basic example without DI support
      const renderCall = mockTemplateEngine.render.mock.calls[0];
      const templateData = renderCall[1];

      // Advanced examples with DI support should be included
      expect(templateData.examples).toBeDefined();
    });

    it('should include related examples when requested', async () => {
      const options: GenerateDocumentationOptions = {
        packageName: 'domain-services',
        showRelated: true,
      };

      const relatedExample: ExampleDefinition = {
        ...mockExampleDefinition,
        id: 'related-example',
        tags: ['policies:integration:domain-services'],
      };

      mockTagFinder.findExamplesByTag
        .mockResolvedValueOnce([mockExampleDefinition]) // Core examples
        .mockResolvedValueOnce([relatedExample]); // Related examples

      await generator.generate(options);

      expect(mockTagFinder.findExamplesByTag).toHaveBeenCalledWith(
        '*:integration:domain-services',
        'basic'
      );
    });

    it('should use LLM-optimized template when requested', async () => {
      const options: GenerateDocumentationOptions = {
        packageName: 'domain-services',
        llmOptimized: true,
      };

      await generator.generate(options);

      expect(mockTemplateEngine.render).toHaveBeenCalledWith('llm-optimized', expect.any(Object));
    });

    it('should use standard template by default', async () => {
      await generator.generate(basicOptions);

      expect(mockTemplateEngine.render).toHaveBeenCalledWith('feature-doc', expect.any(Object));
    });

    it('should apply smart selection and randomization', async () => {
      const options: GenerateDocumentationOptions = {
        packageName: 'domain-services',
        randomize: true,
        maxExamples: 2,
        seed: 'custom-seed',
      };

      // Override the mock to return multiple examples
      mockTagFinder.findExamplesByTag.mockImplementation(
        (tagPattern: string, complexity?: string) => {
          if (complexity === 'basic') {
            return Promise.resolve([mockExampleDefinition]);
          } else if (complexity === 'advanced') {
            return Promise.resolve([mockAdvancedExample]);
          } else {
            return Promise.resolve([]);
          }
        }
      );
      mockTagFinder.selectExamples.mockResolvedValue([mockExampleDefinition]);

      const result = await generator.generate(options);

      expect(mockTagFinder.selectExamples).toHaveBeenCalledWith(
        [mockExampleDefinition, mockAdvancedExample], // Both examples from basic+advanced complexity levels
        expect.objectContaining({
          maxExamples: 2,
          randomize: true,
          seed: 'custom-seed',
          priorityTags: ['basic', 'core'],
        })
      );
      expect(result.randomizedExamples).toHaveLength(1); // Filtered out examples
    });

    it('should use custom output path when provided', async () => {
      const options: GenerateDocumentationOptions = {
        packageName: 'domain-services',
        outputPath: '/custom/path/docs.md',
      };

      const result = await generator.generate(options);

      expect(result.outputPath).toBe('/custom/path/docs.md');
      expect(fs.writeFile).toHaveBeenCalledWith(
        '/custom/path/docs.md',
        expect.any(String),
        'utf-8'
      );
    });

    it('should generate descriptive filename by default', async () => {
      const result = await generator.generate(basicOptions);

      expect(result.outputPath).toContain('Domain Services-Documentation');
      expect(result.outputPath).toContain('v1.0.0');
      expect(result.outputPath).toContain('Standard');
      expect(result.outputPath).toContain('.md');
    });

    it('should include framework in filename', async () => {
      const options: GenerateDocumentationOptions = {
        packageName: 'domain-services',
        framework: 'nestjs',
      };

      const result = await generator.generate(options);

      expect(result.outputPath).toContain('-nestjs');
    });

    it('should include complexity level in filename for single level', async () => {
      const options: GenerateDocumentationOptions = {
        packageName: 'domain-services',
        complexityLevels: ['advanced'],
      };

      const result = await generator.generate(options);

      expect(result.outputPath).toContain('-advanced');
    });

    it('should include LLM-Optimized in filename when enabled', async () => {
      const options: GenerateDocumentationOptions = {
        packageName: 'domain-services',
        llmOptimized: true,
      };

      const result = await generator.generate(options);

      expect(result.outputPath).toContain('LLM-Optimized');
    });

    it('should filter sections when requested', async () => {
      const options: GenerateDocumentationOptions = {
        packageName: 'domain-services',
        sections: ['core', 'integration'],
      };

      const result = await generator.generate(options);

      expect(result.sectionsIncluded).toEqual(['core', 'integration']);
    });

    it('should warn about invalid sections', async () => {
      const options: GenerateDocumentationOptions = {
        packageName: 'domain-services',
        sections: ['core', 'invalid-section', 'another-invalid'],
      };

      const result = await generator.generate(options);

      expect(result.sectionsIncluded).toEqual(['core']); // Only valid section
    });

    it('should pass correct template data', async () => {
      const options: GenerateDocumentationOptions = {
        packageName: 'domain-services',
        framework: 'nestjs',
        llmOptimized: true,
        seed: 'test-seed',
      };

      await generator.generate(options);

      const renderCall = mockTemplateEngine.render.mock.calls[0];
      const templateData = renderCall[1];

      expect(templateData).toEqual(
        expect.objectContaining({
          packageConfig: mockPackageConfig,
          complexityLevels: ['basic', 'intermediate', 'advanced'],
          framework: 'nestjs',
          sections: ['core', 'integration', 'patterns'],
          examples: [mockExampleDefinition, mockAdvancedExample],
          relatedExamples: [],
          llmOptimized: true,
          timestamp: expect.any(String),
          seed: 'test-seed',
        })
      );
    });

    it('should use package seed when no custom seed provided', async () => {
      await generator.generate(basicOptions);

      const renderCall = mockTemplateEngine.render.mock.calls[0];
      const templateData = renderCall[1];

      expect(templateData.seed).toBe('test-seed'); // From package config
    });
  });

  describe('error handling', () => {
    it('should handle package config loading errors', async () => {
      mockConfigLoader.loadPackageConfig.mockRejectedValue(new Error('Package not found'));

      const [error] = await safeRun(
        async () => await generator.generate({ packageName: 'invalid-package' })
      );

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toContain('Package not found');
    });

    it('should handle tag finder errors', async () => {
      mockTagFinder.findExamplesByTag.mockRejectedValue(new Error('Tag finder failed'));

      const [error] = await safeRun(
        async () => await generator.generate({ packageName: 'domain-services' })
      );

      expect(error).toBeInstanceOf(Error);
    });

    it('should handle template rendering errors', async () => {
      mockTemplateEngine.render.mockRejectedValue(new Error('Template render failed'));

      const [error] = await safeRun(
        async () => await generator.generate({ packageName: 'domain-services' })
      );

      expect(error).toBeInstanceOf(Error);
    });

    it('should handle file writing errors', async () => {
      vi.mocked(fs.writeFile).mockRejectedValue(new Error('Write failed'));

      const [error] = await safeRun(
        async () => await generator.generate({ packageName: 'domain-services' })
      );

      expect(error).toBeInstanceOf(Error);
    });

    it('should handle missing package config', async () => {
      mockConfigLoader.loadPackageConfig.mockResolvedValue(null);

      const [error] = await safeRun(
        async () => await generator.generate({ packageName: 'domain-services' })
      );

      expect(error).toBeDefined();
    });

    it('should handle package config without tagFinder', async () => {
      const configWithoutTagFinder: PackageExampleConfig = {
        ...mockPackageConfig,
        tagFinder: undefined,
      };

      mockConfigLoader.loadPackageConfig.mockResolvedValue(configWithoutTagFinder);

      const [error] = await safeRun(
        async () =>
          await generator.generate({
            packageName: 'domain-services',
            randomize: true,
          })
      );

      expect(error).toBeUndefined(); // Should handle gracefully
    });
  });

  describe('section validation', () => {
    it('should use all sections when none specified', async () => {
      const result = await generator.generate({
        packageName: 'domain-services',
      });

      expect(result.sectionsIncluded).toEqual(['core', 'integration', 'patterns']);
    });

    it('should handle package config without sections', async () => {
      const configWithoutSections: PackageExampleConfig = {
        ...mockPackageConfig,
        sections: undefined as unknown as string[],
      };

      mockConfigLoader.loadPackageConfig.mockResolvedValue(configWithoutSections);

      const result = await generator.generate({
        packageName: 'domain-services',
        sections: ['core'],
      });

      expect(result.sectionsIncluded).toEqual([]); // No valid sections
    });
  });

  describe('example filtering', () => {
    it('should return empty randomized examples when not randomizing', async () => {
      const result = await generator.generate({
        packageName: 'domain-services',
        randomize: false,
      });

      expect(result.randomizedExamples).toEqual([]);
    });

    it('should handle empty examples array', async () => {
      mockTagFinder.findExamplesByTag.mockResolvedValue([]);

      const result = await generator.generate({
        packageName: 'domain-services',
      });

      expect(result.examplesUsed).toEqual([]);
    });

    it('should filter DI examples correctly for basic complexity', async () => {
      const basicExampleWithDI: ExampleDefinition = {
        ...mockExampleDefinition,
        diSupport: true,
      };

      // Mock to return both examples for basic complexity
      mockTagFinder.findExamplesByTag.mockImplementation(
        (tagPattern: string, complexity?: string) => {
          if (complexity === 'basic') {
            return Promise.resolve([mockExampleDefinition, basicExampleWithDI]);
          }
          return Promise.resolve([]);
        }
      );

      const result = await generator.generate({
        packageName: 'domain-services',
        diOnly: true,
        complexityLevels: ['basic'],
      });

      // selectExamples is only called when randomize=true and tagFinder config exists
      // In this case, should return filtered examples directly
      expect(result.examplesUsed).toEqual([basicExampleWithDI]); // Only DI supported example
    });

    it('should include advanced examples in DI-only mode', async () => {
      // Mock to return examples per complexity level
      mockTagFinder.findExamplesByTag.mockImplementation(
        (tagPattern: string, complexity?: string) => {
          if (complexity === 'basic') {
            return Promise.resolve([mockExampleDefinition]); // basic, no DI
          } else if (complexity === 'advanced') {
            return Promise.resolve([mockAdvancedExample]); // advanced, with DI
          }
          return Promise.resolve([]);
        }
      );

      const result = await generator.generate({
        packageName: 'domain-services',
        diOnly: true,
        complexityLevels: ['basic', 'advanced'],
      });

      // Should include advanced example (DI supported)
      expect(result.examplesUsed).toEqual([mockAdvancedExample]); // Only advanced example with DI support
    });
  });

  describe('related examples', () => {
    it('should not find related examples when showRelated is false', async () => {
      const result = await generator.generate({
        packageName: 'domain-services',
        showRelated: false,
      });

      expect(result.examplesUsed).toBeDefined();
      // Should not call findExamplesByTag for integration examples
      expect(mockTagFinder.findExamplesByTag).toHaveBeenCalledTimes(3); // Only for complexity levels
    });

    it('should find related examples across complexity levels', async () => {
      const relatedBasic: ExampleDefinition = {
        ...mockExampleDefinition,
        id: 'related-basic',
        tags: ['other-package:integration:domain-services'],
      };

      const relatedAdvanced: ExampleDefinition = {
        ...mockAdvancedExample,
        id: 'related-advanced',
        tags: ['other-package:integration:domain-services'],
      };

      mockTagFinder.findExamplesByTag
        .mockResolvedValueOnce([mockExampleDefinition]) // basic core
        .mockResolvedValueOnce([]) // intermediate core
        .mockResolvedValueOnce([mockAdvancedExample]) // advanced core
        .mockResolvedValueOnce([relatedBasic]) // basic integration
        .mockResolvedValueOnce([]) // intermediate integration
        .mockResolvedValueOnce([relatedAdvanced]); // advanced integration

      const result = await generator.generate({
        packageName: 'domain-services',
        showRelated: true,
        complexityLevels: ['basic', 'intermediate', 'advanced'],
      });

      // Should call for all complexity levels for integration examples
      expect(mockTagFinder.findExamplesByTag).toHaveBeenCalledWith(
        '*:integration:domain-services',
        'basic'
      );
      expect(mockTagFinder.findExamplesByTag).toHaveBeenCalledWith(
        '*:integration:domain-services',
        'intermediate'
      );
      expect(mockTagFinder.findExamplesByTag).toHaveBeenCalledWith(
        '*:integration:domain-services',
        'advanced'
      );
    });
  });
});
