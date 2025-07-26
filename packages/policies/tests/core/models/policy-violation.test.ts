import { describe, it, expect } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import {
  PolicyViolation,
  PolicyViolationCollection,
} from '../../../src/core/models/policy-violation';
import { PolicyContextBuilder } from '../../../src/utils/policy-context-builder';

describe('PolicyViolation', () => {
  describe('constructor', () => {
    it('should create violation with required fields', () => {
      const [error, violation] = safeRun(
        () =>
          new PolicyViolation({
            code: 'TEST_ERROR',
            message: 'Test error message',
            severity: 'ERROR',
          })
      );

      expect(error).toBeUndefined();
      expect(violation?.code).toBe('TEST_ERROR');
      expect(violation?.message).toBe('Test error message');
      expect(violation?.severity).toBe('ERROR');
      expect(violation?.timestamp).toBeInstanceOf(Date);
    });

    it('should create violation with all optional fields', () => {
      const context = PolicyContextBuilder.forUser('test-user').build();

      const [error, violation] = safeRun(
        () =>
          new PolicyViolation({
            code: 'VALIDATION_ERROR',
            message: 'Field validation failed',
            severity: 'WARNING',
            field: 'email',
            details: { pattern: '^[\\w-\\.]+@([\\w-]+\\.)+[\\w-]{2,4}$' },
            context,
            policyId: 'email-validation',
            domain: 'user-management',
          })
      );

      expect(error).toBeUndefined();
      expect(violation?.field).toBe('email');
      expect(violation?.details.pattern).toBe('^[\\w-\\.]+@([\\w-]+\\.)+[\\w-]{2,4}$');
      expect(violation?.context).toBe(context);
      expect(violation?.policyId).toBe('email-validation');
      expect(violation?.domain).toBe('user-management');
    });
  });

  describe('severity checking methods', () => {
    it('should correctly identify error severity', () => {
      const violation = PolicyViolation.error({
        code: 'ERROR_CODE',
        message: 'Error message',
      });

      expect(violation.isError()).toBe(true);
      expect(violation.isWarning()).toBe(false);
      expect(violation.isInfo()).toBe(false);
    });

    it('should correctly identify warning severity', () => {
      const violation = PolicyViolation.warning({
        code: 'WARNING_CODE',
        message: 'Warning message',
      });

      expect(violation.isError()).toBe(false);
      expect(violation.isWarning()).toBe(true);
      expect(violation.isInfo()).toBe(false);
    });

    it('should correctly identify info severity', () => {
      const violation = PolicyViolation.info({
        code: 'INFO_CODE',
        message: 'Info message',
      });

      expect(violation.isError()).toBe(false);
      expect(violation.isWarning()).toBe(false);
      expect(violation.isInfo()).toBe(true);
    });
  });

  describe('static factory methods', () => {
    it('should create error violation', () => {
      const violation = PolicyViolation.error({
        code: 'ERROR_CODE',
        message: 'Error message',
      });

      expect(violation.severity).toBe('ERROR');
      expect(violation.isError()).toBe(true);
    });

    it('should create warning violation', () => {
      const violation = PolicyViolation.warning({
        code: 'WARNING_CODE',
        message: 'Warning message',
      });

      expect(violation.severity).toBe('WARNING');
      expect(violation.isWarning()).toBe(true);
    });

    it('should create info violation', () => {
      const violation = PolicyViolation.info({
        code: 'INFO_CODE',
        message: 'Info message',
      });

      expect(violation.severity).toBe('INFO');
      expect(violation.isInfo()).toBe(true);
    });
  });

  describe('toString', () => {
    it('should format violation with basic info', () => {
      const violation = new PolicyViolation({
        code: 'TEST_ERROR',
        message: 'Test message',
        severity: 'ERROR',
      });

      expect(violation.toString()).toBe('[ERROR] TEST_ERROR: Test message');
    });

    it('should format violation with field and policy info', () => {
      const violation = new PolicyViolation({
        code: 'VALIDATION_ERROR',
        message: 'Invalid email',
        severity: 'WARNING',
        field: 'email',
        policyId: 'email-policy',
      });

      expect(violation.toString()).toBe(
        '[WARNING] VALIDATION_ERROR: Invalid email (field: email) (policy: email-policy)'
      );
    });
  });

  describe('JSON serialization', () => {
    it('should serialize to JSON', () => {
      const violation = new PolicyViolation({
        code: 'TEST_ERROR',
        message: 'Test message',
        severity: 'ERROR',
        field: 'testField',
        details: { test: 'value' },
      });

      const json = violation.toJSON();

      expect(json.name).toBe('PolicyViolation');
      expect(json.code).toBe('TEST_ERROR');
      expect(json.message).toBe('Test message');
      expect(json.severity).toBe('ERROR');
      expect(json.field).toBe('testField');
      expect(json.details).toEqual({ test: 'value' });
      expect(json.timestamp).toBeDefined();
    });

    it('should deserialize from JSON', () => {
      const data = {
        name: 'PolicyViolation',
        code: 'TEST_ERROR',
        message: 'Test message',
        severity: 'ERROR' as const,
        field: 'testField',
        details: { test: 'value' },
        timestamp: '2023-01-01T00:00:00.000Z',
      };

      const violation = PolicyViolation.fromJSON(data);

      expect(violation.code).toBe('TEST_ERROR');
      expect(violation.message).toBe('Test message');
      expect(violation.severity).toBe('ERROR');
      expect(violation.field).toBe('testField');
      expect(violation.details).toEqual({ test: 'value' });
      expect(violation.timestamp).toEqual(new Date('2023-01-01T00:00:00.000Z'));
    });
  });
});

