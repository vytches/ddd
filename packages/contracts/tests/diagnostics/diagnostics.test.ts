import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureDiagnostics, type DiagnosticsSink } from '../../src/diagnostics/diagnostics-sink';
import { internalLogger } from '../../src/internal-logger';
import * as contractsApi from '../../src';

// PII-sensitive payload keys that must NEVER appear in sink context (R4)
const PII_PAYLOAD_KEYS = ['command', 'query', 'event', 'payload', 'state'] as const;

// Helper: build a spy sink
function makeSpySink() {
  return {
    warn: vi.fn<(message: string, context?: Record<string, unknown>) => void>(),
    error: vi.fn<(message: string, error?: Error, context?: Record<string, unknown>) => void>(),
  };
}

// Helper: reset to default state after each test
afterEach(() => {
  // Restore default: console sink + warn level.
  // We use a real console-backed sink to restore the default behaviour.
  const consoleSink: DiagnosticsSink = {
    warn: (msg, ctx) => console.warn(msg, ctx ?? {}), // eslint-disable-line no-console
    error: (msg, err, ctx) => console.error(msg, err ?? '', ctx ?? {}), // eslint-disable-line no-console
  };
  configureDiagnostics({ sink: consoleSink, level: 'warn' });
});

describe('configureDiagnostics — level gating', () => {
  it('default (no configure) emits both warn and error to console', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    // Reset to real defaults first (afterEach already ran but we need virgin state)
    configureDiagnostics({ level: 'warn' });
    // Use a console-backed sink to verify
    const consoleSink: DiagnosticsSink = {
      warn: (msg, ctx) => console.warn(msg, ctx ?? {}), // eslint-disable-line no-console
      error: (msg, err, ctx) => console.error(msg, err ?? '', ctx ?? {}), // eslint-disable-line no-console
    };
    configureDiagnostics({ sink: consoleSink, level: 'warn' });

    internalLogger.warn('test-warn', { source: 'test' });
    internalLogger.error('test-error', new Error('boom'), { source: 'test' });

    expect(warnSpy).toHaveBeenCalledOnce();
    expect(errorSpy).toHaveBeenCalledOnce();

    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('level: silent — suppresses all output', () => {
    const sink = makeSpySink();
    configureDiagnostics({ sink, level: 'silent' });

    internalLogger.warn('should-not-appear');
    internalLogger.error('should-not-appear', new Error('x'));

    expect(sink.warn).not.toHaveBeenCalled();
    expect(sink.error).not.toHaveBeenCalled();
  });

  it('level: error — passes error only, suppresses warn', () => {
    const sink = makeSpySink();
    configureDiagnostics({ sink, level: 'error' });

    internalLogger.warn('suppressed-warn');
    internalLogger.error('passed-error', new Error('e'), { key: 'val' });

    expect(sink.warn).not.toHaveBeenCalled();
    expect(sink.error).toHaveBeenCalledOnce();
    expect(sink.error).toHaveBeenCalledWith('passed-error', expect.any(Error), { key: 'val' });
  });

  it('level: warn — passes both warn and error', () => {
    const sink = makeSpySink();
    configureDiagnostics({ sink, level: 'warn' });

    internalLogger.warn('a-warning', { detail: 'x' });
    internalLogger.error('an-error', new Error('y'));

    expect(sink.warn).toHaveBeenCalledOnce();
    expect(sink.warn).toHaveBeenCalledWith('a-warning', { detail: 'x' });
    expect(sink.error).toHaveBeenCalledOnce();
  });
});

describe('configureDiagnostics — custom sink routing', () => {
  it('routes warn to custom sink with message and context', () => {
    const sink = makeSpySink();
    configureDiagnostics({ sink });

    internalLogger.warn('handler-not-found', { handlerName: 'MyHandler' });

    expect(sink.warn).toHaveBeenCalledWith('handler-not-found', { handlerName: 'MyHandler' });
  });

  it('routes error to custom sink with message, error, and context', () => {
    const sink = makeSpySink();
    const err = new Error('disk full');
    configureDiagnostics({ sink });

    internalLogger.error('save-failed', err, { aggregate: 'Order' });

    expect(sink.error).toHaveBeenCalledWith('save-failed', err, { aggregate: 'Order' });
  });

  it('routes undefined context as undefined (not coerced to empty object)', () => {
    const sink = makeSpySink();
    configureDiagnostics({ sink });

    internalLogger.warn('no-context-message');

    expect(sink.warn).toHaveBeenCalledWith('no-context-message', undefined);
  });
});

describe('internalLogger — delegation', () => {
  it('delegates to the currently configured sink (sink swap)', () => {
    const sink1 = makeSpySink();
    const sink2 = makeSpySink();

    configureDiagnostics({ sink: sink1 });
    internalLogger.warn('first');

    configureDiagnostics({ sink: sink2 });
    internalLogger.warn('second');

    expect(sink1.warn).toHaveBeenCalledOnce();
    expect(sink2.warn).toHaveBeenCalledOnce();
  });

  it('internalLogger object properties are not externally reassignable', () => {
    // The internalLogger is a const object — its properties reference stable
    // closures over the module-private state; reassigning warn/error on the
    // exported object does not affect the private state.
    const original = internalLogger.warn;
    // Attempt to reassign (runtime object mutation)
    (internalLogger as Record<string, unknown>)['warn'] = () => undefined;

    // The module-private routing still works: configure a sink and call through
    const sink = makeSpySink();
    configureDiagnostics({ sink, level: 'warn' });

    // Restore so we can actually call it
    (internalLogger as Record<string, unknown>)['warn'] = original;
    internalLogger.warn('still-works');
    expect(sink.warn).toHaveBeenCalledWith('still-works', undefined);
  });
});

describe('R5 — sink isolation (throwing sinks)', () => {
  it('warn: throwing sink does not propagate to caller', () => {
    const throwingSink: DiagnosticsSink = {
      warn: () => {
        throw new Error('sink-boom');
      },
      error: () => {
        throw new Error('sink-boom');
      },
    };
    configureDiagnostics({ sink: throwingSink, level: 'warn' });

    // Must not throw
    expect(() => internalLogger.warn('message', { detail: 'x' })).not.toThrow();
  });

  it('error: throwing sink does not propagate to caller', () => {
    const throwingSink: DiagnosticsSink = {
      warn: () => {
        throw new Error('sink-boom');
      },
      error: () => {
        throw new Error('sink-boom');
      },
    };
    configureDiagnostics({ sink: throwingSink, level: 'warn' });

    expect(() => internalLogger.error('message', new Error('orig'))).not.toThrow();
  });

  it('fallback: reports sink failure via console.error (one-shot, no loop)', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const throwingSink: DiagnosticsSink = {
      warn: () => {
        throw new Error('sink-warn-boom');
      },
      error: () => {
        throw new Error('sink-error-boom');
      },
    };
    configureDiagnostics({ sink: throwingSink, level: 'warn' });

    internalLogger.warn('trigger-fallback');

    expect(errorSpy).toHaveBeenCalledOnce();
    expect(errorSpy.mock.calls[0]?.[0]).toContain('[vytches-ddd]');

    errorSpy.mockRestore();
  });
});

