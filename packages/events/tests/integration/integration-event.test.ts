import { describe, it, expect } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';

import {
  IntegrationEvent,
  MAX_DESERIALIZE_SIZE,
  MAX_SANITIZE_DEPTH,
  sanitizeIntegrationPayload,
  safeParseIntegrationJson,
} from '../../src/integration/integration-event';

interface OrderShippedPayload {
  orderId: string;
  trackingNumber: string;
}

class OrderShipped extends IntegrationEvent<OrderShippedPayload> {}

class EmptyPayload extends IntegrationEvent {}

describe('sanitizeIntegrationPayload — prototype-pollution defense', () => {
  it('strips __proto__, constructor, and prototype keys', () => {
    const dirty = {
      ok: 1,
      __proto__: { polluted: true },
      constructor: { evil: true },
      prototype: { also: true },
    } as Record<string, unknown>;
    const clean = sanitizeIntegrationPayload(dirty);
    expect((clean as Record<string, unknown>).ok).toBe(1);
    expect(Object.prototype.hasOwnProperty.call(clean, '__proto__')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(clean, 'constructor')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(clean, 'prototype')).toBe(false);
  });

  it('recurses into nested objects', () => {
    const dirty = {
      level1: { level2: { __proto__: { polluted: true }, ok: 'value' } },
    };
    const clean = sanitizeIntegrationPayload(dirty);
    const level2 = (clean.level1 as Record<string, unknown>).level2 as Record<string, unknown>;
    expect(level2.ok).toBe('value');
    expect(Object.prototype.hasOwnProperty.call(level2, '__proto__')).toBe(false);
  });

  it('returns primitives unchanged', () => {
    expect(sanitizeIntegrationPayload(42)).toBe(42);
    expect(sanitizeIntegrationPayload('hello')).toBe('hello');
    expect(sanitizeIntegrationPayload(null)).toBeNull();
    expect(sanitizeIntegrationPayload(true)).toBe(true);
  });

  it('preserves arrays as arrays', () => {
    const arr = [1, 2, { ok: 3 }];
    const clean = sanitizeIntegrationPayload(arr) as unknown[];
    expect(Array.isArray(clean)).toBe(true);
    expect(clean[2]).toEqual({ ok: 3 });
  });

  it('throws when nesting exceeds maxDepth', () => {
    // Build a 5-level deep object, with maxDepth=2
    const deep: Record<string, unknown> = { a: { b: { c: { d: { e: 1 } } } } };
    const [error] = safeRun(() => sanitizeIntegrationPayload(deep, 2));
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('maximum nesting depth');
  });

  it('respects custom maxDepth that is large enough', () => {
    const deep: Record<string, unknown> = { a: { b: { c: 'ok' } } };
    const [error, result] = safeRun(() => sanitizeIntegrationPayload(deep, 10));
    expect(error).toBeUndefined();
    expect(((result as Record<string, unknown>).a as Record<string, unknown>).b).toBeDefined();
  });
});

describe('safeParseIntegrationJson — size + depth caps', () => {
  it('parses and sanitizes a valid JSON string', () => {
    const result = safeParseIntegrationJson<{ ok: number }>('{"ok":1}');
    expect(result.ok).toBe(1);
  });

  it('strips prototype-pollution keys during parse', () => {
    const json = '{"ok":1,"__proto__":{"x":1}}';
    const result = safeParseIntegrationJson<Record<string, unknown>>(json);
    expect(Object.prototype.hasOwnProperty.call(result, '__proto__')).toBe(false);
    expect(result.ok).toBe(1);
  });

  it('throws when payload exceeds MAX_DESERIALIZE_SIZE bytes', () => {
    // Build a JSON payload >1MB. A 2 MB string of "a"s + small JSON wrapper.
    const big = 'a'.repeat(MAX_DESERIALIZE_SIZE + 1);
    const json = JSON.stringify({ data: big });
    const [error] = safeRun(() => safeParseIntegrationJson(json));
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('maximum size');
  });

  it('throws on invalid JSON', () => {
    const [error] = safeRun(() => safeParseIntegrationJson('{not json'));
    expect(error).toBeInstanceOf(Error);
  });

  it('exposes MAX_SANITIZE_DEPTH at module level', () => {
    expect(MAX_SANITIZE_DEPTH).toBeGreaterThan(0);
  });
});

