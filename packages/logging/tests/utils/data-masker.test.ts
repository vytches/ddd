import { describe, it, expect } from 'vitest';
import { DataMasker } from '../../src';

describe('DataMasker', () => {
  describe('sensitive key masking', () => {
    it('should mask sensitive keys', () => {
      const masker = new DataMasker({
        enabled: true,
        sensitiveKeys: ['password', 'secret', 'token'],
        replacement: '[MASKED]',
      });

      const data = {
        username: 'john',
        password: 'secret123',
        apiToken: 'abc123',
        secretKey: 'xyz789',
        normalField: 'value',
      };

      const masked = masker.maskData(data);

      expect(masked).toEqual({
        username: 'john',
        password: '[MASKED]',
        apiToken: '[MASKED]', // contains 'token'
        secretKey: '[MASKED]', // contains 'secret'
        normalField: 'value',
      });
    });

    it('should handle case insensitive matching', () => {
      const masker = new DataMasker({
        enabled: true,
        sensitiveKeys: ['password'],
        replacement: '[HIDDEN]',
      });

      const data = {
        Password: 'secret',
        PASSWORD: 'secret',
        userPassword: 'secret',
        passwordField: 'secret',
      };

      const masked = masker.maskData(data);

      expect(masked).toEqual({
        Password: '[HIDDEN]',
        PASSWORD: '[HIDDEN]',
        userPassword: '[HIDDEN]',
        passwordField: '[HIDDEN]',
      });
    });

    it('should not mask when no sensitive keys configured', () => {
      const masker = new DataMasker({
        enabled: true,
        sensitiveKeys: [], // empty
        replacement: '[MASKED]',
      });

      const data = {
        password: 'secret123',
        token: 'abc123',
      };

      const masked = masker.maskData(data);

      expect(masked).toEqual({
        password: 'secret123',
        token: 'abc123',
      });
    });
  });

  describe('pattern-based masking', () => {
    it('should mask email addresses by default', () => {
      const masker = new DataMasker({
        enabled: true,
        replacement: '[EMAIL]',
      });

      const data = {
        message: 'Contact john@example.com or admin@test.org for help',
        description: 'User email is jane.doe@company.co.uk',
      };

      const masked = masker.maskData(data);

      expect(masked).toEqual({
        message: 'Contact [EMAIL] or [EMAIL] for help',
        description: 'User email is [EMAIL]',
      });
    });

    it('should mask SSN patterns by default', () => {
      const masker = new DataMasker({
        enabled: true,
        replacement: '[SSN]',
      });

      const data = {
        notes: 'SSN: 123-45-6789 and also 987654321',
        description: 'Another SSN 555-66-7777',
      };

      const masked = masker.maskData(data);

      expect(masked).toEqual({
        notes: 'SSN: [SSN] and also [SSN]',
        description: 'Another SSN [SSN]',
      });
    });

    it('should mask credit card numbers by default', () => {
      const masker = new DataMasker({
        enabled: true,
        replacement: '[CARD]',
      });

      const data = {
        payment: 'Card: 4532-1234-5678-9012',
        backup: 'Alternative: 4532 1234 5678 9012',
        compact: 'Compact: 4532123456789012',
      };

      const masked = masker.maskData(data);

      expect(masked).toEqual({
        payment: 'Card: [CARD]',
        backup: 'Alternative: [CARD]',
        compact: 'Compact: [CARD]',
      });
    });

    it('should use custom patterns', () => {
      const masker = new DataMasker({
        enabled: true,
        patterns: [
          '\\b[A-Z]{2}\\d{6}\\b', // Custom pattern like AB123456
        ],
        replacement: '[CUSTOM]',
      });

      const data = {
        code: 'Reference AB123456 and CD789012',
        text: 'No match here: ab123456', // lowercase shouldn't match
      };

      const masked = masker.maskData(data);

      expect(masked).toEqual({
        code: 'Reference [CUSTOM] and [CUSTOM]',
        text: 'No match here: ab123456',
      });
    });
  });

  describe('nested object masking', () => {
    it('should mask nested objects', () => {
      const masker = new DataMasker({
        enabled: true,
        sensitiveKeys: ['password', 'secret'],
        replacement: '[MASKED]',
      });

      const data = {
        user: {
          name: 'john',
          password: 'secret123',
          profile: {
            email: 'john@example.com',
            secretAnswer: 'blue',
          },
        },
        apiSecret: 'xyz789',
      };

      const masked = masker.maskData(data);

      expect(masked).toEqual({
        user: {
          name: 'john',
          password: '[MASKED]',
          profile: {
            email: 'john@example.com',
            secretAnswer: '[MASKED]',
          },
        },
        apiSecret: '[MASKED]',
      });
    });

    it('should mask arrays', () => {
      const masker = new DataMasker({
        enabled: true,
        sensitiveKeys: ['token'],
        replacement: '[MASKED]',
      });

      const data = {
        tokens: [
          { token: 'abc123', name: 'api' },
          { token: 'xyz789', name: 'refresh' },
        ],
        users: ['john', 'jane'],
      };

      const masked = masker.maskData(data);

      expect(masked).toEqual({
        tokens: [
          { token: '[MASKED]', name: 'api' },
          { token: '[MASKED]', name: 'refresh' },
        ],
        users: ['john', 'jane'],
      });
    });

    it('should handle null and undefined values', () => {
      const masker = new DataMasker({
        enabled: true,
        sensitiveKeys: ['password'],
        replacement: '[MASKED]',
      });

      const data = {
        password: null,
        secret: undefined,
        value: 'normal',
        nested: {
          password: null,
          data: undefined,
        },
      };

      const masked = masker.maskData(data);

      expect(masked).toEqual({
        password: '[MASKED]', // sensitive key is masked even if null
        secret: undefined, // not a sensitive key, stays undefined
        value: 'normal',
        nested: {
          password: '[MASKED]', // sensitive key is masked even if null
          data: undefined,
        },
      });
    });
  });

  describe('disabled masking', () => {
    it('should not mask when disabled', () => {
      const masker = new DataMasker({
        enabled: false,
        sensitiveKeys: ['password', 'secret'],
        patterns: ['\\d{4}-\\d{4}-\\d{4}-\\d{4}'],
        replacement: '[MASKED]',
      });

      const data = {
        password: 'secret123',
        card: '1234-5678-9012-3456',
        email: 'test@example.com',
      };

      const masked = masker.maskData(data);

      // Should return original data unchanged
      expect(masked).toEqual(data);
    });
  });

  describe('configuration', () => {
    it('should use default options when not provided', () => {
      const masker = new DataMasker(); // no options

      expect(() => masker.maskData({ test: 'value' })).not.toThrow();
    });

    it('should use custom replacement string', () => {
      const masker = new DataMasker({
        enabled: true,
        sensitiveKeys: ['password'],
        replacement: '***REDACTED***',
      });

      const data = { password: 'secret' };
      const masked = masker.maskData(data);

      expect(masked).toEqual({ password: '***REDACTED***' });
    });

    it('should merge custom sensitive keys with defaults', () => {
      const masker = new DataMasker({
        enabled: true,
        sensitiveKeys: ['customSecret', 'apiKey'],
        replacement: '[HIDDEN]',
      });

      const data = {
        customSecret: 'value1',
        apiKey: 'value2',
        normalField: 'value3',
      };

      const masked = masker.maskData(data);

      expect(masked).toEqual({
        customSecret: '[HIDDEN]',
        apiKey: '[HIDDEN]',
        normalField: 'value3',
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty objects', () => {
      const masker = new DataMasker({
        enabled: true,
        sensitiveKeys: ['password'],
      });

      expect(masker.maskData({})).toEqual({});
    });

    it('should handle primitive values', () => {
      const masker = new DataMasker({
        enabled: true,
        sensitiveKeys: ['password'],
      });

      expect(masker.maskData('string')).toBe('string');
      expect(masker.maskData(123)).toBe(123);
      expect(masker.maskData(true)).toBe(true);
    });

    it('should handle circular references gracefully', () => {
      const masker = new DataMasker({
        enabled: true,
        sensitiveKeys: ['password'],
      });

      const obj: any = { name: 'test', password: 'secret' };
      obj.self = obj; // circular reference

      const result = masker.maskData(obj);

      expect(result).toEqual({
        name: 'test',
        password: '[MASKED]',
        self: '[Circular Reference]',
      });
    });
  });
});