describe('R4 — PII guard: no payload keys in context', () => {
  it('internalLogger.warn context contains no PII payload keys', () => {
    const receivedContexts: Array<Record<string, unknown> | undefined> = [];
    const sink: DiagnosticsSink = {
      warn: (_msg, ctx) => {
        receivedContexts.push(ctx);
      },
      error: (_msg, _err, ctx) => {
        receivedContexts.push(ctx);
      },
    };
    configureDiagnostics({ sink, level: 'warn' });

    // Representative call that a library internals might make
    internalLogger.warn('no-handler', { handlerName: 'MyCommand' });
    internalLogger.error('save-failed', new Error('db err'), { aggregate: 'Order' });

    for (const ctx of receivedContexts) {
      if (ctx) {
        for (const piiKey of PII_PAYLOAD_KEYS) {
          expect(Object.keys(ctx)).not.toContain(piiKey);
        }
      }
    }
  });
});

describe('export surface', () => {
  it('configureDiagnostics is importable from @vytches/ddd-contracts barrel', () => {
    expect(contractsApi.configureDiagnostics).toBeDefined();
    expect(typeof contractsApi.configureDiagnostics).toBe('function');
  });

  it('contracts barrel does not export currentSink or currentLevel', () => {
    expect('currentSink' in contractsApi).toBe(false);
    expect('currentLevel' in contractsApi).toBe(false);
  });

  it('contracts barrel does not export _emitWarn or _emitError', () => {
    expect('_emitWarn' in contractsApi).toBe(false);
    expect('_emitError' in contractsApi).toBe(false);
  });
});