describe('IntegrationEvent — construction', () => {
  it('assigns eventId, timestamp, eventName, payload, and metadata', () => {
    const event = new OrderShipped({ orderId: 'o-1', trackingNumber: 't-1' });
    expect(event.eventId).toMatch(/^[0-9a-f-]{36}$/);
    expect(event.timestamp).toBeInstanceOf(Date);
    expect(event.eventName).toBe('OrderShipped');
    expect(event.payload).toEqual({ orderId: 'o-1', trackingNumber: 't-1' });
    expect(event.metadata).toMatchObject({
      eventId: event.eventId,
      schemaVersion: 1,
    });
  });

  it('allows custom metadata to override defaults', () => {
    const event = new OrderShipped(
      { orderId: 'o-1', trackingNumber: 't-1' },
      { sourceContext: 'orders', schemaVersion: 2 }
    );
    expect(event.metadata?.sourceContext).toBe('orders');
    expect(event.metadata?.schemaVersion).toBe(2);
  });

  it('works without payload', () => {
    const event = new EmptyPayload();
    expect(event.payload).toBeUndefined();
    expect(event.metadata).toBeDefined();
  });

  it('eventId differs across instances', () => {
    const e1 = new EmptyPayload();
    const e2 = new EmptyPayload();
    expect(e1.eventId).not.toBe(e2.eventId);
  });
});

describe('IntegrationEvent — withMetadata', () => {
  it('returns a new instance with merged metadata', () => {
    const original = new OrderShipped(
      { orderId: 'o-1', trackingNumber: 't-1' },
      { sourceContext: 'orders' }
    );
    const enriched = original.withMetadata({ targetContext: 'shipping' });
    expect(enriched).not.toBe(original);
    expect(enriched.metadata?.sourceContext).toBe('orders');
    expect(enriched.metadata?.targetContext).toBe('shipping');
  });

  it('preserves payload through withMetadata', () => {
    const original = new OrderShipped({ orderId: 'o-1', trackingNumber: 't-1' });
    const enriched = original.withMetadata({ routingKey: 'orders.shipped' });
    expect(enriched.payload).toEqual(original.payload);
  });
});

describe('IntegrationEvent — serialize / deserialize', () => {
  it('serialize() returns a JSON string with eventName, payload, metadata', () => {
    const event = new OrderShipped({ orderId: 'o-1', trackingNumber: 't-1' });
    const json = event.serialize();
    const parsed = JSON.parse(json) as Record<string, unknown>;
    expect(parsed.eventName).toBe('OrderShipped');
    expect(parsed.payload).toEqual({ orderId: 'o-1', trackingNumber: 't-1' });
    expect(parsed.metadata).toBeDefined();
  });

  it('deserialize() reconstructs an event of the given class', () => {
    const original = new OrderShipped({ orderId: 'o-2', trackingNumber: 't-2' });
    const json = original.serialize();
    const reconstructed = IntegrationEvent.deserialize(OrderShipped, json);
    expect(reconstructed).toBeInstanceOf(OrderShipped);
    expect(reconstructed.payload).toEqual({ orderId: 'o-2', trackingNumber: 't-2' });
    expect(reconstructed.eventName).toBe('OrderShipped');
  });

  it('deserialize() rejects oversize payloads', () => {
    const big = 'x'.repeat(MAX_DESERIALIZE_SIZE + 1);
    const json = JSON.stringify({ payload: { trackingNumber: big } });
    const [error] = safeRun(() => IntegrationEvent.deserialize(OrderShipped, json));
    expect(error).toBeInstanceOf(Error);
  });
});
