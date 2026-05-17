import { describe, it, expect } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import { EntityId, type IDomainEvent } from '@vytches/ddd-contracts';

import { AggregateRoot } from '../../src/core/aggregate-root';
import { AuditCapability } from '../../src/capabilities/audit-capability';
import type { IAggregateConstructorParams } from '../../src/aggregate-interfaces';

/**
 * Coverage tests for AuditCapability — see also
 * `aggregate-lifecycle.test.ts` for capability-composition smoke tests; this
 * file targets the per-method API surface that drives audit forensics.
 */

class Order extends AggregateRoot<string> {
  constructor(params: IAggregateConstructorParams<string>) {
    super(params);
    this.registerEventHandler('Created', () => undefined);
    this.registerEventHandler('Updated', () => undefined);
  }

  applyEvent(name: string, payload: unknown, metadata?: Record<string, unknown>): void {
    this.apply(name, payload, metadata);
  }
}

const newAuditedOrder = (): { order: Order; audit: AuditCapability } => {
  const order = new Order({ id: EntityId.create(), version: 0 });
  const audit = new AuditCapability();
  order.addCapability(audit);
  return { order, audit };
};

describe('AuditCapability — attach/detach', () => {
  it('attach() intercepts apply() so subsequent events are recorded', () => {
    const { order, audit } = newAuditedOrder();
    order.applyEvent('Created', { id: 'o-1' });
    expect(audit.getAuditLog()).toHaveLength(1);
    expect(audit.getAuditLog()[0]?.eventName).toBe('Created');
  });

  it('detach() restores the original apply() so subsequent events are NOT recorded', () => {
    const { order, audit } = newAuditedOrder();
    order.applyEvent('Created', { id: 'o-1' });
    audit.detach!();
    order.applyEvent('Updated', { changed: true });
    // detach() also clears the log
    expect(audit.getAuditLog()).toHaveLength(0);
  });

  it('attach() is a no-op when the target lacks an apply() method', () => {
    const audit = new AuditCapability();
    // Simulate a target without apply — should not throw
    const [error] = safeRun(() => audit.attach({} as unknown));
    expect(error).toBeUndefined();
  });
});

describe('AuditCapability — recording', () => {
  it('records aggregateId, aggregateType, version, payload, timestamp for each event', () => {
    const { order, audit } = newAuditedOrder();
    order.applyEvent('Created', { id: 'o-1' });
    const entry = audit.getAuditLog()[0]!;
    expect(entry.aggregateType).toBe('Order');
    expect(entry.aggregateVersion).toBe(1);
    expect(entry.payload).toEqual({ id: 'o-1' });
    expect(entry.timestamp).toBeInstanceOf(Date);
    expect(entry.aggregateId).toBeDefined();
  });

  it('extracts actor from metadata.userId when present', () => {
    const { order, audit } = newAuditedOrder();
    order.applyEvent('Created', { id: 'o-1' }, { userId: 'user-42' });
    expect(audit.getAuditLog()[0]?.actor).toBe('user-42');
  });

  it('actor is undefined when metadata.userId is absent', () => {
    const { order, audit } = newAuditedOrder();
    order.applyEvent('Created', { id: 'o-1' });
    expect(audit.getAuditLog()[0]?.actor).toBeUndefined();
  });

  it('attaches auditCapability: true to metadata', () => {
    const { order, audit } = newAuditedOrder();
    order.applyEvent('Created', { id: 'o-1' });
    expect(audit.getAuditLog()[0]?.metadata).toMatchObject({ auditCapability: true });
  });

  it('uses metadata.eventId as eventId when available', () => {
    const { order, audit } = newAuditedOrder();
    order.applyEvent('Created', { id: 'o-1' }, { eventId: 'evt-explicit' });
    expect(audit.getAuditLog()[0]?.eventId).toBe('evt-explicit');
  });

  it('fabricates an audit-prefixed eventId when domain event has none', () => {
    // recordEvent() bypasses apply() interception, so we can hand-craft an
    // event without metadata.eventId to exercise the fallback branch.
    const { audit } = newAuditedOrder();
    const event: IDomainEvent = {
      eventName: 'NoIdEvent',
      payload: {},
      metadata: {},
    } as unknown as IDomainEvent;
    audit.recordEvent(event);
    expect(audit.getAuditLog()[0]?.eventId).toMatch(/^audit-\d+-/);
  });

  it('recordEvent(event) records arbitrary domain events outside apply() flow', () => {
    const { audit } = newAuditedOrder();
    const event: IDomainEvent = {
      eventName: 'ManualEvent',
      payload: { foo: 'bar' },
      metadata: { eventId: 'manual-1' },
    } as unknown as IDomainEvent;
    audit.recordEvent(event);
    expect(audit.getAuditLog()).toHaveLength(1);
    expect(audit.getAuditLog()[0]?.eventName).toBe('ManualEvent');
  });
});

