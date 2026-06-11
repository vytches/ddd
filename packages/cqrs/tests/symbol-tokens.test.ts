/**
 * TDD tests for Bug #3 — Symbol.for DI tokens for command/query bus.
 *
 * These tests verify that QUERY_BUS_TOKEN and COMMAND_BUS_TOKEN are exported
 * from @vytches/ddd-cqrs as stable Symbol.for() keys that survive dual-package
 * (ESM + CJS) loading.
 *
 * VP-009 Bug #3
 */
import { describe, it, expect } from 'vitest';

describe('Bug #3 — Symbol.for DI tokens (CT-5)', () => {
  it('exports QUERY_BUS_TOKEN from @vytches/ddd-cqrs', async () => {
    const api = await import('../src/index');
    expect(api).toHaveProperty('QUERY_BUS_TOKEN');
  });

  it('exports COMMAND_BUS_TOKEN from @vytches/ddd-cqrs', async () => {
    const api = await import('../src/index');
    expect(api).toHaveProperty('COMMAND_BUS_TOKEN');
  });

  it('QUERY_BUS_TOKEN is a Symbol created with Symbol.for (interning)', async () => {
    const { QUERY_BUS_TOKEN } = await import('../src/index');
    expect(typeof QUERY_BUS_TOKEN).toBe('symbol');
    // Symbol.for() returns the same reference from any module load
    expect(QUERY_BUS_TOKEN).toBe(Symbol.for('vytches:cqrs:query-bus'));
  });

  it('COMMAND_BUS_TOKEN is a Symbol created with Symbol.for (interning)', async () => {
    const { COMMAND_BUS_TOKEN } = await import('../src/index');
    expect(typeof COMMAND_BUS_TOKEN).toBe('symbol');
    expect(COMMAND_BUS_TOKEN).toBe(Symbol.for('vytches:cqrs:command-bus'));
  });

  it('tokens survive dual-package re-evaluation (same reference both times)', async () => {
    // Simulates ESM and CJS loading the same module independently — Symbol.for
    // guarantees the same symbol regardless of module instantiation count.
    const first = Symbol.for('vytches:cqrs:query-bus');
    const second = Symbol.for('vytches:cqrs:query-bus');
    expect(first).toBe(second);
  });
});
