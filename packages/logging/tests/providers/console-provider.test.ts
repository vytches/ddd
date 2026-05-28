import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ConsoleProvider } from '../../src/providers/console-provider';
import { DataMasker } from '../../src/utils/data-masker';
import type { LogEvent } from '../../src/core/index';

function makeEvent(overrides: Partial<LogEvent> = {}): LogEvent {
  return {
    id: 'test-id',
    timestamp: new Date('2026-01-01T00:00:00.000Z'),
    level: 'info',
    message: 'test message',
    context: { name: 'TestContext' },
    ...overrides,
  };
}

describe('ConsoleProvider — VS-002 standalone masking', () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let debugSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('backward compatibility — no masker', () => {
    it('outputs raw event.data unchanged in prettyPrint mode', () => {
      const provider = new ConsoleProvider({ prettyPrint: true, colorize: false });
      const event = makeEvent({ data: { email: 'jan@example.com', password: 'secret' } });

      provider.write(event);

      const output = infoSpy.mock.calls[0]?.[0] as string;
      expect(output).toContain('jan@example.com');
      expect(output).toContain('secret');
    });

    it('outputs raw event.data unchanged in structured mode', () => {
      const provider = new ConsoleProvider({ prettyPrint: false, colorize: false });
      const event = makeEvent({ data: { email: 'jan@example.com', password: 'secret' } });

      provider.write(event);

      const output = infoSpy.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(output);
      expect(parsed.data.email).toBe('jan@example.com');
      expect(parsed.data.password).toBe('secret');
    });

    it('new ConsoleProvider() without options still works (no masker)', () => {
      const provider = new ConsoleProvider();
      const event = makeEvent({ data: { value: 'test' } });

      expect(() => provider.write(event)).not.toThrow();
    });
  });

  describe('masker provided — standalone use', () => {
    it('masks email by default regex in prettyPrint output', () => {
      const masker = new DataMasker();
      const provider = new ConsoleProvider({ prettyPrint: true, colorize: false, masker });
      const event = makeEvent({ data: { email: 'jan@example.com', name: 'Jan' } });

      provider.write(event);

      const output = infoSpy.mock.calls[0]?.[0] as string;
      expect(output).toContain('[MASKED]');
      expect(output).not.toContain('jan@example.com');
      expect(output).toContain('Jan');
    });

    it('masks sensitiveFields by key in prettyPrint output', () => {
      const masker = new DataMasker({ sensitiveKeys: ['password', 'token'] });
      const provider = new ConsoleProvider({ prettyPrint: true, colorize: false, masker });
      const event = makeEvent({ data: { password: 'secret123', token: 'Bearer xyz', name: 'Jan' } });

      provider.write(event);

      const output = infoSpy.mock.calls[0]?.[0] as string;
      expect(output).not.toContain('secret123');
      expect(output).not.toContain('Bearer xyz');
      expect(output).toContain('Jan');
    });

    it('masks email by default regex in structured (JSON) output', () => {
      const masker = new DataMasker();
      const provider = new ConsoleProvider({ prettyPrint: false, colorize: false, masker });
      const event = makeEvent({ data: { email: 'jan@example.com', role: 'admin' } });

      provider.write(event);

      const output = infoSpy.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(output);
      expect(parsed.data.email).toBe('[MASKED]');
      expect(parsed.data.role).toBe('admin');
    });

    it('masks sensitiveFields by key in structured (JSON) output', () => {
      const masker = new DataMasker({ sensitiveKeys: ['apiKey', 'secret'] });
      const provider = new ConsoleProvider({ prettyPrint: false, colorize: false, masker });
      const event = makeEvent({ data: { apiKey: 'key-abc', secret: 'top-secret', name: 'svc' } });

      provider.write(event);

      const output = infoSpy.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(output);
      expect(parsed.data.apiKey).toBe('[MASKED]');
      expect(parsed.data.secret).toBe('[MASKED]');
      expect(parsed.data.name).toBe('svc');
    });

    it('handles event without data gracefully when masker is set', () => {
      const masker = new DataMasker();
      const provider = new ConsoleProvider({ prettyPrint: true, colorize: false, masker });
      const event = makeEvent();

      expect(() => provider.write(event)).not.toThrow();
    });

    it('masks data for warn level', () => {
      const masker = new DataMasker({ sensitiveKeys: ['password'] });
      const provider = new ConsoleProvider({ prettyPrint: true, colorize: false, masker });
      const event = makeEvent({ level: 'warn', data: { password: 'secret' } });

      provider.write(event);

      const output = warnSpy.mock.calls[0]?.[0] as string;
      expect(output).toContain('[MASKED]');
      expect(output).not.toContain('secret');
    });
  });

  describe('masking applied once per write()', () => {
    it('does not mutate original event.data', () => {
      const masker = new DataMasker({ sensitiveKeys: ['password'] });
      const provider = new ConsoleProvider({ prettyPrint: true, colorize: false, masker });
      const originalData = { password: 'secret', name: 'Jan' };
      const event = makeEvent({ data: originalData });

      provider.write(event);

      expect(originalData.password).toBe('secret');
      expect(event.data?.['password']).toBe('secret');
    });
  });
});