describe('AuditCapability — getAuditLog returns a defensive copy', () => {
  it('mutating the returned array does not affect internal state', () => {
    const { order, audit } = newAuditedOrder();
    order.applyEvent('Created', { id: 'o-1' });
    const log = audit.getAuditLog();
    log.length = 0;
    expect(audit.getAuditLog()).toHaveLength(1);
  });
});

describe('AuditCapability — clearAuditLog', () => {
  it('removes all entries', () => {
    const { order, audit } = newAuditedOrder();
    order.applyEvent('Created', { id: 'o-1' });
    order.applyEvent('Updated', { changed: true });
    expect(audit.getAuditLog()).toHaveLength(2);
    audit.clearAuditLog();
    expect(audit.getAuditLog()).toHaveLength(0);
  });
});

describe('AuditCapability — getAuditStatistics', () => {
  it('returns zero stats when log is empty', () => {
    const { audit } = newAuditedOrder();
    expect(audit.getAuditStatistics()).toEqual({
      totalEvents: 0,
      eventsByType: {},
      averageTimeBetweenEvents: 0,
    });
  });

  it('counts events by name', () => {
    const { order, audit } = newAuditedOrder();
    order.applyEvent('Created', {});
    order.applyEvent('Updated', {});
    order.applyEvent('Updated', {});
    const stats = audit.getAuditStatistics();
    expect(stats.totalEvents).toBe(3);
    expect(stats.eventsByType).toEqual({ Created: 1, Updated: 2 });
  });

  it('averageTimeBetweenEvents is 0 when there is only one event', () => {
    const { order, audit } = newAuditedOrder();
    order.applyEvent('Created', {});
    expect(audit.getAuditStatistics().averageTimeBetweenEvents).toBe(0);
  });

  it('averageTimeBetweenEvents is computed across multiple events (≥0)', () => {
    const { order, audit } = newAuditedOrder();
    order.applyEvent('Created', {});
    order.applyEvent('Updated', {});
    order.applyEvent('Updated', {});
    expect(audit.getAuditStatistics().averageTimeBetweenEvents).toBeGreaterThanOrEqual(0);
  });
});

describe('AuditCapability — querying', () => {
  it('getEventsByName filters by eventName', () => {
    const { order, audit } = newAuditedOrder();
    order.applyEvent('Created', {});
    order.applyEvent('Updated', {});
    order.applyEvent('Updated', {});
    expect(audit.getEventsByName('Created')).toHaveLength(1);
    expect(audit.getEventsByName('Updated')).toHaveLength(2);
    expect(audit.getEventsByName('Missing')).toHaveLength(0);
  });

  it('getEventsByTimeRange filters by timestamp range', () => {
    const { audit } = newAuditedOrder();
    const t0 = new Date('2026-01-01T00:00:00Z');
    const t1 = new Date('2026-01-01T01:00:00Z');
    const t2 = new Date('2026-01-01T02:00:00Z');
    audit.recordEvent({
      eventName: 'A',
      payload: {},
      metadata: { eventId: '1' },
    } as unknown as IDomainEvent);
    audit.recordEvent({
      eventName: 'B',
      payload: {},
      metadata: { eventId: '2' },
    } as unknown as IDomainEvent);
    // Override timestamps post-hoc to make the test deterministic
    const log = audit.getAuditLog();
    audit.clearAuditLog();
    audit['auditLog' as never] = [
      { ...log[0], timestamp: t0 },
      { ...log[1], timestamp: t2 },
    ] as never;

    expect(audit.getEventsByTimeRange(t0, t1)).toHaveLength(1);
    expect(audit.getEventsByTimeRange(t0, t2)).toHaveLength(2);
  });

  it('getFirstEvent / getLastEvent return null for empty log, then first/last entries', () => {
    const { order, audit } = newAuditedOrder();
    expect(audit.getFirstEvent()).toBeNull();
    expect(audit.getLastEvent()).toBeNull();

    order.applyEvent('Created', { id: '1' });
    order.applyEvent('Updated', { changed: true });
    expect(audit.getFirstEvent()?.eventName).toBe('Created');
    expect(audit.getLastEvent()?.eventName).toBe('Updated');
  });
});

describe('AuditCapability — type metadata', () => {
  it('exposes type "audit" on instance and capabilityType on class', () => {
    expect(new AuditCapability().type).toBe('audit');
    expect(AuditCapability.capabilityType).toBe('audit');
  });
});
