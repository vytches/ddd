import { describe, it, expect } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import { LOG_LEVELS, isLogLevelEnabled, parseLogLevel } from '../../src';

describe('Log Levels', () => {
  describe('LOG_LEVELS constant', () => {
    it('should have correct level hierarchy', () => {
      expect(LOG_LEVELS.trace).toBe(0);
      expect(LOG_LEVELS.debug).toBe(1);
      expect(LOG_LEVELS.info).toBe(2);
      expect(LOG_LEVELS.warn).toBe(3);
      expect(LOG_LEVELS.error).toBe(4);
      expect(LOG_LEVELS.fatal).toBe(5);
    });

    it('should have ascending numeric values', () => {
      expect(LOG_LEVELS.trace < LOG_LEVELS.debug).toBe(true);
      expect(LOG_LEVELS.debug < LOG_LEVELS.info).toBe(true);
      expect(LOG_LEVELS.info < LOG_LEVELS.warn).toBe(true);
      expect(LOG_LEVELS.warn < LOG_LEVELS.error).toBe(true);
      expect(LOG_LEVELS.error < LOG_LEVELS.fatal).toBe(true);
    });
  });

  describe('isLogLevelEnabled', () => {
    it('should enable higher or equal levels', () => {
      // When min level is 'info'
      expect(isLogLevelEnabled('trace', 'info')).toBe(false);
      expect(isLogLevelEnabled('debug', 'info')).toBe(false);
      expect(isLogLevelEnabled('info', 'info')).toBe(true);
      expect(isLogLevelEnabled('warn', 'info')).toBe(true);
      expect(isLogLevelEnabled('error', 'info')).toBe(true);
      expect(isLogLevelEnabled('fatal', 'info')).toBe(true);
    });

    it('should work with trace level (most permissive)', () => {
      expect(isLogLevelEnabled('trace', 'trace')).toBe(true);
      expect(isLogLevelEnabled('debug', 'trace')).toBe(true);
      expect(isLogLevelEnabled('info', 'trace')).toBe(true);
      expect(isLogLevelEnabled('warn', 'trace')).toBe(true);
      expect(isLogLevelEnabled('error', 'trace')).toBe(true);
      expect(isLogLevelEnabled('fatal', 'trace')).toBe(true);
    });

    it('should work with fatal level (most restrictive)', () => {
      expect(isLogLevelEnabled('trace', 'fatal')).toBe(false);
      expect(isLogLevelEnabled('debug', 'fatal')).toBe(false);
      expect(isLogLevelEnabled('info', 'fatal')).toBe(false);
      expect(isLogLevelEnabled('warn', 'fatal')).toBe(false);
      expect(isLogLevelEnabled('error', 'fatal')).toBe(false);
      expect(isLogLevelEnabled('fatal', 'fatal')).toBe(true);
    });

    it('should work with warn level (common production setting)', () => {
      expect(isLogLevelEnabled('trace', 'warn')).toBe(false);
      expect(isLogLevelEnabled('debug', 'warn')).toBe(false);
      expect(isLogLevelEnabled('info', 'warn')).toBe(false);
      expect(isLogLevelEnabled('warn', 'warn')).toBe(true);
      expect(isLogLevelEnabled('error', 'warn')).toBe(true);
      expect(isLogLevelEnabled('fatal', 'warn')).toBe(true);
    });

    it('should work with error level', () => {
      expect(isLogLevelEnabled('trace', 'error')).toBe(false);
      expect(isLogLevelEnabled('debug', 'error')).toBe(false);
      expect(isLogLevelEnabled('info', 'error')).toBe(false);
      expect(isLogLevelEnabled('warn', 'error')).toBe(false);
      expect(isLogLevelEnabled('error', 'error')).toBe(true);
      expect(isLogLevelEnabled('fatal', 'error')).toBe(true);
    });
  });

  describe('parseLogLevel', () => {
    it('should parse valid log levels', () => {
      expect(parseLogLevel('trace')).toBe('trace');
      expect(parseLogLevel('debug')).toBe('debug');
      expect(parseLogLevel('info')).toBe('info');
      expect(parseLogLevel('warn')).toBe('warn');
      expect(parseLogLevel('error')).toBe('error');
      expect(parseLogLevel('fatal')).toBe('fatal');
    });

    it('should handle case insensitive input', () => {
      expect(parseLogLevel('TRACE')).toBe('trace');
      expect(parseLogLevel('DEBUG')).toBe('debug');
      expect(parseLogLevel('INFO')).toBe('info');
      expect(parseLogLevel('WARN')).toBe('warn');
      expect(parseLogLevel('ERROR')).toBe('error');
      expect(parseLogLevel('FATAL')).toBe('fatal');
    });

    it('should handle mixed case input', () => {
      expect(parseLogLevel('Trace')).toBe('trace');
      expect(parseLogLevel('Debug')).toBe('debug');
      expect(parseLogLevel('Info')).toBe('info');
      expect(parseLogLevel('Warn')).toBe('warn');
      expect(parseLogLevel('Error')).toBe('error');
      expect(parseLogLevel('Fatal')).toBe('fatal');
    });

    it('should throw error for invalid log levels', () => {
      const [invalidError] = safeRun(() => parseLogLevel('invalid'));
      expect(invalidError).toBeDefined();

      const [verboseError] = safeRun(() => parseLogLevel('verbose'));
      expect(verboseError).toBeDefined();

      const [sillyError] = safeRun(() => parseLogLevel('silly'));
      expect(sillyError).toBeDefined();

      const [emptyError] = safeRun(() => parseLogLevel(''));
      expect(emptyError).toBeDefined();

      const [spaceError] = safeRun(() => parseLogLevel('  '));
      expect(spaceError).toBeDefined();
    });

    it('should provide helpful error messages', () => {
      try {
        parseLogLevel('invalid');
        expect.fail('Should have thrown an error');
      } catch (error) {
        const errorMessage = (error as Error).message;
        expect(errorMessage).toContain('Invalid log level: invalid');
        expect(errorMessage).toContain('Valid levels are:');
        expect(errorMessage).toContain('trace');
        expect(errorMessage).toContain('debug');
        expect(errorMessage).toContain('info');
        expect(errorMessage).toContain('warn');
        expect(errorMessage).toContain('error');
        expect(errorMessage).toContain('fatal');
      }
    });

    it('should handle edge cases', () => {
      const [nullError] = safeRun(() => parseLogLevel(null as any));
      expect(nullError).toBeDefined();

      const [undefinedError] = safeRun(() => parseLogLevel(undefined as any));
      expect(undefinedError).toBeDefined();

      const [numberError] = safeRun(() => parseLogLevel(123 as any));
      expect(numberError).toBeDefined();

      const [objectError] = safeRun(() => parseLogLevel({} as any));
      expect(objectError).toBeDefined();
    });
  });

  describe('integration scenarios', () => {
    it('should work together for level filtering', () => {
      const configuredLevel = parseLogLevel('WARN');

      expect(isLogLevelEnabled('debug', configuredLevel)).toBe(false);
      expect(isLogLevelEnabled('info', configuredLevel)).toBe(false);
      expect(isLogLevelEnabled('warn', configuredLevel)).toBe(true);
      expect(isLogLevelEnabled('error', configuredLevel)).toBe(true);
    });

    it('should handle real-world configuration scenarios', () => {
      // Development environment - trace level
      const devLevel = parseLogLevel('trace');
      expect(isLogLevelEnabled('debug', devLevel)).toBe(true);
      expect(isLogLevelEnabled('info', devLevel)).toBe(true);

      // Production environment - warn level
      const prodLevel = parseLogLevel('WARN');
      expect(isLogLevelEnabled('debug', prodLevel)).toBe(false);
      expect(isLogLevelEnabled('info', prodLevel)).toBe(false);
      expect(isLogLevelEnabled('warn', prodLevel)).toBe(true);
      expect(isLogLevelEnabled('error', prodLevel)).toBe(true);

      // Critical systems - error only
      const criticalLevel = parseLogLevel('error');
      expect(isLogLevelEnabled('warn', criticalLevel)).toBe(false);
      expect(isLogLevelEnabled('error', criticalLevel)).toBe(true);
      expect(isLogLevelEnabled('fatal', criticalLevel)).toBe(true);
    });
  });
});
