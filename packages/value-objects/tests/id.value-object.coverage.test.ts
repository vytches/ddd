import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import { InvalidParameterError, MissingValueError } from '@vytches/ddd-domain-primitives';

import { EntityId, EntityIdFactory } from '../src/id.value-object';

/**
 * Coverage gap-fill for `id.value-object.ts`.
 *
 * The existing `id.value-object.spec.ts` covers throwing factories and
 * `result-factories.spec.ts` covers `tryFrom*`. Untested surface remaining:
 *
 *   - `EntityIdFactory` deprecated class (~90 statements, static + instance)
 *
 * EntityIdFactory will be removed in v1.0.0 but must keep working until then,
 * including emitting a one-time deprecation warning per method per process.
 */

describe('EntityIdFactory (deprecated) — static methods', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('createWithRandomUUID delegates to EntityId.create()', () => {
    const id = EntityIdFactory.createWithRandomUUID();
    expect(id).toBeInstanceOf(EntityId);
    expect(id.getType()).toBe('uuid');
  });

  it('fromUUID returns EntityId for valid UUID', () => {
    const id = EntityIdFactory.fromUUID('550e8400-e29b-41d4-a716-446655440000');
    expect(id.getType()).toBe('uuid');
    expect(id.value).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('fromUUID throws MissingValueError for empty string', () => {
    const [error] = safeRun(() => EntityIdFactory.fromUUID(''));
    expect(error).toBeInstanceOf(MissingValueError);
  });

  it('fromUUID throws InvalidParameterError for malformed UUID', () => {
    const [error] = safeRun(() => EntityIdFactory.fromUUID('bad'));
    expect(error).toBeInstanceOf(InvalidParameterError);
  });

  it('fromInteger returns EntityId for valid integer', () => {
    const id = EntityIdFactory.fromInteger(7);
    expect(id.value).toBe('7');
  });

  it('fromInteger throws InvalidParameterError for negative', () => {
    const [error] = safeRun(() => EntityIdFactory.fromInteger(-1));
    expect(error).toBeInstanceOf(InvalidParameterError);
  });

  it('fromBigInt returns EntityId for valid bigint string', () => {
    const id = EntityIdFactory.fromBigInt('12345678901234567890');
    expect(id.value).toBe('12345678901234567890');
  });

  it('fromBigInt throws for non-numeric input', () => {
    const [error] = safeRun(() => EntityIdFactory.fromBigInt('not-a-bigint'));
    expect(error).toBeInstanceOf(InvalidParameterError);
  });

  it('fromText returns EntityId for valid text id', () => {
    const id = EntityIdFactory.fromText('user-1');
    expect(id.value).toBe('user-1');
  });

  it('fromText throws MissingValueError for empty', () => {
    const [error] = safeRun(() => EntityIdFactory.fromText(''));
    expect(error).toBeInstanceOf(MissingValueError);
  });

  it('fromText throws InvalidParameterError for invalid chars', () => {
    const [error] = safeRun(() => EntityIdFactory.fromText('id with spaces'));
    expect(error).toBeInstanceOf(InvalidParameterError);
  });

  it('emits at most one deprecation warning per method per process', () => {
    EntityIdFactory.createWithRandomUUID();
    EntityIdFactory.createWithRandomUUID();
    EntityIdFactory.createWithRandomUUID();
    // The contract is "at most once" per process — exact count depends on
    // test order across the file (warning state is module-scoped).
    const calls = warnSpy.mock.calls.filter((args: unknown[]) =>
      String(args[0] ?? '').includes('createWithRandomUUID')
    );
    expect(calls.length).toBeLessThanOrEqual(1);
  });
});

describe('EntityIdFactory (deprecated) — instance methods', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('instance createWithRandomUUID returns an EntityId', () => {
    const factory = new EntityIdFactory();
    expect(factory.createWithRandomUUID()).toBeInstanceOf(EntityId);
  });

  it('instance fromUUID delegates to static fromUUID', () => {
    const factory = new EntityIdFactory();
    const id = factory.fromUUID('550e8400-e29b-41d4-a716-446655440000');
    expect(id.value).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('instance fromInteger delegates', () => {
    const factory = new EntityIdFactory();
    expect(factory.fromInteger(99).value).toBe('99');
  });

  it('instance fromBigInt delegates', () => {
    const factory = new EntityIdFactory();
    expect(factory.fromBigInt('123').value).toBe('123');
  });

  it('instance fromText delegates', () => {
    const factory = new EntityIdFactory();
    expect(factory.fromText('order-9').value).toBe('order-9');
  });
});
