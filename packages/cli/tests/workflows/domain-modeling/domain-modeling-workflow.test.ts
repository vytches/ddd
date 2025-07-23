import { describe, it, expect, beforeEach, vi } from 'vitest';
import { safeRun } from '@vytches-ddd/utils';
import { DomainModelingWorkflow } from '../../../src/workflows/domain-modeling/domain-modeling-workflow';
import type { DomainModelingOptions } from '../../../src/workflows/types';
import { Colors } from '../../../src/core/utils/colors';
import { Prompts } from '../../../src/core/utils/prompts';

// Mock dependencies
vi.mock('../../../src/core/utils/colors');
vi.mock('../../../src/core/utils/prompts');

describe('DomainModelingWorkflow', () => {
  let mockOptions: DomainModelingOptions;

  beforeEach(() => {
    vi.clearAllMocks();

    mockOptions = {
      interactive: true,
      outputPath: '/test/output',
      framework: 'nestjs',
      patterns: ['repository', 'cqrs'],
    };

    // Mock Colors
    vi.mocked(Colors.bold).mockImplementation((text: string) => text);
    vi.mocked(Colors.info).mockImplementation((text: string) => text);
    vi.mocked(Colors.success).mockImplementation((text: string) => text);
  });

  describe('constructor', () => {
    it('should create workflow with options', () => {
      const workflow = new DomainModelingWorkflow(mockOptions);

      expect(workflow).toBeInstanceOf(DomainModelingWorkflow);
    });

    it('should create workflow with default options', () => {
      const workflow = new DomainModelingWorkflow();

      expect(workflow).toBeInstanceOf(DomainModelingWorkflow);
    });
  });

  describe('start', () => {
    it('should start domain modeling workflow successfully', async () => {
      // Mock prompts
      vi.mocked(Prompts.ask).mockImplementation(async options => {
        if (options.message.includes('What domain are you modeling')) {
          return 'E-commerce';
        }
        if (options.message.includes('describe')) {
          return 'Online shopping platform';
        }
        if (options.message.includes('entities')) {
          return 'User, Product, Order, Payment';
        }
        if (options.message.includes('business rules')) {
          return 'Users must verify email, Orders must have items';
        }
        return 'default';
      });

      const workflow = new DomainModelingWorkflow(mockOptions);

      const context = await workflow.start();

      expect(context.workflowType).toBe('domain-modeling');
      expect(context.step).toBe(5); // Should have progressed through all steps
      expect(context.totalSteps).toBe(4);
      expect(context.data.domain).toBe('E-commerce');
      expect(context.data.description).toBe('Online shopping platform');
      expect(context.data.entities).toEqual(['User', 'Product', 'Order', 'Payment']);
      expect(context.data.businessRules).toEqual([
        'Users must verify email',
        'Orders must have items',
      ]);
    });

    it('should handle non-interactive mode', async () => {
      const nonInteractiveOptions = {
        ...mockOptions,
        interactive: false,
      };

      const workflow = new DomainModelingWorkflow(nonInteractiveOptions);

      const context = await workflow.start();

      expect(context.workflowType).toBe('domain-modeling');
      expect(context.step).toBe(5);
      expect(context.data.domain).toBeUndefined();
      expect(context.data.entities).toBeUndefined();
      expect(context.data.businessRules).toBeUndefined();

      // Should not have called prompts
      expect(Prompts.ask).not.toHaveBeenCalled();
    });

    it('should create proper context metadata', async () => {
      const workflow = new DomainModelingWorkflow(mockOptions);

      const context = await workflow.start();

      expect(context.metadata.startedAt).toBeInstanceOf(Date);
      expect(context.metadata.lastModified).toBeInstanceOf(Date);
      expect(context.metadata.sessionId).toMatch(/^domain-modeling-\d+$/);
    });

    it('should handle empty entity input', async () => {
      vi.mocked(Prompts.ask).mockImplementation(async options => {
        if (options.message.includes('entities')) {
          return '';
        }
        return 'default';
      });

      const workflow = new DomainModelingWorkflow(mockOptions);

      const context = await workflow.start();

      expect(context.data.entities).toEqual([]);
    });

    it('should handle empty business rules input', async () => {
      vi.mocked(Prompts.ask).mockImplementation(async options => {
        if (options.message.includes('business rules')) {
          return '';
        }
        return 'default';
      });

      const workflow = new DomainModelingWorkflow(mockOptions);

      const context = await workflow.start();

      expect(context.data.businessRules).toEqual([]);
    });

    it('should trim whitespace from entity names', async () => {
      vi.mocked(Prompts.ask).mockImplementation(async options => {
        if (options.message.includes('entities')) {
          return 'User,  Product , Order  ,  Payment  ';
        }
        return 'default';
      });

      const workflow = new DomainModelingWorkflow(mockOptions);

      const context = await workflow.start();

      expect(context.data.entities).toEqual(['User', 'Product', 'Order', 'Payment']);
    });

    it('should trim whitespace from business rules', async () => {
      vi.mocked(Prompts.ask).mockImplementation(async options => {
        if (options.message.includes('business rules')) {
          return 'Rule 1,  Rule 2 , Rule 3  ';
        }
        return 'default';
      });

      const workflow = new DomainModelingWorkflow(mockOptions);

      const context = await workflow.start();

      expect(context.data.businessRules).toEqual(['Rule 1', 'Rule 2', 'Rule 3']);
    });

    it('should display progress messages', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {
        return;
      });

      const workflow = new DomainModelingWorkflow(mockOptions);

      await workflow.start();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🎯 Starting Domain Modeling Workflow...')
      );
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('(1/4) Domain Discovery'));
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('(2/4) Entity Identification')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('(3/4) Relationship Mapping')
      );
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('(4/4) Business Rules'));
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('✅ Domain modeling completed!')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('step progression', () => {
    it('should progress through all steps correctly', async () => {
      vi.mocked(Prompts.ask).mockResolvedValue('test');

      const workflow = new DomainModelingWorkflow(mockOptions);

      const context = await workflow.start();

      expect(context.step).toBe(5); // Should be step + 1 after completion
      expect(context.totalSteps).toBe(4);
    });

    it('should handle relationship mapping step', async () => {
      vi.mocked(Prompts.ask).mockResolvedValue('test');

      const workflow = new DomainModelingWorkflow(mockOptions);

      const context = await workflow.start();

      expect(context.data.relationships).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('should handle prompt errors gracefully', async () => {
      vi.mocked(Prompts.ask).mockRejectedValue(new Error('Prompt failed'));

      const workflow = new DomainModelingWorkflow(mockOptions);

      const [error] = await safeRun(async () => await workflow.start());

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toBe('Prompt failed');
    });

    it('should handle partial workflow completion', async () => {
      let callCount = 0;
      vi.mocked(Prompts.ask).mockImplementation(async () => {
        callCount++;
        if (callCount > 2) {
          throw new Error('Stopped at step 3');
        }
        return 'test';
      });

      const workflow = new DomainModelingWorkflow(mockOptions);

      const [error] = await safeRun(async () => await workflow.start());

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toBe('Stopped at step 3');
    });
  });

  describe('input validation', () => {
    it('should handle various input formats for entities', async () => {
      vi.mocked(Prompts.ask).mockImplementation(async options => {
        if (options.message.includes('entities')) {
          return 'User,Product;Order|Payment';
        }
        return 'default';
      });

      const workflow = new DomainModelingWorkflow(mockOptions);

      const context = await workflow.start();

      // Should split only on commas
      expect(context.data.entities).toEqual(['User', 'Product;Order|Payment']);
    });

    it('should filter out empty entity names', async () => {
      vi.mocked(Prompts.ask).mockImplementation(async options => {
        if (options.message.includes('entities')) {
          return 'User,,Product,,Order,';
        }
        return 'default';
      });

      const workflow = new DomainModelingWorkflow(mockOptions);

      const context = await workflow.start();

      expect(context.data.entities).toEqual(['User', 'Product', 'Order']);
    });

    it('should filter out empty business rules', async () => {
      vi.mocked(Prompts.ask).mockImplementation(async options => {
        if (options.message.includes('business rules')) {
          return 'Rule 1,,Rule 2,,Rule 3,';
        }
        return 'default';
      });

      const workflow = new DomainModelingWorkflow(mockOptions);

      const context = await workflow.start();

      expect(context.data.businessRules).toEqual(['Rule 1', 'Rule 2', 'Rule 3']);
    });
  });
});
