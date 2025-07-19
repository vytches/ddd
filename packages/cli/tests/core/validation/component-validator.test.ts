import { describe, it, expect, beforeEach, vi } from 'vitest';
import { safeRun } from '@vytches-ddd/utils';
import { ComponentValidator } from '../../../src/core/validation/component-validator';
import { FileSystem } from '../../../src/core/utils/file-system';
import type { ComponentType, ValidationContext } from '../../../src/types';

// Mock FileSystem
vi.mock('../../../src/core/utils/file-system', () => ({
  FileSystem: {
    exists: vi.fn(),
    joinPath: vi.fn(),
    readFile: vi.fn(),
    listDirectory: vi.fn(),
    isDirectory: vi.fn(),
    getBaseName: vi.fn(),
    getExtension: vi.fn(),
  },
}));

describe('ComponentValidator', () => {
  let validator: ComponentValidator;
  let mockContext: ValidationContext;

  beforeEach(() => {
    vi.clearAllMocks();
    validator = ComponentValidator.create();
    mockContext = {
      projectPath: '/test/project',
      outputPath: '/test/project/src',
      framework: 'standalone',
    };

    // Setup default mocks
    vi.mocked(FileSystem.joinPath).mockImplementation((...parts) => parts.join('/'));
    vi.mocked(FileSystem.exists).mockReturnValue(false);
    vi.mocked(FileSystem.readFile).mockResolvedValue('{}');
    vi.mocked(FileSystem.listDirectory).mockResolvedValue([]);
    vi.mocked(FileSystem.isDirectory).mockReturnValue(false);
    vi.mocked(FileSystem.getBaseName).mockImplementation((path) =>
      path.split('/').pop()?.split('.')[0] || ''
    );
    vi.mocked(FileSystem.getExtension).mockImplementation((path) =>
      path.includes('.') ? `.${  path.split('.').pop()}` : ''
    );
  });

  describe('factory method', () => {
    it('should create validator instance', () => {
      const validator = ComponentValidator.create();
      expect(validator).toBeInstanceOf(ComponentValidator);
    });
  });

  describe('constructor', () => {
    it('should create validator with validation rules', () => {
      const validator = new ComponentValidator();
      expect(validator).toBeInstanceOf(ComponentValidator);
    });
  });

  describe('validateComponent method', () => {
    describe('basic validation', () => {
      it('should validate valid aggregate component', async () => {
        const result = await validator.validateComponent('aggregate', 'OrderAggregate', mockContext);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.metadata?.componentType).toBe('aggregate');
        expect(result.metadata?.componentName).toBe('OrderAggregate');
        expect(typeof result.metadata?.confidence).toBe('number');
      });

      it('should validate valid entity component', async () => {
        const result = await validator.validateComponent('entity', 'UserEntity', mockContext);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.metadata?.componentType).toBe('entity');
      });

      it('should validate valid value object component', async () => {
        const result = await validator.validateComponent('value-object', 'Email', mockContext);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.metadata?.componentType).toBe('value-object');
      });

      it('should validate valid event component', async () => {
        const result = await validator.validateComponent('event', 'OrderCreatedEvent', mockContext);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.metadata?.componentType).toBe('event');
      });

      it('should validate valid command component', async () => {
        const result = await validator.validateComponent('command', 'CreateOrderCommand', mockContext);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.metadata?.componentType).toBe('command');
      });

      it('should validate valid query component', async () => {
        const result = await validator.validateComponent('query', 'GetOrderQuery', mockContext);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.metadata?.componentType).toBe('query');
      });
    });

    describe('naming validation', () => {
      it('should reject empty component name', async () => {
        const result = await validator.validateComponent('aggregate', '', mockContext);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Component name cannot be empty');
      });

      it('should reject whitespace-only component name', async () => {
        const result = await validator.validateComponent('aggregate', '   ', mockContext);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Component name cannot be empty');
      });

      it('should reject very short component name', async () => {
        const result = await validator.validateComponent('aggregate', 'A', mockContext);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Component name is too short (minimum 2 characters)');
      });

      it('should warn about non-PascalCase names', async () => {
        const result = await validator.validateComponent('aggregate', 'orderAggregate', mockContext);

        expect(result.isValid).toBe(true);
        expect(result.warnings).toContain('Component name should be in PascalCase (e.g., OrderAggregate)');
      });

      it('should warn about very long component names', async () => {
        const longName = 'A'.repeat(51);
        const result = await validator.validateComponent('aggregate', longName, mockContext);

        expect(result.isValid).toBe(true);
        expect(result.warnings).toContain('Component name is quite long, consider shortening');
      });

      it('should reject reserved words', async () => {
        const result = await validator.validateComponent('aggregate', 'Class', mockContext);

        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('"Class" is a reserved word and cannot be used as component name');
      });
    });

    describe('type-specific validation', () => {
      it('should suggest aggregate naming conventions', async () => {
        const result = await validator.validateComponent('aggregate', 'Order', mockContext);

        expect(result.isValid).toBe(true);
        expect(result.suggestions).toContain('Consider adding "Aggregate" suffix for clarity');
      });

      it('should validate aggregate with Aggregate suffix', async () => {
        const result = await validator.validateComponent('aggregate', 'OrderAggregate', mockContext);

        expect(result.isValid).toBe(true);
        expect(result.suggestions).not.toContain('Consider adding "Aggregate" suffix for clarity');
      });

      it('should validate aggregate with Root suffix', async () => {
        const result = await validator.validateComponent('aggregate', 'OrderRoot', mockContext);

        expect(result.isValid).toBe(true);
        expect(result.suggestions).not.toContain('Consider adding "Aggregate" suffix for clarity');
      });

      it('should warn about event naming without Event suffix', async () => {
        const result = await validator.validateComponent('event', 'OrderCreated', mockContext);

        expect(result.isValid).toBe(true);
        expect(result.warnings).toContain('Event should end with "Event" suffix');
      });

      it('should suggest past tense for events', async () => {
        const result = await validator.validateComponent('event', 'OrderCreateEvent', mockContext);

        expect(result.isValid).toBe(true);
        expect(result.suggestions).toContain('Use past tense for event names (e.g., OrderCreated, PaymentProcessed)');
      });

      it('should suggest command naming conventions', async () => {
        const result = await validator.validateComponent('command', 'CreateOrder', mockContext);

        expect(result.isValid).toBe(true);
        expect(result.suggestions).toContain('Command should end with "Command" suffix');
      });

      it('should suggest query naming conventions', async () => {
        const result = await validator.validateComponent('query', 'GetOrder', mockContext);

        expect(result.isValid).toBe(true);
        expect(result.suggestions).toContain('Query should end with "Query" suffix');
      });

      it('should discourage ValueObject suffix', async () => {
        const result = await validator.validateComponent('value-object', 'EmailValueObject', mockContext);

        expect(result.isValid).toBe(true);
        expect(result.suggestions).toContain('ValueObject suffix is redundant, use descriptive name instead');
      });
    });

    describe('project context analysis', () => {
      it('should detect NestJS framework', async () => {
        vi.mocked(FileSystem.exists).mockReturnValue(true);
        vi.mocked(FileSystem.readFile).mockResolvedValue(JSON.stringify({
          dependencies: { '@nestjs/core': '^10.0.0' }
        }));

        const result = await validator.validateComponent('aggregate', 'OrderAggregate', mockContext);

        expect(result.metadata?.projectContext?.frameworks).toContain('nestjs');
      });

      it('should detect TypeORM', async () => {
        vi.mocked(FileSystem.exists).mockReturnValue(true);
        vi.mocked(FileSystem.readFile).mockResolvedValue(JSON.stringify({
          dependencies: { typeorm: '^0.3.0' }
        }));

        const result = await validator.validateComponent('aggregate', 'OrderAggregate', mockContext);

        expect(result.metadata?.projectContext?.hasTypeORM).toBe(true);
      });

      it('should detect existing aggregates', async () => {
        vi.mocked(FileSystem.exists).mockReturnValue(true);
        vi.mocked(FileSystem.readFile).mockResolvedValue('{}');
        vi.mocked(FileSystem.listDirectory).mockResolvedValue(['user-aggregate.ts']);
        vi.mocked(FileSystem.isDirectory).mockReturnValue(false);

        const result = await validator.validateComponent('entity', 'UserEntity', mockContext);

        expect(result.metadata?.projectContext?.hasAggregates).toBe(true);
      });

      it('should handle package.json read errors gracefully', async () => {
        vi.mocked(FileSystem.exists).mockReturnValue(true);
        vi.mocked(FileSystem.readFile).mockRejectedValue(new Error('Permission denied'));

        const [error] = await safeRun(async () =>
          await validator.validateComponent('aggregate', 'OrderAggregate', mockContext)
        );

        expect(error).toBeUndefined();
      });
    });

    describe('conflict detection', () => {
      it('should detect exact name conflicts', async () => {
        vi.mocked(FileSystem.exists).mockReturnValue(true);
        vi.mocked(FileSystem.listDirectory).mockResolvedValue(['order-aggregate.ts']);
        vi.mocked(FileSystem.isDirectory).mockReturnValue(false);
        vi.mocked(FileSystem.getBaseName).mockReturnValue('order-aggregate');
        vi.mocked(FileSystem.getExtension).mockReturnValue('.ts');

        const result = await validator.validateComponent('aggregate', 'OrderAggregate', mockContext);

        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.includes('already exists'))).toBe(true);
      });

      it('should warn about similar component names', async () => {
        vi.mocked(FileSystem.exists).mockReturnValue(true);
        vi.mocked(FileSystem.listDirectory).mockResolvedValue(['user-aggregate.ts']);
        vi.mocked(FileSystem.isDirectory).mockReturnValue(false);
        vi.mocked(FileSystem.getBaseName).mockReturnValue('user-aggregate');
        vi.mocked(FileSystem.getExtension).mockReturnValue('.ts');

        const result = await validator.validateComponent('entity', 'User', mockContext);

        expect(result.isValid).toBe(true);
        expect(result.warnings.some(w => w.includes('Similar components found'))).toBe(true);
        expect(result.suggestions.some(s => s.includes('more specific name'))).toBe(true);
      });

      it('should handle conflict detection errors gracefully', async () => {
        vi.mocked(FileSystem.exists).mockReturnValue(false); // src directory doesn't exist

        const result = await validator.validateComponent('aggregate', 'OrderAggregate', mockContext);

        expect(result.isValid).toBe(true);
        // Should not warn when src directory doesn't exist - this is expected behavior
        expect(result.errors).toHaveLength(0);
      });
    });

    describe('dependency analysis', () => {
      it('should suggest repository for aggregate', async () => {
        const result = await validator.validateComponent('aggregate', 'OrderAggregate', mockContext);

        expect(result.suggestions.some(s => s.includes('IOrderAggregateRepository'))).toBe(true);
      });

      it('should suggest events for aggregate', async () => {
        const result = await validator.validateComponent('aggregate', 'OrderAggregate', mockContext);

        expect(result.suggestions.some(s => s.includes('OrderAggregateCreated'))).toBe(true);
      });

      it('should suggest commands for aggregate', async () => {
        const result = await validator.validateComponent('aggregate', 'OrderAggregate', mockContext);

        expect(result.suggestions.some(s => s.includes('CreateOrderAggregateCommand'))).toBe(true);
      });

      it('should suggest handler for command', async () => {
        const result = await validator.validateComponent('command', 'CreateOrderCommand', mockContext);

        expect(result.suggestions.some(s => s.includes('CreateOrderCommandHandler'))).toBe(true);
      });

      it('should suggest handler for query', async () => {
        const result = await validator.validateComponent('query', 'GetOrderQuery', mockContext);

        expect(result.suggestions.some(s => s.includes('GetOrderQueryHandler'))).toBe(true);
      });

      it('should suggest event bus for event', async () => {
        const result = await validator.validateComponent('event', 'OrderCreatedEvent', mockContext);

        expect(result.suggestions.some(s => s.includes('event bus'))).toBe(true);
      });

      it('should suggest EntityId for ID value objects', async () => {
        const result = await validator.validateComponent('value-object', 'OrderId', mockContext);

        expect(result.suggestions.some(s => s.includes('EntityId base class'))).toBe(true);
      });
    });

    describe('confidence calculation', () => {
      it('should have high confidence for valid components', async () => {
        const result = await validator.validateComponent('aggregate', 'OrderAggregate', mockContext);

        expect(result.metadata?.confidence).toBeGreaterThan(0.5);
      });

      it('should have lower confidence with errors', async () => {
        const result = await validator.validateComponent('aggregate', '', mockContext);

        expect(result.metadata?.confidence).toBeLessThan(0.5);
      });

      it('should have moderate confidence with warnings', async () => {
        const result = await validator.validateComponent('aggregate', 'orderAggregate', mockContext);

        expect(result.metadata?.confidence).toBeGreaterThan(0.3);
        expect(result.metadata?.confidence).toBeLessThan(0.9);
      });
    });
  });

  describe('displayValidationResults method', () => {
    let consoleLogSpy: any;

    beforeEach(() => {
      consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {
        return
      });
    });

    it('should display successful validation', () => {
      const result = {
        isValid: true,
        errors: [],
        warnings: [],
        suggestions: [],
        metadata: { confidence: 0.9 }
      };

      validator.displayValidationResults(result);

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Validation passed'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('90%'));
    });

    it('should display failed validation with errors', () => {
      const result = {
        isValid: false,
        errors: ['Component name cannot be empty'],
        warnings: ['Some warning'],
        suggestions: ['Some suggestion'],
        metadata: { confidence: 0.3 }
      };

      validator.displayValidationResults(result);

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Validation failed'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Errors:'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Warnings:'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Suggestions:'));
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('30%'));
    });

    it('should handle validation without confidence', () => {
      const result = {
        isValid: true,
        errors: [],
        warnings: [],
        suggestions: []
      };

      const [error] = safeRun(() => validator.displayValidationResults(result));

      expect(error).toBeUndefined();
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle unknown component types gracefully', async () => {
      const result = await validator.validateComponent('unknown' as ComponentType, 'TestComponent', mockContext);

      expect(result.isValid).toBe(true);
      expect(result.metadata?.componentType).toBe('unknown');
    });

    it('should handle file system errors during directory scanning', async () => {
      vi.mocked(FileSystem.exists).mockReturnValue(true);
      vi.mocked(FileSystem.listDirectory).mockRejectedValue(new Error('Access denied'));

      const result = await validator.validateComponent('aggregate', 'OrderAggregate', mockContext);

      expect(result.isValid).toBe(true);
      // Should continue with default project context
    });

    it('should handle malformed package.json', async () => {
      vi.mocked(FileSystem.exists).mockReturnValue(true);
      vi.mocked(FileSystem.readFile).mockResolvedValue('invalid json');

      const [error] = await safeRun(async () =>
        await validator.validateComponent('aggregate', 'OrderAggregate', mockContext)
      );

      expect(error).toBeUndefined();
      // Should continue with default project context
    });

    it('should handle recursive directory scanning errors', async () => {
      vi.mocked(FileSystem.exists).mockReturnValue(true);
      vi.mocked(FileSystem.readFile).mockResolvedValue('{}');
      vi.mocked(FileSystem.listDirectory)
        .mockResolvedValueOnce(['subdir'])
        .mockRejectedValueOnce(new Error('Permission denied'));
      vi.mocked(FileSystem.isDirectory).mockReturnValue(true);

      const result = await validator.validateComponent('aggregate', 'OrderAggregate', mockContext);

      expect(result.isValid).toBe(true);
      // Should handle subdirectory scan errors gracefully
    });
  });
});
