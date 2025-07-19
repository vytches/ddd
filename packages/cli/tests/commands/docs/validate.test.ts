import { describe, it, expect, beforeEach, vi } from 'vitest';
import { safeRun } from '@vytches-ddd/utils';
import { validateCommand } from '../../../src/commands/docs/validate';
import { ExampleValidator } from '../../../src/validators/example-validator';
import { logger } from '../../../src/core/utils/logger';
import type { ArgumentsCamelCase } from 'yargs';

// Mock dependencies
vi.mock('../../../src/validators/example-validator');
vi.mock('../../../src/core/utils/logger');

describe('validate command', () => {
  let mockValidator: any;
  let mockProcessExit: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock ExampleValidator
    mockValidator = {
      validateExamples: vi.fn(),
    };
    vi.mocked(ExampleValidator).mockImplementation(() => mockValidator);

    // Mock logger
    vi.mocked(logger.success).mockImplementation(() => { return });
    vi.mocked(logger.info).mockImplementation(() => { return });
    vi.mocked(logger.warn).mockImplementation(() => { return });
    vi.mocked(logger.error).mockImplementation(() => { return });

    // Mock process.exit
    mockProcessExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
  });

  afterEach(() => {
    mockProcessExit.mockRestore();
  });

  describe('command definition', () => {
    it('should have correct command structure', () => {
      expect(validateCommand.command).toBe('validate');
      expect(validateCommand.describe).toBe('Validate example configurations and content');
      expect(validateCommand.builder).toBeDefined();
      expect(validateCommand.handler).toBeDefined();
    });

    it('should define all required options', () => {
      const builder = validateCommand.builder as any;

      expect(builder.package).toBeDefined();
      expect(builder.package.alias).toBe('p');
      expect(builder.fix).toBeDefined();
      expect(builder.verbose).toBeDefined();
      expect(builder.verbose.alias).toBe('v');
    });

    it('should have default values set correctly', () => {
      const builder = validateCommand.builder as any;
      expect(builder.fix.default).toBe(false);
      expect(builder.verbose.default).toBe(false);
    });
  });

  describe('handler execution', () => {
    it('should validate all packages successfully with no issues', async () => {
      const mockResults = {
        errors: [],
        warnings: [],
        fixed: [],
        packagesValidated: 5,
        examplesValidated: 25,
      };
      mockValidator.validateExamples.mockResolvedValue(mockResults);

      const argv = {} as ArgumentsCamelCase;

      await validateCommand.handler(argv);

      expect(ExampleValidator).toHaveBeenCalledTimes(1);
      expect(mockValidator.validateExamples).toHaveBeenCalledWith('', {
        packageName: undefined,
        autoFix: undefined,
        verbose: undefined,
      });

      expect(logger.success).toHaveBeenCalledWith('✅ All examples are valid!');
      expect(logger.info).toHaveBeenCalledWith('📊 Validation summary:');
      expect(logger.info).toHaveBeenCalledWith('   - Packages validated: 5');
      expect(logger.info).toHaveBeenCalledWith('   - Examples validated: 25');
      expect(logger.info).toHaveBeenCalledWith('   - Errors: 0');
      expect(logger.info).toHaveBeenCalledWith('   - Warnings: 0');
    });

    it('should validate specific package with options', async () => {
      const mockResults = {
        errors: [],
        warnings: [],
        fixed: [],
        packagesValidated: 1,
        examplesValidated: 10,
      };
      mockValidator.validateExamples.mockResolvedValue(mockResults);

      const argv = {
        package: 'policies',
        fix: true,
        verbose: true,
      } as unknown as ArgumentsCamelCase;

      await validateCommand.handler(argv);

      expect(mockValidator.validateExamples).toHaveBeenCalledWith('policies', {
        packageName: 'policies',
        autoFix: true,
        verbose: true,
      });

      expect(logger.info).toHaveBeenCalledWith('   - Fixes applied: 0');
    });

    it('should handle validation results with errors', async () => {
      const mockResults = {
        errors: [
          { package: 'policies', example: 'basic-example', message: 'Missing configuration file' },
          { package: 'core', example: 'advanced-example', message: 'Invalid syntax' },
        ],
        warnings: [],
        fixed: [],
        packagesValidated: 2,
        examplesValidated: 15,
      };
      mockValidator.validateExamples.mockResolvedValue(mockResults);

      const argv = {} as ArgumentsCamelCase;

      const [error] = await safeRun(async () => {
        await validateCommand.handler(argv);
      });

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toBe('process.exit called');
      expect(logger.error).toHaveBeenCalledWith('❌ Found 2 errors:');
      expect(logger.error).toHaveBeenCalledWith('   - policies/basic-example: Missing configuration file');
      expect(logger.error).toHaveBeenCalledWith('   - core/advanced-example: Invalid syntax');
      expect(logger.info).toHaveBeenCalledWith('   - Errors: 2');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle validation results with warnings only', async () => {
      const mockResults = {
        errors: [],
        warnings: [
          { package: 'events', example: 'intermediate-example', message: 'Missing description' },
          { package: 'cqrs', example: 'query-example', message: 'Outdated pattern' },
        ],
        fixed: [],
        packagesValidated: 2,
        examplesValidated: 12,
      };
      mockValidator.validateExamples.mockResolvedValue(mockResults);

      const argv = {} as ArgumentsCamelCase;

      await validateCommand.handler(argv);

      expect(logger.warn).toHaveBeenCalledWith('⚠️  Found 2 warnings:');
      expect(logger.warn).toHaveBeenCalledWith('   - events/intermediate-example: Missing description');
      expect(logger.warn).toHaveBeenCalledWith('   - cqrs/query-example: Outdated pattern');
      expect(logger.info).toHaveBeenCalledWith('   - Warnings: 2');
      expect(mockProcessExit).not.toHaveBeenCalled();
    });

    it('should handle validation results with errors, warnings, and fixes', async () => {
      const mockResults = {
        errors: [
          { package: 'policies', example: 'basic-example', message: 'Critical error' },
        ],
        warnings: [
          { package: 'events', example: 'intermediate-example', message: 'Warning message' },
        ],
        fixed: [
          { package: 'core', example: 'fixed-example', description: 'Added missing imports' },
          { package: 'cqrs', example: 'command-example', description: 'Fixed formatting' },
        ],
        packagesValidated: 3,
        examplesValidated: 20,
      };
      mockValidator.validateExamples.mockResolvedValue(mockResults);

      const argv = {
        fix: true,
      } as unknown as ArgumentsCamelCase;

      const [error] = await safeRun(async () => {
        await validateCommand.handler(argv);
      });

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toBe('process.exit called');
      expect(logger.error).toHaveBeenCalledWith('❌ Found 1 errors:');
      expect(logger.error).toHaveBeenCalledWith('   - policies/basic-example: Critical error');
      expect(logger.warn).toHaveBeenCalledWith('⚠️  Found 1 warnings:');
      expect(logger.warn).toHaveBeenCalledWith('   - events/intermediate-example: Warning message');
      expect(logger.info).toHaveBeenCalledWith('🔧 Applied 2 fixes:');
      expect(logger.info).toHaveBeenCalledWith('   - core/fixed-example: Added missing imports');
      expect(logger.info).toHaveBeenCalledWith('   - cqrs/command-example: Fixed formatting');
      expect(logger.info).toHaveBeenCalledWith('   - Fixes applied: 2');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should show fixes applied section only when fix flag is true', async () => {
      const mockResults = {
        errors: [],
        warnings: [],
        fixed: [
          { package: 'core', example: 'fixed-example', description: 'Added missing imports' },
        ],
        packagesValidated: 1,
        examplesValidated: 5,
      };
      mockValidator.validateExamples.mockResolvedValue(mockResults);

      const argv = {
        fix: true,
      } as unknown as ArgumentsCamelCase;

      await validateCommand.handler(argv);

      expect(logger.info).toHaveBeenCalledWith('🔧 Applied 1 fixes:');
      expect(logger.info).toHaveBeenCalledWith('   - core/fixed-example: Added missing imports');
    });

    it('should not show fixes section when fix flag is false', async () => {
      const mockResults = {
        errors: [],
        warnings: [],
        fixed: [
          { package: 'core', example: 'fixed-example', description: 'Added missing imports' },
        ],
        packagesValidated: 1,
        examplesValidated: 5,
      };
      mockValidator.validateExamples.mockResolvedValue(mockResults);

      const argv = {
        fix: false,
      } as unknown as ArgumentsCamelCase;

      await validateCommand.handler(argv);

      expect(logger.info).not.toHaveBeenCalledWith('🔧 Applied 1 fixes:');
      expect(logger.info).not.toHaveBeenCalledWith('   - core/fixed-example: Added missing imports');
      expect(logger.info).not.toHaveBeenCalledWith('   - Fixes applied: 1');
    });

    it('should handle undefined fixed array', async () => {
      const mockResults = {
        errors: [],
        warnings: [],
        packagesValidated: 1,
        examplesValidated: 5,
      };
      mockValidator.validateExamples.mockResolvedValue(mockResults);

      const argv = {
        fix: true,
      } as unknown as ArgumentsCamelCase;

      await validateCommand.handler(argv);

      expect(logger.info).toHaveBeenCalledWith('   - Fixes applied: 0');
    });
  });

  describe('error handling', () => {
    it('should handle validator errors gracefully', async () => {
      const validatorError = new Error('Validation process failed');
      mockValidator.validateExamples.mockRejectedValue(validatorError);

      const argv = {
        package: 'policies',
      } as unknown as ArgumentsCamelCase;

      const [error] = await safeRun(async () => {
        await validateCommand.handler(argv);
      });

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toBe('process.exit called');
      expect(logger.error).toHaveBeenCalledWith('❌ Validation failed: Validation process failed');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle non-Error exceptions', async () => {
      const stringError = 'String error message';
      mockValidator.validateExamples.mockRejectedValue(stringError);

      const argv = {} as unknown as ArgumentsCamelCase;

      const [error] = await safeRun(async () => {
        await validateCommand.handler(argv);
      });

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toBe('process.exit called');
      expect(logger.error).toHaveBeenCalledWith('❌ Validation failed: String error message');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should handle validator initialization errors', async () => {
      vi.mocked(ExampleValidator).mockImplementation(() => {
        throw new Error('Validator initialization failed');
      });

      const argv = {} as unknown as ArgumentsCamelCase;

      const [error] = await safeRun(async () => {
        await validateCommand.handler(argv);
      });

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toBe('process.exit called');
      expect(logger.error).toHaveBeenCalledWith('❌ Validation failed: Validator initialization failed');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('exit behavior', () => {
    it('should exit with code 1 when there are errors', async () => {
      const mockResults = {
        errors: [
          { package: 'policies', example: 'basic-example', message: 'Error message' },
        ],
        warnings: [],
        fixed: [],
        packagesValidated: 1,
        examplesValidated: 5,
      };
      mockValidator.validateExamples.mockResolvedValue(mockResults);

      const argv = {} as unknown as ArgumentsCamelCase;

      const [error] = await safeRun(async () => {
        await validateCommand.handler(argv);
      });

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toBe('process.exit called');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('should not exit when there are only warnings', async () => {
      const mockResults = {
        errors: [],
        warnings: [
          { package: 'events', example: 'intermediate-example', message: 'Warning message' },
        ],
        fixed: [],
        packagesValidated: 1,
        examplesValidated: 5,
      };
      mockValidator.validateExamples.mockResolvedValue(mockResults);

      const argv = {} as unknown as ArgumentsCamelCase;

      await validateCommand.handler(argv);

      expect(mockProcessExit).not.toHaveBeenCalled();
    });

    it('should not exit when validation is successful', async () => {
      const mockResults = {
        errors: [],
        warnings: [],
        fixed: [],
        packagesValidated: 3,
        examplesValidated: 15,
      };
      mockValidator.validateExamples.mockResolvedValue(mockResults);

      const argv = {} as ArgumentsCamelCase;

      await validateCommand.handler(argv);

      expect(mockProcessExit).not.toHaveBeenCalled();
    });
  });

  describe('summary display', () => {
    it('should always display validation summary', async () => {
      const mockResults = {
        errors: [],
        warnings: [],
        fixed: [],
        packagesValidated: 3,
        examplesValidated: 15,
      };
      mockValidator.validateExamples.mockResolvedValue(mockResults);

      const argv = {} as unknown as ArgumentsCamelCase;

      await validateCommand.handler(argv);

      expect(logger.info).toHaveBeenCalledWith('📊 Validation summary:');
      expect(logger.info).toHaveBeenCalledWith('   - Packages validated: 3');
      expect(logger.info).toHaveBeenCalledWith('   - Examples validated: 15');
      expect(logger.info).toHaveBeenCalledWith('   - Errors: 0');
      expect(logger.info).toHaveBeenCalledWith('   - Warnings: 0');
    });

    it('should display correct counts in summary', async () => {
      const mockResults = {
        errors: [{ package: 'p1', example: 'e1', message: 'error' }],
        warnings: [
          { package: 'p2', example: 'e2', message: 'warning1' },
          { package: 'p3', example: 'e3', message: 'warning2' },
        ],
        fixed: [],
        packagesValidated: 10,
        examplesValidated: 50,
      };
      mockValidator.validateExamples.mockResolvedValue(mockResults);

      const argv = {} as unknown as ArgumentsCamelCase;

      const [error] = await safeRun(async () => {
        await validateCommand.handler(argv);
      });

      expect(logger.info).toHaveBeenCalledWith('   - Packages validated: 10');
      expect(logger.info).toHaveBeenCalledWith('   - Examples validated: 50');
      expect(logger.info).toHaveBeenCalledWith('   - Errors: 1');
      expect(logger.info).toHaveBeenCalledWith('   - Warnings: 2');
    });
  });
});
