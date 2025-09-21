import { safeRun } from '@vytches/ddd-utils';
import { describe, expect, it } from 'vitest';
import {
  ProcessManagerAuth,
  ProcessManagerSecurity,
  ProcessManagerSecurityError,
  type IProcessManagerSecurityContext,
} from '../../src/security';

describe('ProcessManagerSecurity', () => {
  describe('validateId', () => {
    it('should validate correct IDs', () => {
      const validIds = ['test-pm-1', 'order-process-123', 'a1b2c3'];

      validIds.forEach(id => {
        const [error, result] = safeRun(() => ProcessManagerSecurity.validateId(id));
        expect(error).toBeUndefined();
        expect(result).toBe(id);
      });
    });

    it('should reject non-string IDs', () => {
      const invalidIds = [123, null, undefined, {}, []];

      invalidIds.forEach(id => {
        const [error] = safeRun(() => ProcessManagerSecurity.validateId(id));
        expect(error).toBeInstanceOf(ProcessManagerSecurityError);
        expect(error?.message).toContain('must be a string');
      });
    });

    it('should reject empty IDs', () => {
      const emptyIds = ['', '   '];

      emptyIds.forEach(id => {
        const [error] = safeRun(() => ProcessManagerSecurity.validateId(id));
        expect(error).toBeInstanceOf(ProcessManagerSecurityError);
        expect(error?.message).toContain('cannot be empty');
      });
    });

    it('should reject IDs with dangerous characters', () => {
      const dangerousIds = ['../malicious', '..\\evil', 'test>bad'];

      dangerousIds.forEach(id => {
        const [error] = safeRun(() => ProcessManagerSecurity.validateId(id));
        expect(error).toBeInstanceOf(ProcessManagerSecurityError);
        expect(error?.message).toContain('invalid characters');
      });
    });

    it('should reject XSS patterns', () => {
      const xssIds = [
        'javascript:alert(1)',
        '<script>alert(1)</script>',
        'data:text/html,<script>',
        'vbscript:msgbox(1)',
        '<script>',
      ];

      xssIds.forEach(id => {
        const [error] = safeRun(() => ProcessManagerSecurity.validateId(id));
        expect(error).toBeInstanceOf(ProcessManagerSecurityError);
        expect(error?.message).toContain('XSS patterns');
      });
    });

    it('should reject overly long IDs', () => {
      const longId = 'a'.repeat(256);
      const [error] = safeRun(() => ProcessManagerSecurity.validateId(longId));
      expect(error).toBeInstanceOf(ProcessManagerSecurityError);
      expect(error?.message).toContain('maximum length');
    });
  });

  describe('validateType', () => {
    it('should validate correct types', () => {
      const validTypes = ['OrderProcessManager', 'payment-processor', 'USER_WORKFLOW'];

      validTypes.forEach(type => {
        const [error, result] = safeRun(() => ProcessManagerSecurity.validateType(type));
        expect(error).toBeUndefined();
        expect(result).toBe(type);
      });
    });

    it('should reject non-alphanumeric types', () => {
      const invalidTypes = ['Order Process', 'payment@processor', 'user.workflow'];

      invalidTypes.forEach(type => {
        const [error] = safeRun(() => ProcessManagerSecurity.validateType(type));
        expect(error).toBeInstanceOf(ProcessManagerSecurityError);
        expect(error?.message).toContain('invalid characters');
      });
    });
  });

  describe('validateTimeout', () => {
    it('should validate correct timeouts', () => {
      const validTimeouts = [1000, 5000, 3600000];

      validTimeouts.forEach(timeout => {
        const [error, result] = safeRun(() => ProcessManagerSecurity.validateTimeout(timeout));
        expect(error).toBeUndefined();
        expect(result).toBe(timeout);
      });
    });

    it('should allow undefined timeout', () => {
      const [error, result] = safeRun(() => ProcessManagerSecurity.validateTimeout(undefined));
      expect(error).toBeUndefined();
      expect(result).toBeUndefined();
    });

    it('should reject timeouts that are too small', () => {
      const [error] = safeRun(() => ProcessManagerSecurity.validateTimeout(5)); // Less than 10ms
      expect(error).toBeInstanceOf(ProcessManagerSecurityError);
      expect(error?.message).toContain('at least');
    });

    it('should reject timeouts that are too large', () => {
      const [error] = safeRun(() => ProcessManagerSecurity.validateTimeout(25 * 60 * 60 * 1000));
      expect(error).toBeInstanceOf(ProcessManagerSecurityError);
      expect(error?.message).toContain('cannot exceed');
    });

    it('should reject non-integer timeouts', () => {
      const [error] = safeRun(() => ProcessManagerSecurity.validateTimeout(1500.5));
      expect(error).toBeInstanceOf(ProcessManagerSecurityError);
      expect(error?.message).toContain('must be an integer');
    });
  });

  describe('sanitizeStepData', () => {
    it('should sanitize valid step data', () => {
      const stepData = {
        orderId: 'order-123',
        amount: 100,
        nested: { value: 'test' },
      };

      const [error, result] = safeRun(() => ProcessManagerSecurity.sanitizeStepData(stepData));
      expect(error).toBeUndefined();
      expect(result).toEqual(stepData);
    });

    it('should remove dangerous keys', () => {
      const dangerousData = {
        orderId: 'order-123',
        __proto__: { malicious: true },
        constructor: { evil: true },
        prototype: { bad: true },
      };

      const [error, result] = safeRun(() => ProcessManagerSecurity.sanitizeStepData(dangerousData));
      expect(error).toBeUndefined();
      expect(result).toEqual({ orderId: 'order-123' });
    });

    it('should reject oversized data', () => {
      const largeData = {
        data: 'x'.repeat(1024 * 1024 + 1), // Exceed 1MB limit
      };

      const [error] = safeRun(() => ProcessManagerSecurity.sanitizeStepData(largeData));
      expect(error).toBeInstanceOf(ProcessManagerSecurityError);
      expect(error?.message).toContain('exceeds maximum size');
    });
  });

  describe('maskSensitiveData', () => {
    it('should mask sensitive fields', () => {
      const data = {
        orderId: 'order-123',
        password: 'secret123',
        email: 'user@example.com',
        amount: 100,
        creditCard: '1234-5678-9012-3456',
      };

      const masked = ProcessManagerSecurity.maskSensitiveData(data);

      expect(masked.orderId).toBe('order-123');
      expect(masked.amount).toBe(100);
      expect(masked.password).toBe('[MASKED]');
      expect(masked.email).toBe('[MASKED]');
      expect(masked.creditCard).toBe('[MASKED]');
    });

    it('should handle nested objects', () => {
      const data = {
        user: {
          name: 'John Doe',
          password: 'secret',
          profile: {
            email: 'john@example.com',
          },
        },
      };

      const masked = ProcessManagerSecurity.maskSensitiveData(data);

      const user = masked.user as any;
      expect(user.name).toBe('John Doe');
      expect(user.password).toBe('[MASKED]');
      expect(user.profile.email).toBe('[MASKED]');
    });
  });
});

