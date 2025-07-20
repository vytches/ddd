import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { safeRun } from '@vytches-ddd/utils';
import { ExampleValidator } from '../../src/validators/example-validator';
import type { ValidationResult, ValidationOptions } from '../../src/validators/example-validator';
import type { ExampleDefinition, PackageExampleConfig } from '../../src/types/example-types';
import { existsSync } from 'fs';
import { join } from 'path';

// Mock dependencies
vi.mock('fs');
vi.mock('fs/promises');
vi.mock('../../src/core/utils/logger');

const mockExistsSync = vi.mocked(existsSync);

describe('ExampleValidator', () => {
  let validator: ExampleValidator;
  let mockExample: ExampleDefinition;
  let mockPackageConfig: PackageExampleConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    validator = new ExampleValidator('/test/project');

    // Mock console methods to avoid noise in tests
    vi.spyOn(console, 'log').mockImplementation(() => { return });
    vi.spyOn(console, 'warn').mockImplementation(() => { return });
    vi.spyOn(console, 'error').mockImplementation(() => { return });

    mockExample = {
      id: 'test-example',
      name: 'Test Example',
      description: 'A test example for validation',
      file: 'basic/test-example.md',
      path: 'basic/test-example.md',
      complexity: 'basic',
      priority: 'medium',
      package: 'test-package',
      tags: ['aggregate', 'testing'],
      dependencies: [],
      diSupport: false,
      frameworkIntegrations: []
    };

    mockPackageConfig = {
      packageName: 'test-package',
      displayName: 'Test Package',
      version: '1.0.0',
      description: 'Test package for validation',
      domain: 'testing',
      patterns: ['aggregate'],
      dependencies: [],
      complexityLevels: {
        basic: {
          level: 'basic',
          description: 'Basic examples',
          diSupport: false,
          diRequired: false
        }
      },
      frameworks: [{
        name: 'nestjs',
        displayName: 'NestJS',
        description: 'NestJS framework',
        complexityLevels: ['basic'],
        dependencies: []
      }],
      examples: [mockExample],
      tags: {
        core: ['aggregate'],
        integrations: [],
        frameworks: [],
        patterns: []
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
        enabled: false,
        includePrompts: false,
        includeTips: false,
        includePatterns: false,
        optimizeForCodeGeneration: false
      },
      sections: [],
      relatedPackages: {}
    };

    // Default mocks
    mockExistsSync.mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create validator with default project root', () => {
      const defaultValidator = new ExampleValidator();
      expect(defaultValidator).toBeInstanceOf(ExampleValidator);
    });

    it('should create validator with custom project root', () => {
      const customValidator = new ExampleValidator('/custom/path');
      expect(customValidator).toBeInstanceOf(ExampleValidator);
    });
  });

  describe('validatePackage', () => {
    beforeEach(() => {
      // Mock loadPackageConfig
      vi.spyOn(validator as any, 'loadPackageConfig').mockResolvedValue(mockPackageConfig);
    });

    it('should validate package successfully with valid examples', async () => {
      const result = await safeRun(async () => {
        return await validator.validatePackage('test-package');
      });
      const error = result[0] as Error | undefined;
      const validationResult = result[1] as ValidationResult | undefined;

      expect(error).toBeUndefined();
      expect(validationResult).toBeDefined();
      expect(validationResult!.isValid).toBe(true);
      expect(validationResult!.errors).toHaveLength(0);
    });

    it('should report errors for missing files', async () => {
      mockExistsSync.mockReturnValue(false);

      const result = await safeRun(async () => {
        return await validator.validatePackage('test-package');
      });
      const error = result[0] as Error | undefined;
      const validationResult = result[1] as ValidationResult | undefined;

      expect(error).toBeUndefined();
      expect(validationResult!.isValid).toBe(false);
      expect(validationResult!.errors).toHaveLength(1);
      expect(validationResult!.errors[0]!.type).toBe('file_not_found');
      expect(validationResult!.errors[0]!.message).toContain('test-example.md');
    });

    it('should handle package config loading errors', async () => {
      vi.spyOn(validator as any, 'loadPackageConfig').mockRejectedValue(new Error('Config not found'));

      const result = await safeRun(async () => {
        return await validator.validatePackage('invalid-package');
      });
      const error = result[0] as Error | undefined;
      const validationResult = result[1] as ValidationResult | undefined;

      expect(error).toBeUndefined();
      expect(validationResult!.isValid).toBe(false);
      expect(validationResult!.errors).toHaveLength(1);
      expect(validationResult!.errors[0]!.type).toBe('invalid_config');
      expect(validationResult!.errors[0]!.message).toContain('Failed to load package configuration');
    });

    it('should validate with syntax checking option', async () => {
      vi.spyOn(validator as any, 'validateSyntax').mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        suggestions: []
      });

      const options: ValidationOptions = {
        checkSyntax: true
      };

      const result = await safeRun(async () => {
        return await validator.validatePackage('test-package', options);
      });
      const error = result[0] as Error | undefined;
      const validationResult = result[1] as ValidationResult | undefined;

      expect(error).toBeUndefined();
      expect(validationResult!.isValid).toBe(true);
      expect(validator as any).toHaveProperty('validateSyntax');
    });
  });

  describe('validateExample', () => {
    it('should validate example successfully', async () => {
      const result = await safeRun(async () => {
        return await validator.validateExample(mockExample, 'test-package');
      });
      const error = result[0] as Error | undefined;
      const validationResult = result[1] as ValidationResult | undefined;

      expect(error).toBeUndefined();
      expect(validationResult!.isValid).toBe(true);
      expect(validationResult!.errors).toHaveLength(0);
    });

    it('should report error for missing name', async () => {
      const exampleWithoutName = { ...mockExample, name: '' };

      const result = await safeRun(async () => {
        return await validator.validateExample(exampleWithoutName, 'test-package');
      });
      const error = result[0] as Error | undefined;
      const validationResult = result[1] as ValidationResult | undefined;

      expect(error).toBeUndefined();
      expect(validationResult!.isValid).toBe(false);
      expect(validationResult!.errors).toHaveLength(1);
      expect(validationResult!.errors[0]!.type).toBe('missing_metadata');
      expect(validationResult!.errors[0]!.message).toContain('missing name');
    });

    it('should report warning for missing description', async () => {
      const exampleWithoutDescription = { ...mockExample, description: '' };

      const result = await safeRun(async () => {
        return await validator.validateExample(exampleWithoutDescription, 'test-package');
      });
      const error = result[0] as Error | undefined;
      const validationResult = result[1] as ValidationResult | undefined;

      expect(error).toBeUndefined();
      expect(validationResult!.isValid).toBe(true); // Warnings don't make validation fail
      expect(validationResult!.warnings).toHaveLength(1);
      expect(validationResult!.warnings[0]!.type).toBe('missing_description');
    });

    it('should report warning for missing tags', async () => {
      const exampleWithoutTags = { ...mockExample, tags: [] };

      const result = await safeRun(async () => {
        return await validator.validateExample(exampleWithoutTags, 'test-package');
      });
      const error = result[0] as Error | undefined;
      const validationResult = result[1] as ValidationResult | undefined;

      expect(error).toBeUndefined();
      expect(validationResult!.warnings).toHaveLength(1);
      expect(validationResult!.warnings[0]!.type).toBe('missing_tag');
    });

    it('should report error for invalid complexity level', async () => {
      const exampleWithInvalidComplexity = { ...mockExample, complexity: 'invalid' as any };

      const result = await safeRun(async () => {
        return await validator.validateExample(exampleWithInvalidComplexity, 'test-package');
      });
      const error = result[0] as Error | undefined;
      const validationResult = result[1] as ValidationResult | undefined;

      expect(error).toBeUndefined();
      expect(validationResult!.isValid).toBe(false);
      expect(validationResult!.errors).toHaveLength(1);
      expect(validationResult!.errors[0]!.type).toBe('invalid_config');
      expect(validationResult!.errors[0]!.message).toContain('Invalid complexity level');
    });

    it('should report warning for invalid priority', async () => {
      const exampleWithInvalidPriority = { ...mockExample, priority: 'invalid' as any };

      const result = await safeRun(async () => {
        return await validator.validateExample(exampleWithInvalidPriority, 'test-package');
      });
      const error = result[0] as Error | undefined;
      const validationResult = result[1] as ValidationResult | undefined;

      expect(error).toBeUndefined();
      expect(validationResult!.warnings).toHaveLength(1);
      expect(validationResult!.warnings[0]!.type).toBe('low_priority');
      expect(validationResult!.warnings[0]!.message).toContain('Invalid priority');
    });

    it('should validate syntax when option is enabled', async () => {
      const mockSyntaxResult = {
        isValid: false,
        errors: [{ type: 'syntax_error' as const, message: 'Syntax error found' }],
        warnings: [],
        suggestions: []
      };

      vi.spyOn(validator as any, 'validateSyntax').mockResolvedValue(mockSyntaxResult);

      const options: ValidationOptions = { checkSyntax: true };

      const result = await safeRun(async () => {
        return await validator.validateExample(mockExample, 'test-package', options);
      });
      const error = result[0] as Error | undefined;
      const validationResult = result[1] as ValidationResult | undefined;

      expect(error).toBeUndefined();
      expect(validationResult!.isValid).toBe(false);
      expect(validationResult!.errors).toHaveLength(1);
      expect(validationResult!.errors[0]!.message).toBe('Syntax error found');
    });
  });

  describe('validateExamples (alias)', () => {
    it('should call validatePackage', async () => {
      const validatePackageSpy = vi.spyOn(validator, 'validatePackage').mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        suggestions: []
      });

      const result = await safeRun(async () => {
        return await validator.validateExamples('test-package');
      });
      const error = result[0] as Error | undefined;

      expect(error).toBeUndefined();
      expect(validatePackageSpy).toHaveBeenCalledWith('test-package', {});
    });
  });

  describe('validateConfiguration', () => {
    it('should validate configuration successfully', () => {
      const result = (validator as any).validateConfiguration(mockPackageConfig);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect duplicate example IDs', () => {
      const configWithDuplicates = {
        ...mockPackageConfig,
        examples: [mockExample, { ...mockExample, name: 'Duplicate Example' }]
      };

      const result = (validator as any).validateConfiguration(configWithDuplicates);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]!.type).toBe('invalid_config');
      expect(result.errors[0]!.message).toContain('Duplicate example ID');
    });

    it('should suggest more complex examples when too many basic examples', () => {
      const basicExamples = Array.from({ length: 10 }, (_, i) => ({
        ...mockExample,
        id: `basic-example-${i}`,
        complexity: 'basic' as const
      }));

      const configWithManyBasic = {
        ...mockPackageConfig,
        examples: basicExamples
      };

      const result = (validator as any).validateConfiguration(configWithManyBasic);

      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0]!).toContain('Consider adding more intermediate and advanced examples');
    });
  });

  describe('validateSyntax', () => {
    beforeEach(() => {
      const mockFs = {
        readFile: vi.fn()
      };
      vi.doMock('fs/promises', () => mockFs);
    });

    it('should validate syntax successfully', async () => {
      const mockFs = await import('fs/promises');
      vi.mocked(mockFs.readFile).mockResolvedValue('# Valid Markdown\n\n```typescript\nconst valid = true;\n```');

      const result = await safeRun(async () => {
        return await (validator as any).validateSyntax('/test/file.md', 'test-example');
      });
      const error = result[0] as Error | undefined;
      const validationResult = result[1] as ValidationResult | undefined;

      expect(error).toBeUndefined();
      expect(validationResult!.isValid).toBe(true);
    });

    it('should detect potential syntax issues', async () => {
      const mockFs = await import('fs/promises');
      vi.mocked(mockFs.readFile).mockResolvedValue('```typescript { invalid\nconst test = "code";\n```');

      const result = await safeRun(async () => {
        return await (validator as any).validateSyntax('/test/file.md', 'test-example');
      });
      const error = result[0] as Error | undefined;
      const validationResult = result[1] as ValidationResult | undefined;

      expect(error).toBeUndefined();
      expect(validationResult!.warnings).toHaveLength(1);
      expect(validationResult!.warnings[0]!.message).toContain('Potential syntax issue');
    });

    it('should handle file reading errors', async () => {
      const mockFs = await import('fs/promises');
      vi.mocked(mockFs.readFile).mockRejectedValue(new Error('File read error'));

      const result = await safeRun(async () => {
        return await (validator as any).validateSyntax('/test/file.md', 'test-example');
      });
      const error = result[0] as Error | undefined;
      const validationResult = result[1] as ValidationResult | undefined;

      expect(error).toBeUndefined();
      expect(validationResult!.isValid).toBe(false);
      expect(validationResult!.errors).toHaveLength(1);
      expect(validationResult!.errors[0]!.type).toBe('syntax_error');
    });
  });

  describe('fixIssues', () => {
    beforeEach(() => {
      vi.spyOn(validator, 'validatePackage').mockResolvedValue({
        isValid: false,
        errors: [
          {
            type: 'file_not_found',
            message: 'File not found',
            file: 'missing-example.md',
            exampleId: 'missing-example'
          }
        ],
        warnings: [],
        suggestions: []
      });

      vi.spyOn(validator as any, 'createMissingFile').mockResolvedValue(undefined);
    });

    it('should attempt to fix validation issues', async () => {
      const result = await safeRun(async () => {
        return await validator.fixIssues('test-package');
      });
      const error = result[0] as Error | undefined;

      expect(error).toBeUndefined();
      expect((validator as any).createMissingFile).toHaveBeenCalledWith(
        'test-package',
        'missing-example.md',
        'missing-example'
      );
    });
  });

  describe('createMissingFile', () => {
    beforeEach(() => {
      const mockFs = {
        mkdir: vi.fn(),
        writeFile: vi.fn()
      };
      vi.doMock('fs/promises', () => mockFs);

      const mockPath = {
        dirname: vi.fn().mockReturnValue('/test/project/packages/test-package/examples')
      };
      vi.doMock('path', () => mockPath);
    });

    it('should create missing file with template content', async () => {
      const mockFs = await import('fs/promises');
      vi.mocked(mockFs.mkdir).mockResolvedValue(undefined);
      vi.mocked(mockFs.writeFile).mockResolvedValue(undefined);

      const result = await safeRun(async () => {
        return await (validator as any).createMissingFile('test-package', 'new-example.md', 'new-example');
      });
      const error = result[0] as Error | undefined;

      expect(error).toBeUndefined();
      expect(mockFs.mkdir).toHaveBeenCalled();
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('new-example.md'),
        expect.stringContaining('# new-example'),
        'utf-8'
      );
    });

    it('should handle file creation errors gracefully', async () => {
      const mockFs = await import('fs/promises');
      vi.mocked(mockFs.mkdir).mockResolvedValue(undefined);
      vi.mocked(mockFs.writeFile).mockRejectedValue(new Error('Write error'));

      const result = await safeRun(async () => {
        return await (validator as any).createMissingFile('test-package', 'error-example.md', 'error-example');
      });
      const error = result[0] as Error | undefined;

      expect(error).toBeUndefined(); // Method handles errors internally
    });
  });

  describe('getExamplePath', () => {
    it('should construct correct example path', () => {
      const path = (validator as any).getExamplePath('test-package', 'example.md');
      expect(path).toBe(join('/test/project', 'packages', 'test-package', 'examples', 'example.md'));
    });
  });

  describe('loadPackageConfig', () => {
    it('should return default package configuration', async () => {
      const result = await safeRun(async () => {
        return await (validator as any).loadPackageConfig('test-package');
      });
      const error = result[0] as Error | undefined;
      const config = result[1] as PackageExampleConfig | undefined;

      expect(error).toBeUndefined();
      expect(config?.packageName).toBe('test-package');
      expect(config?.displayName).toBe('test-package');
      expect(config?.examples).toEqual([]);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete validation workflow', async () => {
      // Setup realistic scenario
      vi.spyOn(validator as any, 'loadPackageConfig').mockResolvedValue({
        ...mockPackageConfig,
        examples: [
          mockExample,
          { ...mockExample, id: 'example-2', name: '', file: 'missing.md' }, // Invalid example (error)
          { ...mockExample, id: 'example-3', complexity: 'invalid' }, // Invalid complexity (error)
          { ...mockExample, id: 'example-4', description: '', tags: [], priority: 'invalid' } // Missing description, no tags, invalid priority (warnings)
        ]
      });

      mockExistsSync.mockImplementation((path) => {
        return !String(path).includes('missing.md');
      });

      const result = await safeRun(async () => {
        return await validator.validatePackage('test-package', { checkSyntax: false });
      });
      const error = result[0] as Error | undefined;
      const validationResult = result[1] as ValidationResult | undefined;

      expect(error).toBeUndefined();
      expect(validationResult!.isValid).toBe(false);
      expect(validationResult!.errors.length).toBeGreaterThan(0);
      expect(validationResult!.warnings.length).toBeGreaterThan(0);
    });

    it('should validate with all options enabled', async () => {
      vi.spyOn(validator as any, 'loadPackageConfig').mockResolvedValue(mockPackageConfig);
      vi.spyOn(validator as any, 'validateSyntax').mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        suggestions: []
      });

      const options: ValidationOptions = {
        packageName: 'test-package',
        fix: true,
        autoFix: true,
        verbose: true,
        checkSyntax: true,
        checkLinks: true
      };

      const result = await safeRun(async () => {
        return await validator.validatePackage('test-package', options);
      });
      const error = result[0] as Error | undefined;
      const validationResult = result[1] as ValidationResult | undefined;

      expect(error).toBeUndefined();
      expect(validationResult!.isValid).toBe(true);
    });
  });
});
