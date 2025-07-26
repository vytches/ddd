import { describe, it, expect, beforeEach, vi } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import { Validation } from '../../../src/core/utils/validation';
import { ValidationError } from '../../../src/types';

describe('Validation', () => {
  describe('required method', () => {
    it('should pass for non-empty string', () => {
      const [error] = safeRun(() => Validation.required('test'));
      expect(error).toBeUndefined();
    });

    it('should throw ValidationError for empty string', () => {
      const [error] = safeRun(() => Validation.required(''));
      expect(error).toBeInstanceOf(ValidationError);
      expect(error?.message).toBe('Field is required');
    });

    it('should throw ValidationError for whitespace-only string', () => {
      const [error] = safeRun(() => Validation.required('   '));
      expect(error).toBeInstanceOf(ValidationError);
      expect(error?.message).toBe('Field is required');
    });

    it('should use custom field name in error message', () => {
      const [error] = safeRun(() => Validation.required('', 'Username'));
      expect(error).toBeInstanceOf(ValidationError);
      expect(error?.message).toBe('Username is required');
    });
  });

  describe('stringLength method', () => {
    it('should pass for string within length bounds', () => {
      const [error] = safeRun(() => Validation.stringLength('test', 2, 10));
      expect(error).toBeUndefined();
    });

    it('should throw ValidationError for string too short', () => {
      const [error] = safeRun(() => Validation.stringLength('a', 2, 10));
      expect(error).toBeInstanceOf(ValidationError);
      expect(error?.message).toBe('Field must be at least 2 characters long');
    });

    it('should throw ValidationError for string too long', () => {
      const [error] = safeRun(() => Validation.stringLength('verylongstring', 2, 10));
      expect(error).toBeInstanceOf(ValidationError);
      expect(error?.message).toBe('Field must not exceed 10 characters');
    });

    it('should handle only min length constraint', () => {
      const [error] = safeRun(() => Validation.stringLength('test', 2));
      expect(error).toBeUndefined();
    });

    it('should handle only max length constraint', () => {
      const [error] = safeRun(() => Validation.stringLength('test', undefined, 10));
      expect(error).toBeUndefined();
    });

    it('should use custom field name in error message', () => {
      const [error] = safeRun(() => Validation.stringLength('a', 2, 10, 'Username'));
      expect(error).toBeInstanceOf(ValidationError);
      expect(error?.message).toBe('Username must be at least 2 characters long');
    });
  });

  describe('pattern method', () => {
    it('should pass for string matching pattern', () => {
      const [error] = safeRun(() => Validation.pattern('test123', /^[a-z]+\d+$/));
      expect(error).toBeUndefined();
    });

    it('should throw ValidationError for string not matching pattern', () => {
      const [error] = safeRun(() => Validation.pattern('TEST', /^[a-z]+$/));
      expect(error).toBeInstanceOf(ValidationError);
      expect(error?.message).toBe('Field has invalid format');
    });

    it('should use custom error message', () => {
      const [error] = safeRun(() => Validation.pattern('TEST', /^[a-z]+$/, 'Must be lowercase'));
      expect(error).toBeInstanceOf(ValidationError);
      expect(error?.message).toBe('Must be lowercase');
    });

    it('should use custom field name in default message', () => {
      const [error] = safeRun(() => Validation.pattern('TEST', /^[a-z]+$/, undefined, 'Username'));
      expect(error).toBeInstanceOf(ValidationError);
      expect(error?.message).toBe('Username has invalid format');
    });
  });

  describe('componentName method', () => {
    it('should pass for valid PascalCase component name', () => {
      const [error] = safeRun(() => Validation.componentName('TestComponent'));
      expect(error).toBeUndefined();
    });

    it('should throw ValidationError for empty name', () => {
      const [error] = safeRun(() => Validation.componentName(''));
      expect(error).toBeInstanceOf(ValidationError);
      expect(error?.message).toBe('Component name is required');
    });

    it('should throw ValidationError for name starting with lowercase', () => {
      const [error] = safeRun(() => Validation.componentName('testComponent'));
      expect(error).toBeInstanceOf(ValidationError);
      expect(error?.message).toBe(
        'Component name must start with uppercase letter and contain only letters and numbers (PascalCase recommended)'
      );
    });

    it('should throw ValidationError for name with special characters', () => {
      const [error] = safeRun(() => Validation.componentName('Test-Component'));
      expect(error).toBeInstanceOf(ValidationError);
      expect(error?.message).toBe(
        'Component name must start with uppercase letter and contain only letters and numbers (PascalCase recommended)'
      );
    });

    it('should throw ValidationError for name too short', () => {
      const [error] = safeRun(() => Validation.componentName('A'));
      expect(error).toBeInstanceOf(ValidationError);
      expect(error?.message).toBe('Component name must be at least 2 characters long');
    });

    it('should throw ValidationError for name too long', () => {
      const longName = 'A'.repeat(51);
      const [error] = safeRun(() => Validation.componentName(longName));
      expect(error).toBeInstanceOf(ValidationError);
      expect(error?.message).toBe('Component name must not exceed 50 characters');
    });

    it('should throw ValidationError for reserved word', () => {
      const [error] = safeRun(() => Validation.componentName('Class'));
      expect(error).toBeInstanceOf(ValidationError);
      expect(error?.message).toBe('Component name cannot be a reserved word: Class');
    });

    it('should handle reserved word case-insensitively', () => {
      const [error] = safeRun(() => Validation.componentName('FUNCTION'));
      expect(error).toBeInstanceOf(ValidationError);
      expect(error?.message).toBe('Component name cannot be a reserved word: FUNCTION');
    });
  });

  describe('filePath method', () => {
    it('should pass for valid file path', () => {
      const [error] = safeRun(() => Validation.filePath('/path/to/file.txt'));
      expect(error).toBeUndefined();
    });

    it('should throw ValidationError for empty path', () => {
      const [error] = safeRun(() => Validation.filePath(''));
      expect(error).toBeInstanceOf(ValidationError);
      expect(error?.message).toBe('File path is required');
    });

    it('should throw ValidationError for path with invalid characters', () => {
      const [error] = safeRun(() => Validation.filePath('/path/to/file<>.txt'));
      expect(error).toBeInstanceOf(ValidationError);
      expect(error?.message).toBe('File path contains invalid characters');
    });

    it('should throw ValidationError for path with traversal', () => {
      const [error] = safeRun(() => Validation.filePath('/path/../other/file.txt'));
      expect(error).toBeInstanceOf(ValidationError);
      expect(error?.message).toBe('File path cannot contain relative path traversal (..)');
    });

    it('should reject all invalid characters', () => {
      const invalidChars = ['<', '>', ':', '"', '|', '?', '*'];
      invalidChars.forEach(char => {
        const [error] = safeRun(() => Validation.filePath(`/path/file${char}.txt`));
        expect(error).toBeInstanceOf(ValidationError);
        expect(error?.message).toBe('File path contains invalid characters');
      });
    });
  });

  describe('directoryPath method', () => {
    it('should pass for valid directory path', () => {
      const [error] = safeRun(() => Validation.directoryPath('/path/to/directory'));
      expect(error).toBeUndefined();
    });

    it('should throw ValidationError for invalid directory path', () => {
      const [error] = safeRun(() => Validation.directoryPath('/path/to/dir<>'));
      expect(error).toBeInstanceOf(ValidationError);
      expect(error?.message).toBe('File path contains invalid characters');
    });
  });

  describe('email method', () => {
    it('should pass for valid email', () => {
      const [error] = safeRun(() => Validation.email('test@example.com'));
      expect(error).toBeUndefined();
    });

    it('should throw ValidationError for empty email', () => {
      const [error] = safeRun(() => Validation.email(''));
      expect(error).toBeInstanceOf(ValidationError);
      expect(error?.message).toBe('Email is required');
    });

    it('should throw ValidationError for invalid email format', () => {
      const [error] = safeRun(() => Validation.email('invalid-email'));
      expect(error).toBeInstanceOf(ValidationError);
      expect(error?.message).toBe('Email must be in valid format');
    });

    it('should handle various valid email formats', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org',
        'user123@test-domain.com',
      ];

      validEmails.forEach(email => {
        const [error] = safeRun(() => Validation.email(email));
        expect(error).toBeUndefined();
      });
    });
  });

  describe('url method', () => {
    it('should pass for valid URL', () => {
      const [error] = safeRun(() => Validation.url('https://example.com'));
      expect(error).toBeUndefined();
    });

    it('should throw ValidationError for empty URL', () => {
      const [error] = safeRun(() => Validation.url(''));
      expect(error).toBeInstanceOf(ValidationError);
      expect(error?.message).toBe('URL is required');
    });

    it('should throw ValidationError for invalid URL format', () => {
      const [error] = safeRun(() => Validation.url('not-a-url'));
      expect(error).toBeInstanceOf(ValidationError);
      expect(error?.message).toBe('URL must be in valid format');
    });

    it('should handle various valid URL formats', () => {
      const validUrls = [
        'https://example.com',
        'http://localhost:3000',
        'ftp://files.example.com',
        'https://sub.domain.com/path?query=value',
      ];

      validUrls.forEach(url => {
        const [error] = safeRun(() => Validation.url(url));
        expect(error).toBeUndefined();
      });
    });
  });

  describe('oneOf method', () => {
    it('should pass for value in allowed choices', () => {
      const [error] = safeRun(() => Validation.oneOf('option1', ['option1', 'option2', 'option3']));
      expect(error).toBeUndefined();
    });

    it('should throw ValidationError for value not in choices', () => {
      const [error] = safeRun(() => Validation.oneOf('option4', ['option1', 'option2', 'option3']));
      expect(error).toBeInstanceOf(ValidationError);
      expect(error?.message).toBe('Field must be one of: option1, option2, option3');
    });

    it('should use custom field name in error message', () => {
      const [error] = safeRun(() => Validation.oneOf('invalid', ['valid'], 'Framework'));
      expect(error).toBeInstanceOf(ValidationError);
      expect(error?.message).toBe('Framework must be one of: valid');
    });

    it('should handle different types', () => {
      const [error] = safeRun(() => Validation.oneOf(42, [1, 2, 42, 100]));
      expect(error).toBeUndefined();
    });
  });

  describe('packageName method', () => {
    it('should pass for valid package name', () => {
      const [error] = safeRun(() => Validation.packageName('my-package'));
      expect(error).toBeUndefined();
    });

    it('should pass for scoped package name', () => {
      const [error] = safeRun(() => Validation.packageName('@scope/my-package'));
      expect(error).toBeUndefined();
    });

    it('should throw ValidationError for empty package name', () => {
      const [error] = safeRun(() => Validation.packageName(''));
      expect(error).toBeInstanceOf(ValidationError);
      expect(error?.message).toBe('Package name is required');
    });

    it('should throw ValidationError for invalid package name format', () => {
      const [error] = safeRun(() => Validation.packageName('Invalid-Package'));
      expect(error).toBeInstanceOf(ValidationError);
      expect(error?.message).toBe(
        'Package name must be valid npm package name (lowercase, may contain hyphens, dots, underscores)'
      );
    });

    it('should throw ValidationError for package name too long', () => {
      const longName = 'a'.repeat(215);
      const [error] = safeRun(() => Validation.packageName(longName));
      expect(error).toBeInstanceOf(ValidationError);
      expect(error?.message).toBe('Package name must not exceed 214 characters');
    });

    it('should throw ValidationError for reserved package name', () => {
      const [error] = safeRun(() => Validation.packageName('node_modules'));
      expect(error).toBeInstanceOf(ValidationError);
      expect(error?.message).toBe('Package name cannot be a reserved name: node_modules');
    });
  });

  describe('version method', () => {
    it('should pass for valid semantic version', () => {
      const [error] = safeRun(() => Validation.version('1.2.3'));
      expect(error).toBeUndefined();
    });

    it('should pass for version with pre-release', () => {
      const [error] = safeRun(() => Validation.version('1.2.3-alpha.1'));
      expect(error).toBeUndefined();
    });

    it('should pass for version with build metadata', () => {
      const [error] = safeRun(() => Validation.version('1.2.3+build.123'));
      expect(error).toBeUndefined();
    });

    it('should throw ValidationError for empty version', () => {
      const [error] = safeRun(() => Validation.version(''));
      expect(error).toBeInstanceOf(ValidationError);
      expect(error?.message).toBe('Version is required');
    });

    it('should throw ValidationError for invalid version format', () => {
      const [error] = safeRun(() => Validation.version('1.2'));
      expect(error).toBeInstanceOf(ValidationError);
      expect(error?.message).toBe('Version must follow semantic versioning (e.g., 1.0.0)');
    });
  });

  describe('port method', () => {
    let consoleWarnSpy: any;

    beforeEach(() => {
      consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
        return;
      });
    });

    it('should pass for valid port number', () => {
      const [error] = safeRun(() => Validation.port(3000));
      expect(error).toBeUndefined();
    });

    it('should pass for valid port string', () => {
      const [error] = safeRun(() => Validation.port('8080'));
      expect(error).toBeUndefined();
    });

    it('should throw ValidationError for non-numeric string', () => {
      const [error] = safeRun(() => Validation.port('not-a-number'));
      expect(error).toBeInstanceOf(ValidationError);
      expect(error?.message).toBe('Port must be a number');
    });

    it('should throw ValidationError for port too low', () => {
      const [error] = safeRun(() => Validation.port(0));
      expect(error).toBeInstanceOf(ValidationError);
      expect(error?.message).toBe('Port must be between 1 and 65535');
    });

    it('should throw ValidationError for port too high', () => {
      const [error] = safeRun(() => Validation.port(65536));
      expect(error).toBeInstanceOf(ValidationError);
      expect(error?.message).toBe('Port must be between 1 and 65535');
    });

    it('should warn for commonly reserved ports', () => {
      const [error] = safeRun(() => Validation.port(80));
      expect(error).toBeUndefined();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Warning: Port 80 is commonly reserved for system services'
      );
    });

    it('should not warn for non-reserved ports', () => {
      const [error] = safeRun(() => Validation.port(3000));
      expect(error).toBeUndefined();
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe('json method', () => {
    it('should pass for valid JSON string', () => {
      const [error] = safeRun(() => Validation.json('{"key": "value"}'));
      expect(error).toBeUndefined();
    });

    it('should throw ValidationError for empty JSON string', () => {
      const [error] = safeRun(() => Validation.json(''));
      expect(error).toBeInstanceOf(ValidationError);
      expect(error?.message).toBe('JSON is required');
    });

    it('should throw ValidationError for invalid JSON format', () => {
      const [error] = safeRun(() => Validation.json('invalid json'));
      expect(error).toBeInstanceOf(ValidationError);
      expect(error?.message).toBe('Must be valid JSON format');
    });

    it('should handle various valid JSON formats', () => {
      const validJsonStrings = ['{"key": "value"}', '[1, 2, 3]', 'null', 'true', '"string"', '123'];

      validJsonStrings.forEach(jsonString => {
        const [error] = safeRun(() => Validation.json(jsonString));
        expect(error).toBeUndefined();
      });
    });
  });

  describe('requiredFields method', () => {
    it('should pass when all required fields are present', () => {
      const obj = { name: 'test', age: 25, email: 'test@example.com' };
      const [error] = safeRun(() => Validation.requiredFields(obj, ['name', 'age']));
      expect(error).toBeUndefined();
    });

    it('should throw ValidationError for missing fields', () => {
      const obj = { name: 'test' };
      // @ts-expect-error expected
      const [error] = safeRun(() => Validation.requiredFields(obj, ['name', 'age', 'email']));
      expect(error).toBeInstanceOf(ValidationError);
      expect(error?.message).toBe('Missing required fields: age, email');
    });

    it('should treat empty string as missing', () => {
      const obj = { name: '', age: 25 };
      const [error] = safeRun(() => Validation.requiredFields(obj, ['name', 'age']));
      expect(error).toBeInstanceOf(ValidationError);
      expect(error?.message).toBe('Missing required fields: name');
    });

    it('should treat null as missing', () => {
      const obj = { name: null, age: 25 };
      const [error] = safeRun(() => Validation.requiredFields(obj, ['name', 'age']));
      expect(error).toBeInstanceOf(ValidationError);
      expect(error?.message).toBe('Missing required fields: name');
    });

    it('should treat undefined as missing', () => {
      const obj = { name: undefined, age: 25 };
      const [error] = safeRun(() => Validation.requiredFields(obj, ['name', 'age']));
      expect(error).toBeInstanceOf(ValidationError);
      expect(error?.message).toBe('Missing required fields: name');
    });
  });

  describe('combine method', () => {
    it('should pass when all validators pass', () => {
      const value = 'test@example.com';
      const validators = [
        (val: string) => Validation.required(val),
        (val: string) => Validation.email(val),
      ];

      const [error] = safeRun(() => Validation.combine(value, validators));
      expect(error).toBeUndefined();
    });

    it('should throw ValidationError when any validator fails', () => {
      const value = '';
      const validators = [
        (val: string) => Validation.required(val),
        (val: string) => Validation.email(val),
      ];

      const [error] = safeRun(() => Validation.combine(value, validators));
      expect(error).toBeInstanceOf(ValidationError);
      expect(error?.message).toBe('Field is required');
    });

    it('should stop at first validation error', () => {
      const value = '';
      const secondValidator = vi.fn();
      const validators = [(val: string) => Validation.required(val), secondValidator];

      const [error] = safeRun(() => Validation.combine(value, validators));
      expect(error).toBeInstanceOf(ValidationError);
      expect(secondValidator).not.toHaveBeenCalled();
    });
  });

  describe('async method', () => {
    it('should pass for successful async validation', async () => {
      const asyncValidator = async (value: string) => {
        if (value === 'valid') return;
        throw new ValidationError('Invalid value');
      };

      const [error] = await safeRun(async () => await Validation.async('valid', asyncValidator));
      expect(error).toBeUndefined();
    });

    it('should throw ValidationError for failed async validation', async () => {
      const asyncValidator = async (value: string) => {
        if (value === 'valid') return;
        throw new ValidationError('Invalid value');
      };

      const [error] = await safeRun(async () => await Validation.async('invalid', asyncValidator));
      expect(error).toBeInstanceOf(ValidationError);
      expect(error?.message).toBe('Invalid value');
    });

    it('should wrap non-ValidationError as ValidationError', async () => {
      const asyncValidator = async (value: string) => {
        throw new Error('Some error');
      };

      const [error] = await safeRun(async () => await Validation.async('test', asyncValidator));
      expect(error).toBeInstanceOf(ValidationError);
      expect(error?.message).toBe('Validation failed: Some error');
    });
  });

  describe('custom method', () => {
    it('should create custom validator that passes', () => {
      const isEven = Validation.custom((value: number) => value % 2 === 0, 'Must be even');
      const [error] = safeRun(() => isEven(4));
      expect(error).toBeUndefined();
    });

    it('should create custom validator that fails', () => {
      const isEven = Validation.custom((value: number) => value % 2 === 0, 'Must be even');
      const [error] = safeRun(() => isEven(3));
      expect(error).toBeInstanceOf(ValidationError);
      expect(error?.message).toBe('Must be even');
    });
  });

  describe('safe method', () => {
    it('should return success result for valid value', () => {
      const result = Validation.safe('test@example.com', value => Validation.email(value));
      expect(result).toEqual({ isValid: true });
    });

    it('should return error result for invalid value', () => {
      const result = Validation.safe('invalid-email', value => Validation.email(value));
      expect(result).toEqual({
        isValid: false,
        error: 'Email must be in valid format',
      });
    });

    it('should handle non-Error exceptions', () => {
      const throwString = (value: string) => {
        throw 'String error';
      };

      const result = Validation.safe('test', throwString);
      expect(result).toEqual({
        isValid: false,
        error: 'String error',
      });
    });
  });
});
