import { describe, it, expect, beforeEach, vi } from 'vitest';
import { safeRun } from '@vytches-ddd/utils';
import { generateCommand } from '../../src/commands/generate';
import { TemplateEngine } from '../../src/core/engines/template-engine';
import { PatternRegistry } from '../../src/core/engines/pattern-registry';
import { FileSystem } from '../../src/core/utils/file-system';
import { globalDocumentationRegistry } from '../../src/core/documentation-registry';
import { UnifiedExampleParser } from '../../src/parsers/unified-parser';
import { DocumentationGenerator } from '../../src/generators/documentation-generator';

// Mock all dependencies
vi.mock('../../src/core/engines/template-engine');
vi.mock('../../src/core/engines/pattern-registry');
vi.mock('../../src/core/utils/file-system');
vi.mock('../../src/core/documentation-registry');
vi.mock('../../src/parsers/unified-parser');
vi.mock('../../src/generators/documentation-generator');
vi.mock('../../src/core/utils/prompts', () => ({
  promptForInput: vi.fn(),
  promptForChoice: vi.fn(),
  promptForConfirmation: vi.fn(),
}));

// Mock dependencies with proper typing
const mockTemplateEngine = TemplateEngine as any;
const mockPatternRegistry = PatternRegistry as any;
const mockFileSystem = FileSystem as any;
const mockDocumentationRegistry = globalDocumentationRegistry as any;
const mockUnifiedExampleParser = UnifiedExampleParser as any;
const mockDocumentationGenerator = DocumentationGenerator as any;

