import type { MockedClass } from 'vitest';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import { domainBuilderCommand } from '../../src/commands/domain-builder';
import { DomainBuilderWorkflow } from '../../src/workflows/domain-builder/domain-builder-workflow';
import { Performance } from '../../src/core/utils/performance';

// Mock all dependencies
vi.mock('../../src/workflows/domain-builder/domain-builder-workflow');
vi.mock('../../src/core/utils/performance');
vi.mock('../../src/core/utils/colors', () => ({
  Colors: {
    bold: vi.fn(text => text),
    cyan: vi.fn(text => text),
    error: vi.fn(text => text),
    green: vi.fn(text => text),
    dim: vi.fn(text => text),
  },
}));

// Mock types
const mockDomainBuilderWorkflow = DomainBuilderWorkflow as unknown as MockedClass<
  typeof DomainBuilderWorkflow
>;
const mockPerformance = Performance;

describe('domainBuilderCommand', () => {
  let mockWorkflowInstance: {
    execute: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock Performance
    mockPerformance.now = vi.fn().mockReturnValue(1000);
    mockPerformance.since = vi.fn().mockReturnValue(1500.5);

    // Mock workflow instance
    mockWorkflowInstance = {
      execute: vi.fn().mockResolvedValue({
        generatedFiles: ['file1.ts', 'file2.ts', 'file3.ts'],
        plannedFiles: ['file1.ts', 'file2.ts', 'file3.ts'],
        boundedContexts: ['Orders', 'Customers'],
        patterns: ['cqrs', 'event-sourcing'],
        hasDatabase: true,
        hasMonitoring: false,
      }),
    };

    (mockDomainBuilderWorkflow as any).mockImplementation(() => mockWorkflowInstance);

    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {
      return;
    });
    vi.spyOn(console, 'error').mockImplementation(() => {
      return;
    });

    // Mock process.exit
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  describe('command configuration', () => {
    it('should have correct name and description', () => {
      expect(domainBuilderCommand.name).toBe('create-domain');
      expect(domainBuilderCommand.description).toBe(
        'Create complete domain implementations with AI-powered guidance and pattern detection'
      );
      expect(domainBuilderCommand.aliases).toEqual(['domain', 'build-domain', 'cd']);
    });

    it('should have required options', () => {
      const options: any[] = domainBuilderCommand.options || [];
      expect(options).toBeDefined();
      expect(options.length).toBeGreaterThan(0);

      // Check for key options
      const nameOption = options.find((opt: any) => opt.flags.includes('--name'));
      const structureOption = options.find((opt: any) => opt.flags.includes('--structure'));
      const frameworkOption = options.find((opt: any) => opt.flags.includes('--framework'));
      const guidedOption = options.find((opt: any) => opt.flags.includes('--guided'));
      const quickOption = options.find((opt: any) => opt.flags.includes('--quick'));
      const patternsOption = options.find((opt: any) => opt.flags.includes('--patterns'));
      const dryRunOption = options.find((opt: any) => opt.flags.includes('--dry-run'));

      expect(nameOption).toBeDefined();
      expect(structureOption).toBeDefined();
      expect(structureOption.choices).toContain('clean-architecture');
      expect(structureOption.defaultValue).toBe('clean-architecture');

      expect(frameworkOption).toBeDefined();
      expect(frameworkOption.choices).toContain('nestjs');
      expect(frameworkOption.defaultValue).toBe('nestjs');

      expect(guidedOption).toBeDefined();
      expect(guidedOption.defaultValue).toBe(true);

      expect(quickOption).toBeDefined();
      expect(patternsOption).toBeDefined();
      expect(dryRunOption).toBeDefined();
    });

    it('should have examples', () => {
      expect(domainBuilderCommand.examples).toBeDefined();
      expect(((domainBuilderCommand.examples as any[]) || []).length).toBeGreaterThan(0);
    });
  });

  describe('domain building', () => {
    it('should build domain with default options', async () => {
      const args: string[] = [];
      const options = {};

      const [error] = await safeRun(async () => {
        await domainBuilderCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(mockDomainBuilderWorkflow).toHaveBeenCalledWith({
        structure: undefined,
        framework: undefined,
        guided: true,
        patterns: [],
        boundedContexts: [],
        compliance: [],
        security: [],
        monitoring: false,
        dryRun: false,
      });
      expect(mockWorkflowInstance.execute).toHaveBeenCalled();
    });

    it('should build domain with name from args', async () => {
      const args: string[] = ['E-commerce Platform'];
      const options = {};

      const [error] = await safeRun(async () => {
        await domainBuilderCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(mockDomainBuilderWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          domainName: 'E-commerce Platform',
        })
      );
    });

    it('should build domain with name from options', async () => {
      const args: string[] = [];
      const options = { name: 'Banking System' };

      const [error] = await safeRun(async () => {
        await domainBuilderCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(mockDomainBuilderWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          domainName: 'Banking System',
        })
      );
    });

    it('should build domain in quick mode', async () => {
      const args: string[] = ['Quick Domain'];
      const options = { quick: true };

      const [error] = await safeRun(async () => {
        await domainBuilderCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(mockDomainBuilderWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          domainName: 'Quick Domain',
          guided: false,
        })
      );
    });

    it('should fail quick mode without domain name', async () => {
      const args: string[] = [];
      const options = { quick: true };

      const [error] = await safeRun(async () => {
        await domainBuilderCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Domain name is required for quick mode')
      );
    });

    it('should build domain with patterns', async () => {
      const args: string[] = [];
      const options = {
        patterns: 'cqrs,event-sourcing,saga',
      };

      const [error] = await safeRun(async () => {
        await domainBuilderCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(mockDomainBuilderWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          patterns: ['cqrs', 'event-sourcing', 'saga'],
        })
      );
    });

    it('should build domain with bounded contexts', async () => {
      const args: string[] = [];
      const options = {
        boundedContexts: 'Orders,Customers,Inventory',
      };

      const [error] = await safeRun(async () => {
        await domainBuilderCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(mockDomainBuilderWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          boundedContexts: ['Orders', 'Customers', 'Inventory'],
        })
      );
    });

    it('should build domain with compliance standards', async () => {
      const args: string[] = [];
      const options = {
        compliance: 'gdpr,sox',
      };

      const [error] = await safeRun(async () => {
        await domainBuilderCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(mockDomainBuilderWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          compliance: ['gdpr', 'sox'],
        })
      );
    });

    it('should build domain with security features', async () => {
      const args: string[] = [];
      const options = {
        security: 'jwt,oauth2,encryption',
      };

      const [error] = await safeRun(async () => {
        await domainBuilderCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(mockDomainBuilderWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          security: ['jwt', 'oauth2', 'encryption'],
        })
      );
    });

    it('should build domain with monitoring', async () => {
      const args: string[] = [];
      const options = {
        monitoring: true,
      };

      const [error] = await safeRun(async () => {
        await domainBuilderCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(mockDomainBuilderWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          monitoring: true,
        })
      );
    });

    it('should build domain with all options', async () => {
      const args: string[] = ['Enterprise Domain'];
      const options = {
        structure: 'hexagonal',
        framework: 'express',
        patterns: 'cqrs,saga',
        boundedContexts: 'Sales,Marketing',
        compliance: 'gdpr,pci',
        security: 'jwt,rbac',
        monitoring: true,
      };

      const [error] = await safeRun(async () => {
        await domainBuilderCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(mockDomainBuilderWorkflow).toHaveBeenCalledWith({
        domainName: 'Enterprise Domain',
        structure: 'hexagonal',
        framework: 'express',
        guided: true,
        patterns: ['cqrs', 'saga'],
        boundedContexts: ['Sales', 'Marketing'],
        compliance: ['gdpr', 'pci'],
        security: ['jwt', 'rbac'],
        monitoring: true,
        dryRun: false,
      });
    });
  });

  describe('dry run mode', () => {
    it('should perform dry run', async () => {
      const args: string[] = ['Test Domain'];
      const options = { dryRun: true };

      const [error] = await safeRun(async () => {
        await domainBuilderCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(mockDomainBuilderWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          dryRun: true,
        })
      );
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Dry Run Summary'));
    });

    it('should show dry run statistics', async () => {
      mockWorkflowInstance.execute.mockResolvedValue({
        plannedFiles: ['file1.ts', 'file2.ts', 'file3.ts', 'file4.ts'],
        boundedContexts: ['Orders', 'Customers', 'Inventory'],
        patterns: ['cqrs', 'event-sourcing', 'saga'],
        generatedFiles: [],
        hasDatabase: false,
        hasMonitoring: false,
      });

      const args: string[] = [];
      const options = { dryRun: true };

      const [error] = await safeRun(async () => {
        await domainBuilderCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Would generate: 4 files'));
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Across: 3 bounded contexts')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('With patterns: cqrs, event-sourcing, saga')
      );
    });
  });

  describe('completion summary', () => {
    it('should show basic next steps', async () => {
      mockWorkflowInstance.execute.mockResolvedValue({
        generatedFiles: ['file1.ts', 'file2.ts'],
        boundedContexts: ['Orders'],
        patterns: ['cqrs'],
        hasDatabase: false,
        hasMonitoring: false,
      });

      const args: string[] = [];
      const options = {};

      const [error] = await safeRun(async () => {
        await domainBuilderCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Next Steps'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Install dependencies'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Start development'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Run tests'));
    });

    it('should show database setup step when hasDatabase is true', async () => {
      mockWorkflowInstance.execute.mockResolvedValue({
        generatedFiles: ['file1.ts'],
        boundedContexts: ['Orders'],
        patterns: ['cqrs'],
        hasDatabase: true,
        hasMonitoring: false,
      });

      const args: string[] = [];
      const options = {};

      const [error] = await safeRun(async () => {
        await domainBuilderCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Setup database'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('docker-compose up -d'));
    });

    it('should show monitoring step when hasMonitoring is true', async () => {
      mockWorkflowInstance.execute.mockResolvedValue({
        generatedFiles: ['file1.ts'],
        boundedContexts: ['Orders'],
        patterns: ['cqrs'],
        hasDatabase: false,
        hasMonitoring: true,
      });

      const args: string[] = [];
      const options = {};

      const [error] = await safeRun(async () => {
        await domainBuilderCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('View monitoring'));
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('http://localhost:3001/metrics')
      );
    });

    it('should show generation statistics', async () => {
      const args: string[] = [];
      const options = {};

      const [error] = await safeRun(async () => {
        await domainBuilderCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Generated: 3 files'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Bounded contexts: 2'));
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Patterns applied: 2'));
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Generation time: 1500.5ms')
      );
    });
  });

  describe('error handling', () => {
    it('should handle workflow execution errors', async () => {
      const mockError = new Error('Workflow failed');
      mockWorkflowInstance.execute.mockRejectedValue(mockError);

      const args: string[] = [];
      const options = {};

      const [error] = await safeRun(async () => {
        await domainBuilderCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Domain generation failed: Workflow failed')
      );
    });

    it('should handle non-Error exceptions', async () => {
      mockWorkflowInstance.execute.mockRejectedValue('String error');

      const args: string[] = [];
      const options = {};

      const [error] = await safeRun(async () => {
        await domainBuilderCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Domain generation failed: String error')
      );
    });

    it('should show stack trace for errors', async () => {
      const mockError = new Error('Detailed error');
      mockError.stack = 'Error stack trace details';
      mockWorkflowInstance.execute.mockRejectedValue(mockError);

      const args: string[] = [];
      const options = {};

      const [error] = await safeRun(async () => {
        await domainBuilderCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Stack trace:'));
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Error stack trace details')
      );
    });
  });

  describe('utility functions', () => {
    it('should parse comma-separated values correctly', async () => {
      const args: string[] = [];
      const options = {
        patterns: 'cqrs, event-sourcing , saga',
        boundedContexts: '  Orders  ,  Customers  ',
        security: '',
      };

      const [error] = await safeRun(async () => {
        await domainBuilderCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(mockDomainBuilderWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          patterns: ['cqrs', 'event-sourcing', 'saga'],
          boundedContexts: ['Orders', 'Customers'],
          security: [],
        })
      );
    });

    it('should handle undefined comma-separated values', async () => {
      const args: string[] = [];
      const options = {};

      const [error] = await safeRun(async () => {
        await domainBuilderCommand.action(args, options);
      });

      expect(error).toBeUndefined();
      expect(mockDomainBuilderWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          patterns: [],
          boundedContexts: [],
          compliance: [],
          security: [],
        })
      );
    });
  });
});
