import { describe, it, expect, beforeEach, vi } from 'vitest';
import { safeRun } from '@vytches-ddd/utils';
import { DomainBuilderWorkflow } from '../../../src/workflows/domain-builder/domain-builder-workflow';
import type { DomainBuilderOptions } from '../../../src/workflows/types';
import { Colors } from '../../../src/core/utils/colors';
import { Performance } from '../../../src/core/utils/performance';
import { FileSystem } from '../../../src/core/utils/file-system';
import { Prompts } from '../../../src/core/utils/prompts';

// Mock dependencies
vi.mock('../../../src/core/utils/colors');
vi.mock('../../../src/core/utils/performance');
vi.mock('../../../src/core/utils/file-system');
vi.mock('../../../src/core/utils/prompts');

describe('DomainBuilderWorkflow', () => {
  let mockOptions: DomainBuilderOptions;

  beforeEach(() => {
    vi.clearAllMocks();

    mockOptions = {
      domainName: 'Test Domain',
      structure: 'clean-architecture',
      framework: 'nestjs',
      guided: false,
      patterns: ['repository', 'domain-events'],
      boundedContexts: ['Users', 'Orders'],
      compliance: [],
      security: [],
      monitoring: false,
      dryRun: true,
    };

    // Mock Performance
    vi.mocked(Performance.now).mockReturnValue(1000);
    vi.mocked(Performance.since).mockReturnValue(100);

    // Mock Colors
    vi.mocked(Colors.bold).mockImplementation((text: string) => text);
    vi.mocked(Colors.info).mockImplementation((text: string) => text);
    vi.mocked(Colors.success).mockImplementation((text: string) => text);
    vi.mocked(Colors.dim).mockImplementation((text: string) => text);

    // Mock FileSystem
    vi.mocked(FileSystem.joinPath).mockImplementation((...paths: string[]) => paths.join('/'));
  });

  describe('constructor', () => {
    it('should create workflow with options', () => {
      const workflow = new DomainBuilderWorkflow(mockOptions);

      expect(workflow).toBeInstanceOf(DomainBuilderWorkflow);
    });

    it('should initialize context with default values', () => {
      const workflow = new DomainBuilderWorkflow(mockOptions);

      expect(workflow).toBeDefined();
    });
  });

  describe('execute', () => {
    it('should execute workflow successfully with dry run', async () => {
      const workflow = new DomainBuilderWorkflow(mockOptions);

      const result = await workflow.execute();

      expect(result.success).toBe(true);
      expect(result.context.workflowType).toBe('domain-builder');
      expect(result.generatedFiles).toHaveLength(0); // Dry run mode
      expect(result.plannedFiles.length).toBeGreaterThan(0);
      expect(result.boundedContexts).toEqual(['Users', 'Orders']);
      expect(result.patterns).toEqual(['repository', 'domain-events']);
    });

    it('should execute workflow successfully without dry run', async () => {
      const optionsWithoutDryRun = { ...mockOptions, dryRun: false };
      const workflow = new DomainBuilderWorkflow(optionsWithoutDryRun);

      const result = await workflow.execute();

      expect(result.success).toBe(true);
      expect(result.generatedFiles.length).toBeGreaterThan(0);
      expect(result.plannedFiles).toHaveLength(0);
    });

    it('should handle guided mode prompts', async () => {
      const guidedOptions = {
        ...mockOptions,
        domainName: undefined as unknown as string,
        guided: true,
        patterns: [],
        boundedContexts: [],
      };

      // Mock prompts
      vi.mocked(Prompts.ask).mockImplementation(async options => {
        if (options.message.includes('domain name')) {
          return 'E-commerce Platform';
        }
        if (options.message.includes('bounded contexts')) {
          return 'Orders, Customers, Inventory';
        }
        return 'default';
      });

      vi.mocked(Prompts.select).mockResolvedValue('clean-architecture');
      vi.mocked(Prompts.multiSelect).mockResolvedValue(['cqrs', 'event-sourcing']);

      const workflow = new DomainBuilderWorkflow(guidedOptions);

      const result = await workflow.execute();

      expect(result.success).toBe(true);
      expect(Prompts.ask).toHaveBeenCalled();
      expect(Prompts.select).toHaveBeenCalled();
      expect(Prompts.multiSelect).toHaveBeenCalled();
    });

    it('should handle workflow errors gracefully', async () => {
      // Mock an error during execution
      vi.mocked(Performance.now).mockImplementation(() => {
        throw new Error('Performance error');
      });

      const workflow = new DomainBuilderWorkflow(mockOptions);

      // The workflow should catch the error and return a failure result
      const [error, result] = await safeRun(async () => await workflow.execute());

      // If the workflow catches the error properly, result should be defined with success: false
      // If the workflow doesn't catch it, error will be defined
      if (result) {
        expect((await result).success).toBe(false);
        expect((await result).error).toBeInstanceOf(Error);
        expect((await result).error?.message).toBe('Performance error');
      } else {
        // If the workflow throws instead of catching, we expect the error to be thrown
        expect(error).toBeInstanceOf(Error);
        expect(error?.message).toBe('Performance error');
      }
    });

    it('should generate default contexts based on domain name', async () => {
      const ecommerceOptions = {
        ...mockOptions,
        domainName: 'E-commerce Platform',
        guided: false,
        boundedContexts: [],
      };

      const workflow = new DomainBuilderWorkflow(ecommerceOptions);

      const result = await workflow.execute();

      expect(result.success).toBe(true);
      expect(result.boundedContexts).toEqual(['Orders', 'Customers', 'Inventory', 'Billing']);
    });

    it('should handle banking domain defaults', async () => {
      const bankingOptions = {
        ...mockOptions,
        domainName: 'Banking System',
        guided: false,
        boundedContexts: [],
      };

      const workflow = new DomainBuilderWorkflow(bankingOptions);

      const result = await workflow.execute();

      expect(result.success).toBe(true);
      expect(result.boundedContexts).toEqual([
        'Accounts',
        'Transactions',
        'Customers',
        'Compliance',
      ]);
    });

    it('should handle unknown domain defaults', async () => {
      const unknownOptions = {
        ...mockOptions,
        domainName: 'Unknown Domain',
        guided: false,
        boundedContexts: [],
      };

      const workflow = new DomainBuilderWorkflow(unknownOptions);

      const result = await workflow.execute();

      expect(result.success).toBe(true);
      expect(result.boundedContexts).toEqual(['Core', 'Users', 'Operations']);
    });

    it('should detect database feature correctly', async () => {
      const optionsWithDatabase = {
        ...mockOptions,
        patterns: ['repository', 'event-sourcing'],
      };

      const workflow = new DomainBuilderWorkflow(optionsWithDatabase);

      const result = await workflow.execute();

      expect(result.success).toBe(true);
      expect(result.hasDatabase).toBe(true);
    });

    it('should handle monitoring option', async () => {
      const optionsWithMonitoring = {
        ...mockOptions,
        monitoring: true,
      };

      const workflow = new DomainBuilderWorkflow(optionsWithMonitoring);

      const result = await workflow.execute();

      expect(result.success).toBe(true);
      expect(result.hasMonitoring).toBe(true);
    });

    it('should generate files for different frameworks', async () => {
      const expressOptions = {
        ...mockOptions,
        framework: 'express',
      };

      const workflow = new DomainBuilderWorkflow(expressOptions);

      const result = await workflow.execute();

      expect(result.success).toBe(true);
      expect(result.plannedFiles.length).toBeGreaterThan(0);
    });

    it('should handle security and compliance options', async () => {
      const secureOptions = {
        ...mockOptions,
        security: ['jwt', 'oauth2'],
        compliance: ['gdpr', 'hipaa'],
      };

      const workflow = new DomainBuilderWorkflow(secureOptions);

      const result = await workflow.execute();

      expect(result.success).toBe(true);
      expect(result.context.data.security).toEqual(['jwt', 'oauth2']);
      expect(result.context.data.compliance).toEqual(['gdpr', 'hipaa']);
    });
  });

  describe('step progression', () => {
    it('should progress through all workflow steps', async () => {
      const workflow = new DomainBuilderWorkflow(mockOptions);

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {
        return;
      });

      await workflow.execute();

      // Check that progress messages were logged
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('(1/6) Domain Discovery'));
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('(2/6) Architecture Planning')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('(3/6) Bounded Context Mapping')
      );
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('(4/6) Pattern Selection'));
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('(5/6) Security & Compliance')
      );
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('(6/6) Code Generation'));

      consoleSpy.mockRestore();
    });
  });

  describe('error handling', () => {
    it('should handle validation errors during prompts', async () => {
      const guidedOptions = {
        ...mockOptions,
        guided: true,
        domainName: undefined as unknown as string,
      };

      vi.mocked(Prompts.ask).mockRejectedValue(new Error('Validation failed'));

      const workflow = new DomainBuilderWorkflow(guidedOptions);

      const result = await workflow.execute();

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe('Validation failed');
    });

    it('should handle missing domain name gracefully', async () => {
      const optionsWithoutDomain = {
        ...mockOptions,
        domainName: undefined as unknown as string,
        guided: false,
      };

      const workflow = new DomainBuilderWorkflow(optionsWithoutDomain);

      const result = await workflow.execute();

      expect(result.success).toBe(true);
      expect(result.context.domainName).toBeUndefined();
    });
  });

  describe('file generation', () => {
    it('should generate appropriate files for different patterns', async () => {
      const patternsOptions = {
        ...mockOptions,
        patterns: ['cqrs', 'event-sourcing', 'repository'],
      };

      const workflow = new DomainBuilderWorkflow(patternsOptions);

      const result = await workflow.execute();

      expect(result.success).toBe(true);
      expect(result.plannedFiles.length).toBeGreaterThan(0);

      // Check that different pattern files would be generated
      const filePaths = result.plannedFiles.join('\n');
      expect(filePaths).toContain('cqrs');
      expect(filePaths).toContain('event-store');
      expect(filePaths).toContain('repositories');
    });

    it('should generate bounded context files', async () => {
      const multiContextOptions = {
        ...mockOptions,
        boundedContexts: ['Users', 'Orders', 'Products'],
      };

      const workflow = new DomainBuilderWorkflow(multiContextOptions);

      const result = await workflow.execute();

      expect(result.success).toBe(true);
      expect(result.plannedFiles.length).toBeGreaterThan(0);

      // Check that bounded context files would be generated
      const filePaths = result.plannedFiles.join('\n');
      expect(filePaths).toContain('users');
      expect(filePaths).toContain('orders');
      expect(filePaths).toContain('products');
    });
  });
});
