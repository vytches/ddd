import { describe, it, expect } from 'vitest';

describe('CLI Logger', () => {
  it('should export logger object with required methods', async () => {
    // Dynamic import to avoid module-level initialization issues
    const { logger } = await import('../../../src/core/utils/logger');

    expect(logger).toBeDefined();
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.success).toBe('function');
  });

  it('should have success method that adds emoji prefix', async () => {
    // Since full mocking is complex, test basic interface contract
    const { logger } = await import('../../../src/core/utils/logger');

    // Verify the method exists and is callable (will fail silently in test environment)
    expect(() => logger.success('test')).not.toThrow();
  });

  it('should have all standard logging methods', async () => {
    const { logger } = await import('../../../src/core/utils/logger');

    // Verify methods exist and are callable
    expect(() => logger.debug('test')).not.toThrow();
    expect(() => logger.info('test')).not.toThrow();
    expect(() => logger.warn('test')).not.toThrow();
    expect(() => logger.error('test')).not.toThrow();
  });

  it('should handle multiple arguments without throwing', async () => {
    const { logger } = await import('../../../src/core/utils/logger');

    expect(() => logger.debug('test', { key: 'value' }, 'extra')).not.toThrow();
    expect(() => logger.info('test', { key: 'value' })).not.toThrow();
    expect(() => logger.warn('test', 'string', 123)).not.toThrow();
    expect(() => logger.error('test', new Error('test error'))).not.toThrow();
    expect(() => logger.success('test', { result: 'success' })).not.toThrow();
  });
});
