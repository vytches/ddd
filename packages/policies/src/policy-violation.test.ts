import { describe, it, expect, beforeEach } from 'vitest';
import { PolicyViolation, PolicyViolationCollection } from './policy-violation';
import { PolicyContextBuilder } from './policy-context';
import type { PolicyContext } from './business-policy-interface';

describe('PolicyViolation', () => {
  let testContext: PolicyContext;

  beforeEach(() => {
    testContext = PolicyContextBuilder.forUser('user-123', 'test');
  });

  describe('constructor', () => {
    it('should create violation with required parameters', () => {
      const violation = new PolicyViolation('TEST_CODE', 'Test message');

      expect(violation.code).toBe('TEST_CODE');
      expect(violation.message).toBe('Test message');
      expect(violation.severity).toBe('ERROR'); // default
      expect(violation.field).toBeUndefined();
      expect(violation.details).toBeUndefined();
      expect(violation.context).toBeUndefined();
    });

    it('should create violation with all parameters', () => {
      const details = { additionalInfo: 'test data' };

      const violation = new PolicyViolation(
        'TEST_CODE',
        'Test message',
        'WARNING',
        'testField',
        details,
        testContext
      );

      expect(violation.code).toBe('TEST_CODE');
      expect(violation.message).toBe('Test message');
      expect(violation.severity).toBe('WARNING');
      expect(violation.field).toBe('testField');
      expect(violation.details).toBe(details);
      expect(violation.context).toBe(testContext);
    });
  });

  describe('toString', () => {
    it('should return formatted string for ERROR severity', () => {
      const violation = new PolicyViolation('TEST_CODE', 'Test message', 'ERROR');

      expect(violation.toString()).toBe('TEST_CODE: Test message');
    });

    it('should return formatted string with severity prefix for non-ERROR', () => {
      const violation = new PolicyViolation('TEST_CODE', 'Test message', 'WARNING');

      expect(violation.toString()).toBe('[WARNING] TEST_CODE: Test message');
    });

    it('should return formatted string for INFO severity', () => {
      const violation = new PolicyViolation('TEST_CODE', 'Test message', 'INFO');

      expect(violation.toString()).toBe('[INFO] TEST_CODE: Test message');
    });
  });

  describe('toJSON', () => {
    it('should convert violation to JSON with basic fields', () => {
      const violation = new PolicyViolation('TEST_CODE', 'Test message', 'WARNING');

      const json = violation.toJSON();

      expect(json).toEqual({
        code: 'TEST_CODE',
        message: 'Test message',
        severity: 'WARNING',
      });
    });

    it('should include optional fields when present', () => {
      const details = { additionalInfo: 'test data' };
      const violation = new PolicyViolation(
        'TEST_CODE',
        'Test message',
        'ERROR',
        'testField',
        details,
        testContext
      );

      const json = violation.toJSON();

      expect(json).toEqual({
        code: 'TEST_CODE',
        message: 'Test message',
        severity: 'ERROR',
        field: 'testField',
        details,
        timestamp: testContext.timestamp.toISOString(),
        userId: 'user-123',
        sessionId: testContext.sessionId,
      });
    });

    it('should handle missing context fields gracefully', () => {
      const minimalContext = PolicyContextBuilder.create()
        .withUserId('user-456')
        .withEnvironment('test')
        .build();

      const violation = new PolicyViolation(
        'TEST_CODE',
        'Test message',
        'ERROR',
        undefined,
        undefined,
        minimalContext
      );

      const json = violation.toJSON();

      expect(json.timestamp).toBeDefined();
      expect(json.userId).toBe('user-456');
      expect(json.sessionId).toBeUndefined();
    });
  });

  describe('static factory methods', () => {
    describe('error', () => {
      it('should create ERROR violation', () => {
        const violation = PolicyViolation.error('ERROR_CODE', 'Error message');

        expect(violation.code).toBe('ERROR_CODE');
        expect(violation.message).toBe('Error message');
        expect(violation.severity).toBe('ERROR');
      });

      it('should create ERROR violation with all parameters', () => {
        const details = { errorInfo: 'test' };
        const violation = PolicyViolation.error(
          'ERROR_CODE',
          'Error message',
          'errorField',
          details,
          testContext
        );

        expect(violation.severity).toBe('ERROR');
        expect(violation.field).toBe('errorField');
        expect(violation.details).toBe(details);
        expect(violation.context).toBe(testContext);
      });
    });

    describe('warning', () => {
      it('should create WARNING violation', () => {
        const violation = PolicyViolation.warning('WARN_CODE', 'Warning message');

        expect(violation.code).toBe('WARN_CODE');
        expect(violation.message).toBe('Warning message');
        expect(violation.severity).toBe('WARNING');
      });
    });

    describe('info', () => {
      it('should create INFO violation', () => {
        const violation = PolicyViolation.info('INFO_CODE', 'Info message');

        expect(violation.code).toBe('INFO_CODE');
        expect(violation.message).toBe('Info message');
        expect(violation.severity).toBe('INFO');
      });
    });
  });

  describe('severity check methods', () => {
    it('should correctly identify ERROR violations', () => {
      const violation = new PolicyViolation('TEST_CODE', 'Test message', 'ERROR');

      expect(violation.isError()).toBe(true);
      expect(violation.isWarning()).toBe(false);
      expect(violation.isInfo()).toBe(false);
    });

    it('should correctly identify WARNING violations', () => {
      const violation = new PolicyViolation('TEST_CODE', 'Test message', 'WARNING');

      expect(violation.isError()).toBe(false);
      expect(violation.isWarning()).toBe(true);
      expect(violation.isInfo()).toBe(false);
    });

    it('should correctly identify INFO violations', () => {
      const violation = new PolicyViolation('TEST_CODE', 'Test message', 'INFO');

      expect(violation.isError()).toBe(false);
      expect(violation.isWarning()).toBe(false);
      expect(violation.isInfo()).toBe(true);
    });
  });

  describe('withContext', () => {
    it('should create new violation with additional context', () => {
      const violation = new PolicyViolation('TEST_CODE', 'Test message');
      const newViolation = violation.withContext(testContext);

      expect(newViolation).not.toBe(violation);
      expect(newViolation.code).toBe('TEST_CODE');
      expect(newViolation.message).toBe('Test message');
      expect(newViolation.context).toBe(testContext);
      expect(violation.context).toBeUndefined(); // Original unchanged
    });
  });

  describe('withDetails', () => {
    it('should create new violation with additional details', () => {
      const originalDetails = { original: 'data' };
      const additionalDetails = { additional: 'info' };
      const violation = new PolicyViolation(
        'TEST_CODE',
        'Test message',
        'ERROR',
        undefined,
        originalDetails
      );

      const newViolation = violation.withDetails(additionalDetails);

      expect(newViolation).not.toBe(violation);
      expect(newViolation.details).toEqual({
        original: 'data',
        additional: 'info',
      });
      expect(violation.details).toEqual({ original: 'data' }); // Original unchanged
    });

    it('should handle undefined original details', () => {
      const violation = new PolicyViolation('TEST_CODE', 'Test message');
      const additionalDetails = { additional: 'info' };

      const newViolation = violation.withDetails(additionalDetails);

      expect(newViolation.details).toEqual({ additional: 'info' });
    });
  });

  describe('withField', () => {
    it('should create new violation with specific field', () => {
      const violation = new PolicyViolation('TEST_CODE', 'Test message');
      const newViolation = violation.withField('newField');

      expect(newViolation).not.toBe(violation);
      expect(newViolation.field).toBe('newField');
      expect(violation.field).toBeUndefined(); // Original unchanged
    });
  });
});