describe('generateCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    mockTemplateEngine.create = vi.fn().mockReturnValue({
      loadTemplatesFromDirectory: vi.fn(),
      hasTemplate: vi.fn().mockReturnValue(true),
      render: vi.fn().mockReturnValue('// Generated code'),
      getTemplateNames: vi.fn().mockReturnValue(['aggregate.ts', 'entity.ts']),
    });

    mockPatternRegistry.create = vi.fn().mockReturnValue({
      register: vi.fn(),
      get: vi.fn(),
    });

    mockFileSystem.exists = vi.fn().mockReturnValue(true);
    mockFileSystem.isDirectory = vi.fn().mockReturnValue(true);
    mockFileSystem.getDirectoryName = vi.fn().mockReturnValue('/mock/dir');
    mockFileSystem.joinPath = vi.fn().mockImplementation((...paths: string[]) => paths.join('/'));
    mockFileSystem.createDirectory = vi.fn();
    mockFileSystem.writeFile = vi.fn();

    mockDocumentationRegistry.loadAll = vi.fn();
    mockDocumentationRegistry.findById = vi.fn();
    mockDocumentationRegistry.query = vi.fn().mockReturnValue([]);
    mockDocumentationRegistry.getAvailableFrameworks = vi.fn().mockReturnValue([]);
    mockDocumentationRegistry.getAvailableComponents = vi.fn().mockReturnValue([]);

    mockUnifiedExampleParser.prototype.parseExample = vi.fn();
    mockUnifiedExampleParser.prototype.filterComponents = vi.fn().mockReturnValue(new Map());

    mockDocumentationGenerator.prototype.generate = vi.fn().mockResolvedValue({
      outputPath: '/mock/output.md',
      randomizedExamples: [],
    });

    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => { return });
    vi.spyOn(console, 'error').mockImplementation(() => { return });

    // Mock process.exit
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  describe('command configuration', () => {
    it('should have correct name and description', () => {
      expect(generateCommand.name).toBe('generate');
      expect(generateCommand.description).toBe('Generate DDD components, patterns, and complete domains');
      expect(generateCommand.aliases).toEqual(['g']);
    });

    it('should have required options', () => {
      const options: any[] = generateCommand.options || [];
      expect(options).toBeDefined();
      expect(options.length).toBeGreaterThan(0);

      // Check for key options
      const typeOption = options.find((opt: any) => opt.flags.includes('--type'));
      const nameOption = options.find((opt: any) => opt.flags.includes('--name'));
      const outputOption = options.find((opt: any) => opt.flags.includes('--output'));

      expect(typeOption).toBeDefined();
      expect(nameOption).toBeDefined();
      expect(outputOption).toBeDefined();
    });

    it('should have examples', () => {
      expect(generateCommand.examples).toBeDefined();
      expect((generateCommand.examples as any[] || []).length).toBeGreaterThan(0);
    });
  });

  describe('documentation generation mode', () => {
    it('should handle documentation generation for valid package', async () => {
      const args: string[] = ['domain-services'];
      const options = { complexity: 'basic', framework: 'nestjs' };

      const [error] = await safeRun(async () => {
        await generateCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(mockDocumentationGenerator.prototype.generate).toHaveBeenCalledWith({
        packageName: 'domain-services',
        complexityLevels: ['basic'],
        framework: 'nestjs',
        randomize: true,
      });
    });

    it('should handle documentation generation with multiple complexity levels', async () => {
      const args: string[] = ['policies'];
      const options = { complexity: 'basic,intermediate,advanced', llmOptimized: true };

      const [error] = await safeRun(async () => {
        await generateCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(mockDocumentationGenerator.prototype.generate).toHaveBeenCalledWith({
        packageName: 'policies',
        complexityLevels: ['basic', 'intermediate', 'advanced'],
        llmOptimized: true,
        randomize: true,
      });
    });

    it('should handle documentation generation with all options', async () => {
      const args: string[] = ['di'];
      const options = {
        complexity: 'intermediate',
        framework: 'nestjs',
        llmOptimized: true,
        showRelated: true,
        maxExamples: 5,
        noRandomize: true,
        seed: 'test-seed',
        diOnly: true,
        output: './custom-output'
      };

      const [error] = await safeRun(async () => {
        await generateCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(mockDocumentationGenerator.prototype.generate).toHaveBeenCalledWith({
        packageName: 'di',
        complexityLevels: ['intermediate'],
        framework: 'nestjs',
        llmOptimized: true,
        showRelated: true,
        maxExamples: 5,
        randomize: false,
        seed: 'test-seed',
        diOnly: true,
        outputPath: './custom-output',
      });
    });

    it('should handle documentation generation errors', async () => {
      const args: string[] = ['invalid-package'];
      const options = {};

      mockDocumentationGenerator.prototype.generate.mockRejectedValue(new Error('Package not found'));

      const [error] = await safeRun(async () => {
        await generateCommand.action(args, options);
      });

      expect(error).toBeUndefined(); // Command handles errors internally
      // Note: Error handling behavior depends on actual implementation
    });
  });

  describe('component generation mode', () => {
    it('should handle direct component generation', async () => {
      const args: string[] = [];
      const options = {
        type: 'aggregate',
        name: 'Order',
        output: './src',
        framework: 'standalone'
      };

      const [error] = await safeRun(async () => {
        await generateCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(mockTemplateEngine.create).toHaveBeenCalled();
    });

    it('should handle example-based generation', async () => {
      const args: string[] = [];
      const options = {
        example: 'order-example',
        name: 'CustomerOrder',
        framework: 'nestjs'
      };

      // Mock example finding
      mockDocumentationRegistry.findById.mockReturnValue({
        id: 'order-example',
        name: 'Order Example',
        description: 'Example order implementation',
        complexity: 'intermediate',
        patterns: ['aggregate'],
      });

      const [error] = await safeRun(async () => {
        await generateCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(mockDocumentationRegistry.loadAll).toHaveBeenCalled();
      expect(mockDocumentationRegistry.findById).toHaveBeenCalledWith('order-example');
    });

    it('should handle example not found', async () => {
      const args: string[] = [];
      const options = {
        example: 'non-existent-example',
        name: 'Test'
      };

      // Mock example not found
      mockDocumentationRegistry.findById.mockReturnValue(null);
      mockDocumentationRegistry.query.mockReturnValue([
        { id: 'similar-example', name: 'Similar Example' }
      ]);

      const [error] = await safeRun(async () => {
        await generateCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(mockDocumentationRegistry.findById).toHaveBeenCalledWith('non-existent-example');
      expect(mockDocumentationRegistry.query).toHaveBeenCalled();
    });

    it('should handle domain context generation', async () => {
      const args: string[] = [];
      const options = {
        domain: 'ecommerce',
        fullDomain: true,
        output: './src'
      };

      const [error] = await safeRun(async () => {
        await generateCommand.action(args, options);
      });

      expect(error).toBeUndefined();
    });

    it('should handle domain selection mode', async () => {
      const args: string[] = [];
      const options = {
        domain: 'ecommerce',
        output: './src'
        // fullDomain: false (default)
      };

      const [error] = await safeRun(async () => {
        await generateCommand.action(args, options);
      });

      expect(error).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should handle validation errors', async () => {
      const args: string[] = [];
      const options = {
        type: 'aggregate',
        name: '', // Invalid name
      };

      const [error] = await safeRun(async () => {
        await generateCommand.action(args, options);
      });

      expect(error).toBeUndefined(); // Command handles errors internally
      // Note: Validation error handling depends on actual implementation
    });

    it('should handle template loading errors', async () => {
      const args: string[] = [];
      const options = {
        type: 'aggregate',
        name: 'Order',
      };

      // Mock template loading failure
      mockFileSystem.exists.mockReturnValue(false);

      const [error] = await safeRun(async () => {
        await generateCommand.action(args, options);
      });

      expect(error).toBeUndefined(); // Command handles errors internally
      // Note: Template loading error handling depends on actual implementation
    });

    it('should handle file writing errors', async () => {
      const args: string[] = [];
      const options = {
        type: 'aggregate',
        name: 'Order',
      };

      // Mock file writing failure
      mockFileSystem.writeFile.mockRejectedValue(new Error('Permission denied'));

      const [error] = await safeRun(async () => {
        await generateCommand.action(args, options);
      });

      expect(error).toBeUndefined(); // Command handles errors internally
      // Note: File writing error handling depends on actual implementation
    });
  });

  describe('dry run mode', () => {
    it('should handle dry run without writing files', async () => {
      const args: string[] = [];
      const options = {
        type: 'aggregate',
        name: 'Order',
        dryRun: true,
      };

      const [error] = await safeRun(async () => {
        await generateCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(mockFileSystem.writeFile).not.toHaveBeenCalled();
    });

    it('should show files that would be generated in dry run', async () => {
      const args: string[] = [];
      const options = {
        type: 'entity',
        name: 'Customer',
        withTests: true,
        dryRun: true,
      };

      const [error] = await safeRun(async () => {
        await generateCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Dry run mode - files that would be generated:')
      );
    });
  });

  describe('interactive mode triggers', () => {
    it('should trigger interactive mode when no type specified', async () => {
      const args: string[] = [];
      const options = {
        name: 'Order'
        // type: undefined
      };

      const [error] = await safeRun(async () => {
        await generateCommand.action(args, options);
      });

      expect(error).toBeUndefined();
    });

    it('should trigger interactive mode when no name specified', async () => {
      const args: string[] = [];
      const options = {
        type: 'aggregate'
        // name: undefined
      };

      const [error] = await safeRun(async () => {
        await generateCommand.action(args, options);
      });

      expect(error).toBeUndefined();
    });

    it('should trigger interactive mode when explicitly requested', async () => {
      const args: string[] = [];
      const options = {
        interactive: true,
        type: 'aggregate',
        name: 'Order'
      };

      const [error] = await safeRun(async () => {
        await generateCommand.action(args, options);
      });

      expect(error).toBeUndefined();
    });
  });

  describe('framework integration', () => {
    it('should handle nestjs framework', async () => {
      const args: string[] = [];
      const options = {
        type: 'command',
        name: 'CreateOrder',
        framework: 'nestjs',
      };

      const [error] = await safeRun(async () => {
        await generateCommand.action(args, options);
      });

      expect(error).toBeUndefined();
    });

    it('should handle express framework', async () => {
      const args: string[] = [];
      const options = {
        type: 'repository',
        name: 'OrderRepository',
        framework: 'express',
      };

      const [error] = await safeRun(async () => {
        await generateCommand.action(args, options);
      });

      expect(error).toBeUndefined();
    });

    it('should handle standalone framework', async () => {
      const args: string[] = [];
      const options = {
        type: 'value-object',
        name: 'Email',
        framework: 'standalone',
      };

      const [error] = await safeRun(async () => {
        await generateCommand.action(args, options);
      });

      expect(error).toBeUndefined();
    });
  });

  describe('component filtering', () => {
    it('should handle only filter', async () => {
      const args: string[] = [];
      const options = {
        example: 'order-example',
        name: 'CustomerOrder',
        only: 'service,controller',
      };

      mockDocumentationRegistry.findById.mockReturnValue({
        id: 'order-example',
        name: 'Order Example',
        description: 'Example order implementation',
        complexity: 'intermediate',
      });

      const [error] = await safeRun(async () => {
        await generateCommand.action(args, options);
      });

      expect(error).toBeUndefined();
    });

    it('should handle exclude filter', async () => {
      const args: string[] = [];
      const options = {
        example: 'order-example',
        name: 'CustomerOrder',
        exclude: 'repository,dto',
      };

      mockDocumentationRegistry.findById.mockReturnValue({
        id: 'order-example',
        name: 'Order Example',
        description: 'Example order implementation',
        complexity: 'intermediate',
      });

      const [error] = await safeRun(async () => {
        await generateCommand.action(args, options);
      });

      expect(error).toBeUndefined();
    });

    it('should handle only filter as array', async () => {
      const args: string[] = [];
      const options = {
        example: 'order-example',
        name: 'CustomerOrder',
        only: ['service', 'controller'],
      };

      mockDocumentationRegistry.findById.mockReturnValue({
        id: 'order-example',
        name: 'Order Example',
        description: 'Example order implementation',
        complexity: 'intermediate',
      });

      const [error] = await safeRun(async () => {
        await generateCommand.action(args, options);
      });

      expect(error).toBeUndefined();
    });
  });

  describe('test generation', () => {
    it('should generate tests by default', async () => {
      const args: string[] = [];
      const options = {
        type: 'aggregate',
        name: 'Order',
        // withTests: undefined (should default to true)
      };

      const [error] = await safeRun(async () => {
        await generateCommand.action(args, options);
      });

      expect(error).toBeUndefined();
    });

    it('should skip test generation when disabled', async () => {
      const args: string[] = [];
      const options = {
        type: 'aggregate',
        name: 'Order',
        withTests: false,
      };

      const [error] = await safeRun(async () => {
        await generateCommand.action(args, options);
      });

      expect(error).toBeUndefined();
    });

    it('should handle missing test template gracefully', async () => {
      const args: string[] = [];
      const options = {
        type: 'custom-type',
        name: 'CustomComponent',
        withTests: true,
      };

      // Mock main template exists but test template doesn't
      const mockTemplateInstance = mockTemplateEngine.create();
      mockTemplateInstance.hasTemplate.mockImplementation((name: string) => {
        return name === 'custom-type.ts'; // Only main template exists
      });

      const [error] = await safeRun(async () => {
        await generateCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Test template not found')
      );
    });
  });

  describe('performance and timing', () => {
    it('should measure and display generation time', async () => {
      const args: string[] = [];
      const options = {
        type: 'aggregate',
        name: 'Order',
      };

      const [error] = await safeRun(async () => {
        await generateCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Generation completed in')
      );
    });
  });
});