describe('PolicyViolationCollection', () => {
  describe('basic operations', () => {
    it('should create empty collection', () => {
      const collection = new PolicyViolationCollection();

      expect(collection.count()).toBe(0);
      expect(collection.hasAny()).toBe(false);
      expect(collection.getAll()).toEqual([]);
    });

    it('should add violations to collection', () => {
      const collection = new PolicyViolationCollection();
      const violation = PolicyViolation.error({
        code: 'TEST_ERROR',
        message: 'Test message',
      });

      collection.add(violation);

      expect(collection.count()).toBe(1);
      expect(collection.hasAny()).toBe(true);
      expect(collection.getAll()).toContain(violation);
    });

    it('should create collection from array', () => {
      const violations = [
        PolicyViolation.error({ code: 'ERROR1', message: 'Error 1' }),
        PolicyViolation.warning({ code: 'WARNING1', message: 'Warning 1' }),
      ];

      const collection = PolicyViolationCollection.from(violations);

      expect(collection.count()).toBe(2);
      expect(collection.getAll()).toEqual(violations);
    });
  });

  describe('filtering by severity', () => {
    it('should filter violations by severity', () => {
      const collection = new PolicyViolationCollection();

      const error1 = PolicyViolation.error({ code: 'ERROR1', message: 'Error 1' });
      const error2 = PolicyViolation.error({ code: 'ERROR2', message: 'Error 2' });
      const warning1 = PolicyViolation.warning({ code: 'WARNING1', message: 'Warning 1' });
      const info1 = PolicyViolation.info({ code: 'INFO1', message: 'Info 1' });

      collection.add(error1);
      collection.add(warning1);
      collection.add(error2);
      collection.add(info1);

      expect(collection.getErrors()).toEqual([error1, error2]);
      expect(collection.getWarnings()).toEqual([warning1]);
      expect(collection.getInfo()).toEqual([info1]);
      expect(collection.getBySeverity('ERROR')).toEqual([error1, error2]);
    });

    it('should check for existence of different severity levels', () => {
      const collection = new PolicyViolationCollection();

      collection.add(PolicyViolation.error({ code: 'ERROR1', message: 'Error 1' }));
      collection.add(PolicyViolation.warning({ code: 'WARNING1', message: 'Warning 1' }));

      expect(collection.hasErrors()).toBe(true);
      expect(collection.hasWarnings()).toBe(true);
      expect(collection.getInfo().length).toBe(0);
    });
  });

  describe('utility methods', () => {
    it('should clear all violations', () => {
      const collection = new PolicyViolationCollection();

      collection.add(PolicyViolation.error({ code: 'ERROR1', message: 'Error 1' }));
      collection.add(PolicyViolation.warning({ code: 'WARNING1', message: 'Warning 1' }));

      expect(collection.count()).toBe(2);

      collection.clear();

      expect(collection.count()).toBe(0);
      expect(collection.hasAny()).toBe(false);
    });

    it('should convert to array', () => {
      const violations = [
        PolicyViolation.error({ code: 'ERROR1', message: 'Error 1' }),
        PolicyViolation.warning({ code: 'WARNING1', message: 'Warning 1' }),
      ];

      const collection = PolicyViolationCollection.from(violations);
      const array = collection.toArray();

      expect(array).toEqual(violations);
      expect(array).not.toBe(violations); // Should be a new array
    });
  });
});
