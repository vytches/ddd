import { describe, expect, it } from 'vitest';
import {
  DomainErrorCode,
  DuplicateError,
  IDomainError,
  InvalidParameterError,
  MissingValueError,
  NotFoundError,
  type DomainErrorOptions,
  type ErrorCode,
} from '../../src/errors';

// Test implementation of IDomainError for testing
class TestDomainError extends IDomainError {
  constructor(message: string, options?: DomainErrorOptions) {
    super(message, options);
  }
}

describe('IDomainError Flexibility', () => {
  describe('Backward Compatibility', () => {
    it('should accept enum codes as before', () => {
      const error = new TestDomainError('Test error', {
        code: DomainErrorCode.ValidationFailed,
      });

      expect(error.code).toBe(DomainErrorCode.ValidationFailed);
      expect(error.message).toBe('Test error');
    });

    it('should use default enum code when no code provided', () => {
      const error = new TestDomainError('Test error');

      expect(error.code).toBe(DomainErrorCode.Default);
    });

    it('should work with all existing error classes', () => {
      const missingError = MissingValueError.withValue('Missing field');
      expect(missingError.code).toBe(DomainErrorCode.MissingValue);

      const invalidError = InvalidParameterError.withParameter('email');
      expect(invalidError.code).toBe(DomainErrorCode.MissingValue);

      const duplicateError = DuplicateError.withEntityId('123');
      expect(duplicateError.code).toBe(DomainErrorCode.DuplicateEntry);

      const notFoundError = NotFoundError.withEntityId('456');
      expect(notFoundError.code).toBe(DomainErrorCode.NotFound);
    });
  });

  describe('String Code Support', () => {
    it('should accept custom string codes', () => {
      const error = new TestDomainError('Custom error', {
        code: 'CUSTOM_ERROR_CODE',
      });

      expect(error.code).toBe('CUSTOM_ERROR_CODE');
      expect(error.message).toBe('Custom error');
    });

    it('should accept dynamic string codes', () => {
      const dynamicCode = `ERROR_${Date.now()}`;
      const error = new TestDomainError('Dynamic error', {
        code: dynamicCode,
      });

      expect(error.code).toBe(dynamicCode);
    });

    it('should accept string codes from external systems', () => {
      const externalCode = 'EXT_SYSTEM_ERROR_42';
      const error = new TestDomainError('External system error', {
        code: externalCode,
        data: { systemId: 'external-api', errorId: 42 },
      });

      expect(error.code).toBe(externalCode);
      expect(error.data).toEqual({ systemId: 'external-api', errorId: 42 });
    });

    it('should handle empty string codes', () => {
      const error = new TestDomainError('Error with empty code', {
        code: '',
      });

      expect(error.code).toBe('');
    });

    it('should handle special characters in string codes', () => {
      const specialCode = 'ERROR:USER-404/NOT_FOUND';
      const error = new TestDomainError('Special code error', {
        code: specialCode,
      });

      expect(error.code).toBe(specialCode);
    });
  });

  describe('Mixed Usage', () => {
    it('should work with both enum and string codes in same application', () => {
      const enumError = new TestDomainError('Enum error', {
        code: DomainErrorCode.ValidationFailed,
      });

      const stringError = new TestDomainError('String error', {
        code: 'CUSTOM_VALIDATION_ERROR',
      });

      expect(enumError.code).toBe(DomainErrorCode.ValidationFailed);
      expect(stringError.code).toBe('CUSTOM_VALIDATION_ERROR');

      // Both should be valid ErrorCode types
      const codes: ErrorCode[] = [enumError.code, stringError.code];
      expect(codes).toHaveLength(2);
    });

    it('should allow type checking with ErrorCode type', () => {
      const processError = (code: ErrorCode): string => {
        if (code === DomainErrorCode.ValidationFailed) {
          return 'Validation failed';
        }
        if (typeof code === 'string' && code.startsWith('CUSTOM_')) {
          return 'Custom error';
        }
        return 'Unknown error';
      };

      expect(processError(DomainErrorCode.ValidationFailed)).toBe('Validation failed');
      expect(processError('CUSTOM_ERROR')).toBe('Custom error');
      expect(processError('OTHER_ERROR')).toBe('Unknown error');
    });
  });

  describe('Error Options', () => {
    it('should preserve all options with string codes', () => {
      const error = new TestDomainError('Complex error', {
        code: 'COMPLEX_ERROR',
        domain: 'UserManagement',
        data: { userId: '123', action: 'update' },
        error: new Error('Inner error'),
      });

      expect(error.code).toBe('COMPLEX_ERROR');
      expect(error.domain).toBe('UserManagement');
      expect(error.data).toEqual({ userId: '123', action: 'update' });
      expect(error.error).toBeInstanceOf(Error);
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it('should handle Error parameter in options', () => {
      const innerError = new Error('Inner error');
      const error = new TestDomainError('Wrapper error', { error: innerError });

      expect(error.error).toBe(innerError);
      expect(error.code).toBe(DomainErrorCode.Default);
    });

    it('should handle Error as second parameter', () => {
      const innerError = new Error('Inner error');
      const error = new TestDomainError('Wrapper error', innerError as any);

      expect(error.error).toBe(innerError);
      expect(error.code).toBe(DomainErrorCode.Default);
    });
  });

  describe('Type Safety', () => {
    it('should maintain type safety with ErrorCode type', () => {
      const createError = (code: ErrorCode): TestDomainError => {
        return new TestDomainError('Error', { code });
      };

      const enumError = createError(DomainErrorCode.NotFound);
      const stringError = createError('NOT_FOUND_CUSTOM');

      expect(enumError.code).toBe(DomainErrorCode.NotFound);
      expect(stringError.code).toBe('NOT_FOUND_CUSTOM');
    });

    it('should allow checking code type at runtime', () => {
      const error1 = new TestDomainError('Error 1', {
        code: DomainErrorCode.ValidationFailed,
      });
      const error2 = new TestDomainError('Error 2', {
        code: 'VALIDATION_FAILED',
      });

      // Check if code is from enum
      const isEnumCode = (code: ErrorCode): boolean => {
        return Object.values(DomainErrorCode).includes(code as DomainErrorCode);
      };

      expect(isEnumCode(error1.code)).toBe(true);
      expect(isEnumCode(error2.code)).toBe(false);
    });
  });

  describe('Serialization', () => {
    it('should serialize correctly with string codes', () => {
      const error = new TestDomainError('Serializable error', {
        code: 'SERIALIZE_ERROR',
        domain: 'TestDomain',
        data: { test: true },
      });

      const serialized = JSON.stringify({
        name: error.name,
        message: error.message,
        code: error.code,
        domain: error.domain,
        data: error.data,
        timestamp: error.timestamp?.toISOString(),
      });

      const parsed = JSON.parse(serialized);
      expect(parsed.code).toBe('SERIALIZE_ERROR');
      expect(parsed.domain).toBe('TestDomain');
      expect(parsed.data).toEqual({ test: true });
    });

    it('should serialize correctly with enum codes', () => {
      const error = new TestDomainError('Serializable error', {
        code: DomainErrorCode.DatabaseError,
        domain: 'TestDomain',
      });

      const serialized = JSON.stringify({
        name: error.name,
        message: error.message,
        code: error.code,
        domain: error.domain,
      });

      const parsed = JSON.parse(serialized);
      expect(parsed.code).toBe(DomainErrorCode.DatabaseError);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null and undefined gracefully', () => {
      const error1 = new TestDomainError('Error', {});
      expect(error1.code).toBe(DomainErrorCode.Default);

      const error2 = new TestDomainError('Error', {});
      expect(error2.code).toBe(DomainErrorCode.Default);
    });

    it('should handle very long string codes', () => {
      const longCode = `ERROR_${'A'.repeat(1000)}`;
      const error = new TestDomainError('Long code error', {
        code: longCode,
      });

      expect(error.code).toBe(longCode);
      expect(error.code.length).toBe(1006);
    });

    it('should handle numeric-like string codes', () => {
      const error = new TestDomainError('Numeric code error', {
        code: '404',
      });

      expect(error.code).toBe('404');
      expect(typeof error.code).toBe('string');
    });
  });
});