describe('PolicyViolationCollection', () => {
  let errorViolation: PolicyViolation;
  let warningViolation: PolicyViolation;
  let infoViolation: PolicyViolation;

  beforeEach(() => {
    errorViolation = PolicyViolation.error('ERROR_CODE', 'Error message');
    warningViolation = PolicyViolation.warning('WARNING_CODE', 'Warning message');
    infoViolation = PolicyViolation.info('INFO_CODE', 'Info message');
  });

  describe('constructor', () => {
    it('should create empty collection', () => {
      const collection = new PolicyViolationCollection();

      expect(collection.count()).toBe(0);
      expect(collection.hasViolations()).toBe(false);
    });

    it('should create collection with initial violations', () => {
      const collection = new PolicyViolationCollection([errorViolation, warningViolation]);

      expect(collection.count()).toBe(2);
      expect(collection.hasViolations()).toBe(true);
    });
  });

  describe('add', () => {
    it('should add violation to collection', () => {
      const collection = new PolicyViolationCollection();

      collection.add(errorViolation);

      expect(collection.count()).toBe(1);
      expect(collection.getAll()).toContain(errorViolation);
    });

    it('should add multiple violations', () => {
      const collection = new PolicyViolationCollection();

      collection.add(errorViolation);
      collection.add(warningViolation);

      expect(collection.count()).toBe(2);
    });
  });

  describe('getAll', () => {
    it('should return all violations', () => {
      const collection = new PolicyViolationCollection([errorViolation, warningViolation]);

      const all = collection.getAll();

      expect(all).toHaveLength(2);
      expect(all).toContain(errorViolation);
      expect(all).toContain(warningViolation);
    });

    it('should return readonly array', () => {
      const collection = new PolicyViolationCollection([errorViolation]);

      const all = collection.getAll();

      expect(all).toEqual(expect.any(Array));
      // The returned array should be readonly - TypeScript will catch mutation attempts
    });
  });

  describe('severity filtering', () => {
    let collection: PolicyViolationCollection;

    beforeEach(() => {
      collection = new PolicyViolationCollection();
      collection.add(errorViolation);
      collection.add(warningViolation);
      collection.add(infoViolation);
    });

    describe('getErrors', () => {
      it('should return only error violations', () => {
        const errors = collection.getErrors();

        expect(errors).toHaveLength(1);
        expect(errors[0]).toBe(errorViolation);
      });
    });

    describe('getWarnings', () => {
      it('should return only warning violations', () => {
        const warnings = collection.getWarnings();

        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toBe(warningViolation);
      });
    });

    describe('getInfo', () => {
      it('should return only info violations', () => {
        const info = collection.getInfo();

        expect(info).toHaveLength(1);
        expect(info[0]).toBe(infoViolation);
      });
    });

    describe('hasErrors', () => {
      it('should return true when collection has errors', () => {
        expect(collection.hasErrors()).toBe(true);
      });

      it('should return false when collection has no errors', () => {
        const noErrorsCollection = new PolicyViolationCollection([warningViolation, infoViolation]);

        expect(noErrorsCollection.hasErrors()).toBe(false);
      });
    });
  });

  describe('hasViolations', () => {
    it('should return true when collection has violations', () => {
      const collection = new PolicyViolationCollection([errorViolation]);

      expect(collection.hasViolations()).toBe(true);
    });

    it('should return false when collection is empty', () => {
      const collection = new PolicyViolationCollection();

      expect(collection.hasViolations()).toBe(false);
    });
  });

  describe('count', () => {
    it('should return correct count', () => {
      const collection = new PolicyViolationCollection();

      expect(collection.count()).toBe(0);

      collection.add(errorViolation);
      expect(collection.count()).toBe(1);

      collection.add(warningViolation);
      expect(collection.count()).toBe(2);
    });
  });

  describe('toJSON', () => {
    it('should convert all violations to JSON array', () => {
      const collection = new PolicyViolationCollection([errorViolation, warningViolation]);

      const json = collection.toJSON();

      expect(json).toHaveLength(2);
      expect(json[0]).toEqual(errorViolation.toJSON());
      expect(json[1]).toEqual(warningViolation.toJSON());
    });

    it('should return empty array for empty collection', () => {
      const collection = new PolicyViolationCollection();

      const json = collection.toJSON();

      expect(json).toEqual([]);
    });
  });

  describe('toString', () => {
    it('should combine violation messages with semicolons', () => {
      const collection = new PolicyViolationCollection([errorViolation, warningViolation]);

      const str = collection.toString();

      expect(str).toBe('ERROR_CODE: Error message; [WARNING] WARNING_CODE: Warning message');
    });

    it('should return empty string for empty collection', () => {
      const collection = new PolicyViolationCollection();

      const str = collection.toString();

      expect(str).toBe('');
    });

    it('should handle single violation', () => {
      const collection = new PolicyViolationCollection([errorViolation]);

      const str = collection.toString();

      expect(str).toBe('ERROR_CODE: Error message');
    });
  });

  describe('mixed severity scenarios', () => {
    it('should handle collection with all severity levels', () => {
      const collection = new PolicyViolationCollection();
      collection.add(errorViolation);
      collection.add(warningViolation);
      collection.add(infoViolation);

      expect(collection.count()).toBe(3);
      expect(collection.hasErrors()).toBe(true);
      expect(collection.getErrors()).toHaveLength(1);
      expect(collection.getWarnings()).toHaveLength(1);
      expect(collection.getInfo()).toHaveLength(1);
    });

    it('should handle collection with multiple errors', () => {
      const error2 = PolicyViolation.error('ERROR_CODE_2', 'Second error');
      const collection = new PolicyViolationCollection([errorViolation, error2, warningViolation]);

      expect(collection.getErrors()).toHaveLength(2);
      expect(collection.hasErrors()).toBe(true);
    });
  });
});
