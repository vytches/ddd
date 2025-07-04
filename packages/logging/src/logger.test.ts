import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DefaultLogger } from './logger';
import type { LogProvider, LogEvent } from './core/index';

describe('DefaultLogger', () => {
  let mockProvider: LogProvider;
  let writeSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    writeSpy = vi.fn(() => undefined) as any;
    mockProvider = {
      name: 'test',
      write: writeSpy as (event: LogEvent) => void,
    };

    // Reset global config
    DefaultLogger.configure({
      level: 'info',
      provider: mockProvider,
      masking: { enabled: false },
    });
  });

  describe('basic logging', () => {
    it('should log info message', () => {
      const logger = DefaultLogger.create('TestContext');
      logger.info('test message', { key: 'value' });

      expect(writeSpy).toHaveBeenCalledTimes(1);
      const logEvent: LogEvent = writeSpy.mock.calls[0]![0]!

      expect(logEvent.level).toBe('info');
      expect(logEvent.message).toBe('test message');
      expect(logEvent.context.name).toBe('TestContext');
      expect(logEvent.data).toEqual({ key: 'value' });
    });

    it('should log error with error object', () => {
      const logger = DefaultLogger.create('TestContext');
      const error = new Error('test error');

      logger.error('error occurred', error, { operation: 'test' });

      expect(writeSpy).toHaveBeenCalledTimes(1);
      const logEvent: LogEvent = writeSpy.mock.calls[0]![0]!

      expect(logEvent.level).toBe('error');
      expect(logEvent.message).toBe('error occurred');
      expect(logEvent.error).toBe(error);
      expect(logEvent.data).toEqual({ operation: 'test' });
    });

    it('should respect log levels', () => {
      DefaultLogger.configure({ level: 'warn', provider: mockProvider });
      const logger = DefaultLogger.create('TestContext');

      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      expect(writeSpy).toHaveBeenCalledTimes(2); // only warn and error
      expect(writeSpy.mock.calls[0]![0]!.level).toBe('warn');
      expect(writeSpy.mock.calls[1]![0]!.level).toBe('error');
    });

    it('should check if level is enabled', () => {
      DefaultLogger.configure({ level: 'warn', provider: mockProvider });
      const logger = DefaultLogger.create('TestContext');

      expect(logger.isLevelEnabled('debug')).toBe(false);
      expect(logger.isLevelEnabled('info')).toBe(false);
      expect(logger.isLevelEnabled('warn')).toBe(true);
      expect(logger.isLevelEnabled('error')).toBe(true);
      expect(logger.isLevelEnabled('fatal')).toBe(true);
    });
  });

  describe('context management', () => {
    it('should create child logger with same context properties', () => {
      const parent = DefaultLogger.create('Parent')
        .withCorrelationId('corr-123')
        .withUserId('user-456');

      const child = parent.child('Child');

      child.info('child message');

      const logEvent: LogEvent = writeSpy.mock.calls[0]![0]!
      expect(logEvent.context.name).toBe('Child');
      expect(logEvent.context.correlationId).toBe('corr-123');
      expect(logEvent.context.userId).toBe('user-456');
    });

    it('should add context properties', () => {
      const logger = DefaultLogger.create('TestContext')
        .withCorrelationId('corr-123')
        .withUserId('user-456')
        .withTenantId('tenant-789');

      logger.info('test message');

      const logEvent: LogEvent = writeSpy.mock.calls[0]![0]!
      expect(logEvent.context.correlationId).toBe('corr-123');
      expect(logEvent.context.userId).toBe('user-456');
      expect(logEvent.context.tenantId).toBe('tenant-789');
    });

    it('should override context properties', () => {
      const logger = DefaultLogger.create('TestContext')
        .withUserId('user-123')
        .withContext({ userId: 'user-456', requestId: 'req-789' });

      logger.info('test message');

      const logEvent: LogEvent = writeSpy.mock.calls[0]![0]!
      expect(logEvent.context.userId).toBe('user-456'); // overridden
      expect(logEvent.context.requestId).toBe('req-789'); // added
    });
  });

  describe('data masking integration', () => {
    it('should mask sensitive data when enabled', () => {
      DefaultLogger.configure({
        level: 'info',
        provider: mockProvider,
        masking: {
          enabled: true,
          sensitiveKeys: ['password', 'email'],
          replacement: '[MASKED]'
        }
      });

      const logger = DefaultLogger.create('TestContext');
      logger.info('user data', {
        username: 'john',
        password: 'secret123',
        email: 'john@example.com'
      });

      const logEvent: LogEvent = writeSpy.mock.calls[0]![0]!
      expect(logEvent.data).toEqual({
        username: 'john',
        password: '[MASKED]',
        email: '[MASKED]'
      });
    });

    it('should not mask when disabled', () => {
      DefaultLogger.configure({
        level: 'info',
        provider: mockProvider,
        masking: { enabled: false }
      });

      const logger = DefaultLogger.create('TestContext');
      logger.info('user data', {
        username: 'john',
        password: 'secret123'
      });

      const logEvent: LogEvent = writeSpy.mock.calls[0]![0]!
      expect(logEvent.data).toEqual({
        username: 'john',
        password: 'secret123'
      });
    });
  });

  describe('configuration', () => {
    it('should use global configuration', () => {
      DefaultLogger.configure({
        level: 'debug',
        provider: mockProvider
      });

      const logger = DefaultLogger.create('TestContext');
      expect(logger.level).toBe('debug');

      logger.debug('debug message');
      expect(writeSpy).toHaveBeenCalledTimes(1);
    });

    it('should allow per-instance configuration override', () => {
      DefaultLogger.configure({ level: 'warn', provider: mockProvider });

      const logger = new DefaultLogger(
        { name: 'TestContext' },
        { level: 'debug' }
      );

      expect(logger.level).toBe('debug');

      logger.debug('debug message');
      expect(writeSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('log event structure', () => {
    it('should generate unique log IDs', () => {
      const logger = DefaultLogger.create('TestContext');
      logger.info('message 1');
      logger.info('message 2');

      expect(writeSpy).toHaveBeenCalledTimes(2);
      const event1: LogEvent = writeSpy.mock.calls[0]![0]!;
      const event2: LogEvent = writeSpy.mock.calls[1]![0]!;

      expect(event1.id).toBeDefined();
      expect(event2.id).toBeDefined();
      expect(event1.id).not.toBe(event2.id);
    });

    it('should include timestamp in log events', () => {
      const logger = DefaultLogger.create('TestContext');
      const before = new Date();

      logger.info('test message');

      const after = new Date();
      const logEvent: LogEvent = writeSpy.mock.calls[0]![0]!

      expect(logEvent.timestamp).toBeInstanceOf(Date);
      expect(logEvent.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(logEvent.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should handle empty data gracefully', () => {
      const logger = DefaultLogger.create('TestContext');
      logger.info('message without data');

      const logEvent: LogEvent = writeSpy.mock.calls[0]![0]!
      expect(logEvent.data).toBeUndefined();
    });

    it('should include data when provided', () => {
      const logger = DefaultLogger.create('TestContext');
      logger.info('message with data', { key: 'value' });

      const logEvent: LogEvent = writeSpy.mock.calls[0]![0]!
      expect(logEvent.data).toEqual({ key: 'value' });
    });
  });
});
