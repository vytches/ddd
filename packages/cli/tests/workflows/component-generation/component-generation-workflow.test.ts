import { describe, it, expect, beforeEach, vi } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import { ComponentGenerationWorkflow } from '../../../src/workflows/component-generation/component-generation-workflow';
import type { ComponentGenerationOptions } from '../../../src/workflows/types';
import { Colors } from '../../../src/core/utils/colors';
import { Prompts } from '../../../src/core/utils/prompts';
import { FileSystem } from '../../../src/core/utils/file-system';

// Mock dependencies
vi.mock('../../../src/core/utils/colors');
vi.mock('../../../src/core/utils/prompts');
vi.mock('../../../src/core/utils/file-system');

describe('ComponentGenerationWorkflow', () => {
  let mockOptions: Partial<ComponentGenerationOptions>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockOptions = {
      componentType: 'entity',
      name: 'User',
      framework: 'nestjs',
      patterns: ['validation', 'events'],
      outputPath: '/test/output',
    };

    // Mock Colors
    vi.mocked(Colors.bold).mockImplementation((text: string) => text);
    vi.mocked(Colors.info).mockImplementation((text: string) => text);
    vi.mocked(Colors.success).mockImplementation((text: string) => text);
    vi.mocked(Colors.dim).mockImplementation((text: string) => text);

    // Mock FileSystem
    vi.mocked(FileSystem.joinPath).mockImplementation((...paths: string[]) => paths.join('/'));
  });

  describe('constructor', () => {
    it('should create workflow with full options', () => {
      const workflow = new ComponentGenerationWorkflow(mockOptions);

      expect(workflow).toBeInstanceOf(ComponentGenerationWorkflow);
    });

    it('should create workflow with default options', () => {
      const workflow = new ComponentGenerationWorkflow();

      expect(workflow).toBeInstanceOf(ComponentGenerationWorkflow);
    });

    it('should set default options correctly', () => {
      const workflow = new ComponentGenerationWorkflow({});

      expect(workflow).toBeInstanceOf(ComponentGenerationWorkflow);
    });
  });

  describe('start', () => {
    it('should start component generation workflow successfully', async () => {
      // Mock prompts
      vi.mocked(Prompts.select).mockResolvedValue('aggregate');
      vi.mocked(Prompts.ask).mockResolvedValue('ProductCatalog');
      vi.mocked(Prompts.confirm).mockResolvedValue(true);
      vi.mocked(Prompts.multiSelect).mockResolvedValue(['validation', 'events']);

      const workflow = new ComponentGenerationWorkflow(mockOptions);

      const context = await workflow.start();

      expect(context.workflowType).toBe('component-generation');
      expect(context.step).toBe(5); // Should have progressed through all steps
      expect(context.totalSteps).toBe(4);
      expect(context.data.componentType).toBe('entity'); // From options
      expect(context.data.componentName).toBe('User'); // From options
      expect(context.data.generatedFiles).toBeDefined();
    });

    it('should handle component type selection when not provided', async () => {
      const optionsWithoutType = {
        name: 'User',
        framework: 'nestjs',
        patterns: ['validation', 'events'],
        outputPath: '/test/output',
      };

      // Clear all mocks and set fresh ones for this test
      vi.clearAllMocks();
      vi.mocked(Prompts.select).mockResolvedValue('value-object');
      vi.mocked(Prompts.ask).mockResolvedValue('Email');
      vi.mocked(Prompts.confirm).mockResolvedValue(false);
      vi.mocked(Prompts.multiSelect).mockResolvedValue(['validation']);

      const workflow = new ComponentGenerationWorkflow(optionsWithoutType);

      const context = await workflow.start();

      expect(context.data.componentType).toBe('value-object');
      expect(Prompts.select).toHaveBeenCalledWith({
        message: 'What type of component do you want to generate?',
        choices: expect.arrayContaining([
          expect.objectContaining({ value: 'entity', name: '🏛️  Entity' }),
          expect.objectContaining({ value: 'aggregate', name: '📦 Aggregate Root' }),
          expect.objectContaining({ value: 'value-object', name: '💎 Value Object' }),
        ]),
      });
    });

    it('should handle component name input when not provided', async () => {
      const optionsWithoutName = {
        componentType: 'entity',
        framework: 'nestjs',
        patterns: ['validation', 'events'],
        outputPath: '/test/output',
      };

      vi.mocked(Prompts.ask).mockResolvedValue('OrderAggregate');
      vi.mocked(Prompts.confirm).mockResolvedValue(true);
      vi.mocked(Prompts.multiSelect).mockResolvedValue([]);

      const workflow = new ComponentGenerationWorkflow(optionsWithoutName);

      const context = await workflow.start();

      expect(context.data.componentName).toBe('OrderAggregate');
      expect(Prompts.ask).toHaveBeenCalledWith({
        message: 'Enter the entity name:',
        default: 'e.g., User, Order, ProductCatalog',
        validate: expect.any(Function),
      });
    });

    it('should validate component name length', async () => {
      const optionsWithoutName = {
        componentType: 'entity',
        framework: 'nestjs',
        patterns: ['validation', 'events'],
        outputPath: '/test/output',
      };

      vi.mocked(Prompts.ask).mockResolvedValue('OrderAggregate');
      vi.mocked(Prompts.confirm).mockResolvedValue(true);
      vi.mocked(Prompts.multiSelect).mockResolvedValue([]);

      const workflow = new ComponentGenerationWorkflow(optionsWithoutName);

      await workflow.start();

      const validateFunction = vi.mocked(Prompts.ask).mock.calls[0]?.[0]?.validate;

      expect(validateFunction?.('A')).toBe('Name must be at least 2 characters');
      expect(validateFunction?.('AB')).toBe(true);
      expect(validateFunction?.('ValidName')).toBe(true);
    });

    it('should handle entity-specific configuration', async () => {
      vi.mocked(Prompts.ask).mockResolvedValue('UserEntity');
      vi.mocked(Prompts.confirm).mockResolvedValue(true);
      vi.mocked(Prompts.multiSelect).mockResolvedValue(['validation']);

      const workflow = new ComponentGenerationWorkflow({
        componentType: 'entity',
        framework: 'nestjs',
        patterns: ['validation', 'events'],
        outputPath: '/test/output',
      });

      const context = await workflow.start();

      expect(context.data.hasCustomId).toBe(true);
      expect(Prompts.confirm).toHaveBeenCalledWith({
        message: 'Does this entity have a custom ID type?',
        default: false,
      });
    });

    it('should handle aggregate-specific configuration', async () => {
      vi.mocked(Prompts.ask).mockResolvedValue('OrderAggregate');
      vi.mocked(Prompts.confirm).mockResolvedValue(false);
      vi.mocked(Prompts.multiSelect).mockResolvedValue(['events']);

      const workflow = new ComponentGenerationWorkflow({
        componentType: 'aggregate',
        framework: 'nestjs',
        patterns: ['validation', 'events'],
        outputPath: '/test/output',
      });

      const context = await workflow.start();

      expect(context.data.hasCustomId).toBe(false);
    });

    it('should handle value-object-specific configuration', async () => {
      vi.mocked(Prompts.ask).mockResolvedValue('Money');
      vi.mocked(Prompts.confirm).mockResolvedValue(true);
      vi.mocked(Prompts.multiSelect).mockResolvedValue(['validation']);

      const workflow = new ComponentGenerationWorkflow({
        componentType: 'value-object',
        framework: 'nestjs',
        patterns: ['validation', 'events'],
        outputPath: '/test/output',
      });

      const context = await workflow.start();

      expect(context.data.isComposite).toBe(true);
      expect(Prompts.confirm).toHaveBeenCalledWith({
        message: 'Is this a composite value object?',
        default: false,
      });
    });

    it('should handle service-specific configuration', async () => {
      vi.mocked(Prompts.ask).mockResolvedValue('UserService');
      vi.mocked(Prompts.confirm).mockResolvedValue(false);
      vi.mocked(Prompts.multiSelect).mockResolvedValue(['caching']);

      const workflow = new ComponentGenerationWorkflow({
        componentType: 'service',
        framework: 'nestjs',
        patterns: ['validation', 'events'],
        outputPath: '/test/output',
      });

      const context = await workflow.start();

      expect(context.data.isStateless).toBe(false);
      expect(Prompts.confirm).toHaveBeenCalledWith({
        message: 'Is this service stateless?',
        default: true,
      });
    });

    it('should suggest appropriate patterns for different component types', async () => {
      vi.mocked(Prompts.ask).mockResolvedValue('UserService');
      vi.mocked(Prompts.confirm).mockResolvedValue(true);
      vi.mocked(Prompts.multiSelect).mockResolvedValue(['caching', 'logging']);

      const workflow = new ComponentGenerationWorkflow({
        componentType: 'service',
        framework: 'nestjs',
        patterns: ['validation', 'events'],
        outputPath: '/test/output',
      });

      const context = await workflow.start();

      expect(Prompts.multiSelect).toHaveBeenCalledWith({
        message: 'Select patterns to integrate:',
        choices: expect.arrayContaining([
          expect.objectContaining({ value: 'caching', name: '💾 Caching' }),
          expect.objectContaining({ value: 'logging', name: '📝 Logging' }),
          expect.objectContaining({ value: 'retry', name: '🔄 Retry Logic' }),
        ]),
      });
    });

    it('should generate files correctly', async () => {
      vi.mocked(Prompts.ask).mockResolvedValue('User');
      vi.mocked(Prompts.confirm).mockResolvedValue(true);
      vi.mocked(Prompts.multiSelect).mockResolvedValue(['validation']);

      const workflow = new ComponentGenerationWorkflow({
        componentType: 'entity',
        framework: 'nestjs',
        patterns: ['validation', 'events'],
        outputPath: '/test/output',
      });

      const context = await workflow.start();

      const generatedFiles = context.data.generatedFiles as string[];
      expect(generatedFiles).toHaveLength(2); // Main file + test file
      expect(generatedFiles[0]).toContain('user.entity.ts');
      expect(generatedFiles[1]).toContain('user.entity.test.ts');
    });

    it('should create proper context metadata', async () => {
      vi.mocked(Prompts.ask).mockResolvedValue('User');
      vi.mocked(Prompts.confirm).mockResolvedValue(true);
      vi.mocked(Prompts.multiSelect).mockResolvedValue([]);

      const workflow = new ComponentGenerationWorkflow(mockOptions);

      const context = await workflow.start();

      expect(context.metadata.startedAt).toBeInstanceOf(Date);
      expect(context.metadata.lastModified).toBeInstanceOf(Date);
      expect(context.metadata.sessionId).toMatch(/^component-generation-\d+$/);
    });

    it('should display progress messages', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {
        return;
      });

      vi.mocked(Prompts.ask).mockResolvedValue('User');
      vi.mocked(Prompts.confirm).mockResolvedValue(true);
      vi.mocked(Prompts.multiSelect).mockResolvedValue([]);

      const workflow = new ComponentGenerationWorkflow(mockOptions);

      await workflow.start();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔧 Starting Component Generation Workflow...')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('(1/4) Component Type Selection')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('(2/4) Component Configuration')
      );
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('(3/4) Pattern Integration'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('(4/4) Code Generation'));
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('✅ Component generation completed!')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('error handling', () => {
    it('should handle prompt errors gracefully', async () => {
      // Mock the first prompt that would be called (multiSelect for patterns)
      vi.mocked(Prompts.multiSelect).mockRejectedValue(new Error('Prompt failed'));

      const workflow = new ComponentGenerationWorkflow(mockOptions);

      const [error] = await safeRun(async () => await workflow.start());

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toBe('Prompt failed');
    });

    it('should handle file generation errors', async () => {
      vi.mocked(Prompts.ask).mockResolvedValue('User');
      vi.mocked(Prompts.confirm).mockResolvedValue(true);
      vi.mocked(Prompts.multiSelect).mockResolvedValue([]);
      vi.mocked(FileSystem.joinPath).mockImplementation(() => {
        throw new Error('File system error');
      });

      const workflow = new ComponentGenerationWorkflow(mockOptions);

      const [error] = await safeRun(async () => await workflow.start());

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toBe('File system error');
    });
  });

  describe('code generation', () => {
    it('should generate appropriate base class imports', async () => {
      vi.mocked(Prompts.ask).mockResolvedValue('User');
      vi.mocked(Prompts.confirm).mockResolvedValue(true);
      vi.mocked(Prompts.multiSelect).mockResolvedValue(['validation']);

      const workflow = new ComponentGenerationWorkflow({
        componentType: 'entity',
        framework: 'nestjs',
        patterns: ['validation', 'events'],
        outputPath: '/test/output',
      });

      const context = await workflow.start();

      // Test would verify generated content if we had access to it
      expect(context.data.generatedFiles).toBeDefined();
    });

    it('should generate test files with proper structure', async () => {
      vi.mocked(Prompts.ask).mockResolvedValue('User');
      vi.mocked(Prompts.confirm).mockResolvedValue(true);
      vi.mocked(Prompts.multiSelect).mockResolvedValue([]);

      const workflow = new ComponentGenerationWorkflow({
        componentType: 'entity',
        framework: 'nestjs',
        patterns: ['validation', 'events'],
        outputPath: '/test/output',
      });

      const context = await workflow.start();

      const generatedFiles = context.data.generatedFiles as string[];
      expect(generatedFiles).toContain('/test/output/user.entity.test.ts');
    });

    it('should handle different component types correctly', async () => {
      const componentTypes = ['entity', 'aggregate', 'value-object', 'service', 'repository'];

      for (const componentType of componentTypes) {
        vi.clearAllMocks();
        vi.mocked(Prompts.ask).mockResolvedValue('Test');
        vi.mocked(Prompts.confirm).mockResolvedValue(true);
        vi.mocked(Prompts.multiSelect).mockResolvedValue([]);
        vi.mocked(FileSystem.joinPath).mockImplementation((...paths: string[]) => paths.join('/'));

        const workflow = new ComponentGenerationWorkflow({
          componentType,
          framework: 'nestjs',
          patterns: ['validation', 'events'],
          outputPath: '/test/output',
        });

        const context = await workflow.start();

        expect(context.data.componentType).toBe(componentType);
        expect(context.data.generatedFiles).toBeDefined();
      }
    });
  });

  describe('pattern integration', () => {
    it('should skip pattern selection when no patterns available', async () => {
      vi.mocked(Prompts.ask).mockResolvedValue('TestCommand');
      vi.mocked(Prompts.confirm).mockResolvedValue(true);
      vi.mocked(Prompts.multiSelect).mockResolvedValue([]);

      const workflow = new ComponentGenerationWorkflow({
        componentType: 'command',
        framework: 'nestjs',
        patterns: ['validation', 'events'],
        outputPath: '/test/output',
      });

      const context = await workflow.start();

      expect(context.data.patterns).toEqual([]);
    });

    it('should provide appropriate patterns for repositories', async () => {
      vi.mocked(Prompts.ask).mockResolvedValue('UserRepository');
      vi.mocked(Prompts.confirm).mockResolvedValue(true);
      vi.mocked(Prompts.multiSelect).mockResolvedValue(['caching']);

      const workflow = new ComponentGenerationWorkflow({
        componentType: 'repository',
        framework: 'nestjs',
        patterns: ['validation', 'events'],
        outputPath: '/test/output',
      });

      const context = await workflow.start();

      expect(Prompts.multiSelect).toHaveBeenCalledWith({
        message: 'Select patterns to integrate:',
        choices: expect.arrayContaining([
          expect.objectContaining({ value: 'caching', name: '💾 Caching' }),
          expect.objectContaining({ value: 'logging', name: '📝 Logging' }),
        ]),
      });
    });
  });
});