describe('ProcessManagerAuth', () => {
  describe('requireAuthentication', () => {
    it('should pass for authenticated users', () => {
      const context: IProcessManagerSecurityContext = {
        userId: 'user-123',
      };

      const [error] = safeRun(() => ProcessManagerAuth.requireAuthentication(context));
      expect(error).toBeUndefined();
    });

    it('should fail for unauthenticated users', () => {
      const context: IProcessManagerSecurityContext = {};

      const [error] = safeRun(() => ProcessManagerAuth.requireAuthentication(context));
      expect(error).toBeInstanceOf(ProcessManagerSecurityError);
      expect(error?.message).toContain('Authentication required');
    });
  });

  describe('requirePermissions', () => {
    it('should pass when user has required permissions', () => {
      const context: IProcessManagerSecurityContext = {
        userId: 'user-123',
        permissions: ['process:read', 'process:write', 'process:execute'],
      };

      const [error] = safeRun(() =>
        ProcessManagerAuth.requirePermissions(context, 'process:read', 'process:write')
      );
      expect(error).toBeUndefined();
    });

    it('should fail when user lacks required permissions', () => {
      const context: IProcessManagerSecurityContext = {
        userId: 'user-123',
        permissions: ['process:read'],
      };

      const [error] = safeRun(() =>
        ProcessManagerAuth.requirePermissions(context, 'process:read', 'process:write')
      );
      expect(error).toBeInstanceOf(ProcessManagerSecurityError);
      expect(error?.message).toContain('Insufficient permissions');
    });
  });

  describe('requireRoles', () => {
    it('should pass when user has required roles', () => {
      const context: IProcessManagerSecurityContext = {
        userId: 'user-123',
        roles: ['admin', 'process-manager'],
      };

      const [error] = safeRun(() => ProcessManagerAuth.requireRoles(context, 'admin'));
      expect(error).toBeUndefined();
    });

    it('should fail when user lacks required roles', () => {
      const context: IProcessManagerSecurityContext = {
        userId: 'user-123',
        roles: ['user'],
      };

      const [error] = safeRun(() =>
        ProcessManagerAuth.requireRoles(context, 'admin', 'process-manager')
      );
      expect(error).toBeInstanceOf(ProcessManagerSecurityError);
      expect(error?.message).toContain('Insufficient roles');
    });
  });

  describe('validateTenantAccess', () => {
    it('should allow access when tenants match', () => {
      const context: IProcessManagerSecurityContext = {
        userId: 'user-123',
        tenantId: 'tenant-abc',
      };

      const [error] = safeRun(() => ProcessManagerAuth.validateTenantAccess(context, 'tenant-abc'));
      expect(error).toBeUndefined();
    });

    it('should deny access when tenants do not match', () => {
      const context: IProcessManagerSecurityContext = {
        userId: 'user-123',
        tenantId: 'tenant-abc',
      };

      const [error] = safeRun(() => ProcessManagerAuth.validateTenantAccess(context, 'tenant-xyz'));
      expect(error).toBeInstanceOf(ProcessManagerSecurityError);
      expect(error?.message).toContain('tenant mismatch');
    });

    it('should allow single-tenant scenarios', () => {
      const context: IProcessManagerSecurityContext = {
        userId: 'user-123',
        // No tenantId
      };

      const [error] = safeRun(() => ProcessManagerAuth.validateTenantAccess(context, undefined));
      expect(error).toBeUndefined();
    });
  });
});
