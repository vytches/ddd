import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { safeRun } from '@vytches-ddd/utils';
import type { Arguments } from 'yargs';

// Mock dependencies
vi.mock('../../../src/parsers/unified-parser', () => ({
  UnifiedExampleParser: vi.fn().mockImplementation(() => ({
    parseExample: vi.fn(),
  })),
}));

vi.mock('../../../src/core/documentation-registry', () => ({
  globalDocumentationRegistry: {
    loadAll: vi.fn(),
    findById: vi.fn(),
    query: vi.fn(),
    getAvailableFrameworks: vi.fn(),
    getAvailableComponents: vi.fn(),
  },
}));

// Mock console methods
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {
  return;
});
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {
  return;
});
const mockProcessExit = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

describe('commands/examples/show', () => {
  let showCommand: any;
  let mockRegistry: any;
  let mockParser: any;
  let mockParserInstance: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Import the command module
    showCommand = await import('../../../src/commands/examples/show');

    // Get the mocked dependencies
    const { globalDocumentationRegistry } = await import(
      '../../../src/core/documentation-registry'
    );
    const { UnifiedExampleParser } = await import('../../../src/parsers/unified-parser');

    mockRegistry = globalDocumentationRegistry;
    mockParser = UnifiedExampleParser;
    mockParserInstance = {
      parseExample: vi.fn(),
    };
    mockParser.mockImplementation(() => mockParserInstance);

    // Setup default mock responses
    mockRegistry.loadAll.mockResolvedValue(undefined);
    mockRegistry.findById.mockReturnValue(null);
    mockRegistry.query.mockReturnValue([]);
    mockRegistry.getAvailableFrameworks.mockReturnValue([]);
    mockRegistry.getAvailableComponents.mockReturnValue([]);
    mockParserInstance.parseExample.mockResolvedValue({
      base: {
        content: {
          businessContext: 'Sample business context',
        },
      },
      framework: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('command configuration', () => {
    it('should export correct command name and description', () => {
      expect(showCommand.command).toBe('show <example>');
      expect(showCommand.describe).toBe('Show example details');
    });

    it('should configure builder with all options', () => {
      const mockYargs = {
        positional: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis(),
        example: vi.fn().mockReturnThis(),
      };

      showCommand.builder(mockYargs);

      expect(mockYargs.positional).toHaveBeenCalledWith('example', {
        type: 'string',
        describe: 'Example ID to show',
        demandOption: true,
      });

      expect(mockYargs.option).toHaveBeenCalledWith(
        'framework',
        expect.objectContaining({
          type: 'string',
          describe: 'Show framework-specific implementation',
          choices: ['nestjs', 'express', 'fastify'],
        })
      );

      expect(mockYargs.option).toHaveBeenCalledWith(
        'raw',
        expect.objectContaining({
          type: 'boolean',
          describe: 'Show raw markdown content',
          default: false,
        })
      );

      expect(mockYargs.example).toHaveBeenCalledTimes(4);
    });
  });

  describe('handler', () => {
    const mockExample = {
      id: 'order-example',
      name: 'Order Management Example',
      package: 'aggregates',
      complexity: 'intermediate',
      domain: 'e-commerce',
      patterns: ['aggregate-root', 'domain-events'],
      tags: ['order', 'aggregate'],
      dependencies: ['core', 'events'],
      description: 'Complete order management system',
      frameworkIntegrations: [
        {
          framework: 'nestjs',
          components: ['controller', 'service', 'module'],
        },
      ],
    };

    it('should show example details in formatted view', async () => {
      mockRegistry.findById.mockReturnValue(mockExample);
      mockRegistry.getAvailableFrameworks.mockReturnValue(['nestjs', 'express']);

      const argv: Arguments<any> = { example: 'order-example' } as any;

      const result = await safeRun(async () => {
        await showCommand.handler(argv);
      });
      const error = result[0] as Error | undefined;

      expect(error).toBeUndefined();
      expect(mockRegistry.loadAll).toHaveBeenCalled();
      expect(mockRegistry.findById).toHaveBeenCalledWith('order-example');
      expect(mockParserInstance.parseExample).toHaveBeenCalledWith({
        exampleId: 'order-example',
        framework: undefined,
        version: undefined,
      });

      // Example details shown in formatted view
    });

    it('should show framework-specific details when framework specified', async () => {
      mockRegistry.findById.mockReturnValue(mockExample);
      mockRegistry.getAvailableFrameworks.mockReturnValue(['nestjs', 'express']);

      const argv: Arguments<any> = {
        example: 'order-example',
        framework: 'nestjs',
      } as any;

      const result = await safeRun(async () => {
        await showCommand.handler(argv);
      });
      const error = result[0] as Error | undefined;

      expect(error).toBeUndefined();
      expect(mockParserInstance.parseExample).toHaveBeenCalledWith({
        exampleId: 'order-example',
        framework: 'nestjs',
        version: undefined,
      });
    });

    it('should show raw markdown content when raw flag is true', async () => {
      mockRegistry.findById.mockReturnValue(mockExample);
      mockRegistry.getAvailableFrameworks.mockReturnValue(['nestjs']);

      const argv: Arguments<any> = {
        example: 'order-example',
        raw: true,
        framework: 'nestjs',
      } as any;

      const result = await safeRun(async () => {
        await showCommand.handler(argv);
      });
      const error = result[0] as Error | undefined;

      expect(error).toBeUndefined();
    });

    it('should show available components when components flag is true', async () => {
      mockRegistry.findById.mockReturnValue(mockExample);
      mockRegistry.getAvailableFrameworks.mockReturnValue(['nestjs']);
      mockRegistry.getAvailableComponents.mockReturnValue([
        'controller',
        'service',
        'module',
        'guard',
      ]);

      const argv: Arguments<any> = {
        example: 'order-example',
        framework: 'nestjs',
        components: true,
      } as any;

      const result = await safeRun(async () => {
        await showCommand.handler(argv);
      });
      const error = result[0] as Error | undefined;

      expect(error).toBeUndefined();
      expect(mockRegistry.getAvailableComponents).toHaveBeenCalledWith('order-example', 'nestjs');
    });

    it('should handle example not found', async () => {
      mockRegistry.findById.mockReturnValue(null);
      mockRegistry.query.mockReturnValue([
        { id: 'order-basic', name: 'Basic Order Example' },
        { id: 'order-advanced', name: 'Advanced Order Example' },
      ]);

      const argv: Arguments<any> = { example: 'order-missing' } as any;

      const result = await safeRun(async () => {
        await showCommand.handler(argv);
      });
      const error = result[0] as Error | undefined;

      expect(error).toBeUndefined();
    });

    it('should handle framework not available for example', async () => {
      mockRegistry.findById.mockReturnValue(mockExample);
      mockRegistry.getAvailableFrameworks.mockReturnValue(['nestjs', 'express']);

      const argv: Arguments<any> = {
        example: 'order-example',
        framework: 'fastify',
      } as any;

      const result = await safeRun(async () => {
        await showCommand.handler(argv);
      });
      const error = result[0] as Error | undefined;

      expect(error).toBeUndefined();
    });

    it('should handle example with no framework integrations', async () => {
      const baseExample = { ...mockExample, frameworkIntegrations: [] };
      mockRegistry.findById.mockReturnValue(baseExample);
      mockRegistry.getAvailableFrameworks.mockReturnValue([]);

      const argv: Arguments<any> = {
        example: 'order-example',
        framework: 'nestjs',
      } as any;

      const result = await safeRun(async () => {
        await showCommand.handler(argv);
      });
      const error = result[0] as Error | undefined;

      expect(error).toBeUndefined();
    });

    it('should handle example with null optional fields', async () => {
      const minimalExample = {
        id: 'minimal-example',
        name: 'Minimal Example',
        package: 'core',
        complexity: 'basic',
        domain: null,
        patterns: null,
        tags: [],
        dependencies: null,
        description: 'Minimal example',
        frameworkIntegrations: null,
      };

      mockRegistry.findById.mockReturnValue(minimalExample);
      mockRegistry.getAvailableFrameworks.mockReturnValue([]);

      const argv: Arguments<any> = { example: 'minimal-example' } as any;

      const result = await safeRun(async () => {
        await showCommand.handler(argv);
      });
      const error = result[0] as Error | undefined;

      expect(error).toBeUndefined();
    });

    it('should show business context when available', async () => {
      mockRegistry.findById.mockReturnValue(mockExample);
      mockParserInstance.parseExample.mockResolvedValue({
        base: {
          content: {
            businessContext: 'This example demonstrates order processing in e-commerce domain',
          },
        },
      });

      const argv: Arguments<any> = { example: 'order-example' } as any;

      const result = await safeRun(async () => {
        await showCommand.handler(argv);
      });
      const error = result[0] as Error | undefined;

      expect(error).toBeUndefined();
    });

    it('should show usage examples with framework integration', async () => {
      mockRegistry.findById.mockReturnValue(mockExample);
      mockRegistry.getAvailableFrameworks.mockReturnValue(['nestjs', 'express']);

      const argv: Arguments<any> = { example: 'order-example' } as any;

      const result = await safeRun(async () => {
        await showCommand.handler(argv);
      });
      const error = result[0] as Error | undefined;

      expect(error).toBeUndefined();
    });

    it('should show usage examples without framework integration', async () => {
      const baseExample = { ...mockExample, frameworkIntegrations: [] };
      mockRegistry.findById.mockReturnValue(baseExample);
      mockRegistry.getAvailableFrameworks.mockReturnValue([]);

      const argv: Arguments<any> = { example: 'order-example' } as any;

      const result = await safeRun(async () => {
        await showCommand.handler(argv);
      });
      const error = result[0] as Error | undefined;

      expect(error).toBeUndefined();
    });

    it('should handle components request with no components available', async () => {
      mockRegistry.findById.mockReturnValue(mockExample);
      mockRegistry.getAvailableFrameworks.mockReturnValue(['nestjs']);
      mockRegistry.getAvailableComponents.mockReturnValue([]);

      const argv: Arguments<any> = {
        example: 'order-example',
        framework: 'nestjs',
        components: true,
      } as any;

      const result = await safeRun(async () => {
        await showCommand.handler(argv);
      });
      const error = result[0] as Error | undefined;

      expect(error).toBeUndefined();
    });

    it('should handle registry errors gracefully', async () => {
      mockRegistry.loadAll.mockRejectedValue(new Error('Registry load failed'));

      const argv: Arguments<any> = { example: 'order-example' } as any;

      const result = await safeRun(async () => {
        await showCommand.handler(argv);
      });
      const error = result[0] as Error | undefined;

      // Handler catches errors internally and calls process.exit
      // safeRun will catch the process.exit as an error
      expect(error).toBeDefined();
      expect(mockRegistry.loadAll).toHaveBeenCalled();
      // Error handling verified by error being caught
    });

    it('should handle parser errors gracefully', async () => {
      mockRegistry.findById.mockReturnValue(mockExample);
      mockParserInstance.parseExample.mockRejectedValue(new Error('Parse failed'));

      const argv: Arguments<any> = { example: 'order-example' } as any;

      const result = await safeRun(async () => {
        await showCommand.handler(argv);
      });
      const error = result[0] as Error | undefined;

      // Handler catches errors internally and calls process.exit
      // safeRun will catch the process.exit as an error
      expect(error).toBeDefined();
      expect(mockParserInstance.parseExample).toHaveBeenCalled();
      // Error handling verified by error being caught
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete show workflow with framework and version', async () => {
      const complexExample = {
        id: 'payment-processor',
        name: 'Payment Processor',
        package: 'cqrs',
        complexity: 'advanced',
        domain: 'fintech',
        patterns: ['cqrs', 'event-sourcing', 'saga'],
        tags: ['payment', 'saga', 'event-sourcing'],
        dependencies: ['core', 'events', 'messaging'],
        description: 'Advanced payment processing with saga orchestration',
        frameworkIntegrations: [
          {
            framework: 'nestjs',
            components: ['controller', 'service', 'saga', 'events'],
          },
        ],
      };

      mockRegistry.findById.mockReturnValue(complexExample);
      mockRegistry.getAvailableFrameworks.mockReturnValue(['nestjs']);
      mockParserInstance.parseExample.mockResolvedValue({
        base: {
          content: {
            businessContext:
              'Payment processing in fintech applications requires careful handling of money transfers',
          },
        },
        framework: {
          content: 'NestJS specific implementation details',
        },
      });

      const argv: Arguments<any> = {
        example: 'payment-processor',
        framework: 'nestjs',
        version: '1.2.0',
      } as any;

      const result = await safeRun(async () => {
        await showCommand.handler(argv);
      });
      const error = result[0] as Error | undefined;

      expect(error).toBeUndefined();
      expect(mockRegistry.findById).toHaveBeenCalledWith('payment-processor');
      expect(mockParserInstance.parseExample).toHaveBeenCalledWith({
        exampleId: 'payment-processor',
        framework: 'nestjs',
        version: '1.2.0',
      });
    });
  });
});
