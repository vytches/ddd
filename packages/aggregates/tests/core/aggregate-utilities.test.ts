import { describe, it, expect } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import { EntityId, type IDomainEvent } from '@vytches/ddd-contracts';

import { AggregateRoot } from '../../src/core/aggregate-root';
import { AuditCapability } from '../../src/capabilities/audit-capability';
import { SnapshotCapability } from '../../src/capabilities/snapshot-capability';
import { VersioningCapability } from '../../src/capabilities/versioning-capability';
import { EventSourcingCapability } from '../../src/capabilities/event-sourcing-capability';
import {
  hasSnapshotCapability,
  hasVersioningCapability,
  hasAuditCapability,
  hasEventSourcingCapability,
  asSnapshotAggregate,
  asVersioningAggregate,
  asAuditAggregate,
  asEventSourcingAggregate,
  tryAsSnapshotAggregate,
  tryAsVersioningAggregate,
  tryAsAuditAggregate,
  tryAsEventSourcingAggregate,
  getAggregateCapabilities,
  hasAllCapabilities,
  hasAnyCapability,
  getAggregateInfo,
  createSnapshotIfCapable,
  restoreFromSnapshotIfCapable,
  getAuditLogIfCapable,
  getAuditStatsIfCapable,
  loadFromEventStoreIfCapable,
  saveToEventStoreIfCapable,
  registerUpcasterIfCapable,
  getVersioningInfoIfCapable,
  processAggregatesWithCapabilities,
  cloneAggregateCapabilities,
} from '../../src/core/aggregate-utilities';
import type { IAggregateConstructorParams } from '../../src/aggregate-interfaces';
import { AggregateError } from '../../src/aggregate-errors';

/**
 * Test fixture aggregate. Mirrors the canonical pattern from
 * `aggregate-lifecycle.test.ts` so each utility function can be exercised
 * against a real AggregateRoot instance with controlled capability composition.
 */
class TestAggregate extends AggregateRoot<string> {
  constructor(params: IAggregateConstructorParams<string>) {
    super(params);
    this.registerEventHandler<{ name: string }>('Created', () => {
      // no-op handler for test events
    });
  }

  applyEvent(name: string, payload: unknown, metadata?: Record<string, unknown>): void {
    this.apply(name, payload, metadata);
  }

  loadHistory(events: IDomainEvent[]): void {
    this.loadFromHistory(events);
  }
}

const newAggregate = (capabilities: Array<() => unknown> = []): TestAggregate => {
  const aggregate = new TestAggregate({ id: EntityId.create(), version: 0 });
  for (const factory of capabilities) {
    aggregate.addCapability(factory() as never);
  }
  return aggregate;
};

describe('aggregate-utilities — type guards', () => {
  it('hasSnapshotCapability is true only when SnapshotCapability is registered', () => {
    expect(hasSnapshotCapability(newAggregate())).toBe(false);
    expect(hasSnapshotCapability(newAggregate([() => new SnapshotCapability()]))).toBe(true);
  });

  it('hasVersioningCapability is true only when VersioningCapability is registered', () => {
    expect(hasVersioningCapability(newAggregate())).toBe(false);
    expect(hasVersioningCapability(newAggregate([() => new VersioningCapability()]))).toBe(true);
  });

  it('hasAuditCapability is true only when AuditCapability is registered', () => {
    expect(hasAuditCapability(newAggregate())).toBe(false);
    expect(hasAuditCapability(newAggregate([() => new AuditCapability()]))).toBe(true);
  });

  it('hasEventSourcingCapability is true only when EventSourcingCapability is registered', () => {
    expect(hasEventSourcingCapability(newAggregate())).toBe(false);
    expect(hasEventSourcingCapability(newAggregate([() => new EventSourcingCapability()]))).toBe(
      true
    );
  });
});

describe('aggregate-utilities — throwing casts', () => {
  it('asSnapshotAggregate throws AggregateError when capability is missing', () => {
    const [error] = safeRun(() => asSnapshotAggregate(newAggregate()));
    expect(error).toBeInstanceOf(AggregateError);
    expect(error?.message).toContain('snapshot');
  });

  it('asSnapshotAggregate returns the aggregate when capability is present', () => {
    const aggregate = newAggregate([() => new SnapshotCapability()]);
    expect(asSnapshotAggregate(aggregate)).toBe(aggregate);
  });

  it('asVersioningAggregate throws when capability is missing, returns aggregate when present', () => {
    const [error] = safeRun(() => asVersioningAggregate(newAggregate()));
    expect(error).toBeInstanceOf(AggregateError);

    const aggregate = newAggregate([() => new VersioningCapability()]);
    expect(asVersioningAggregate(aggregate)).toBe(aggregate);
  });

  it('asAuditAggregate throws when capability is missing, returns aggregate when present', () => {
    const [error] = safeRun(() => asAuditAggregate(newAggregate()));
    expect(error).toBeInstanceOf(AggregateError);

    const aggregate = newAggregate([() => new AuditCapability()]);
    expect(asAuditAggregate(aggregate)).toBe(aggregate);
  });

  it('asEventSourcingAggregate throws when capability is missing, returns aggregate when present', () => {
    const [error] = safeRun(() => asEventSourcingAggregate(newAggregate()));
    expect(error).toBeInstanceOf(AggregateError);

    const aggregate = newAggregate([() => new EventSourcingCapability()]);
    expect(asEventSourcingAggregate(aggregate)).toBe(aggregate);
  });
});

describe('aggregate-utilities — Result-based casts', () => {
  it('tryAsSnapshotAggregate returns Result.fail when missing, Result.ok when present', () => {
    const failResult = tryAsSnapshotAggregate(newAggregate());
    expect(failResult.isFailure).toBe(true);

    const aggregate = newAggregate([() => new SnapshotCapability()]);
    const okResult = tryAsSnapshotAggregate(aggregate);
    expect(okResult.isSuccess).toBe(true);
  });

  it('tryAsVersioningAggregate returns Result.fail when missing, Result.ok when present', () => {
    expect(tryAsVersioningAggregate(newAggregate()).isFailure).toBe(true);
    expect(
      tryAsVersioningAggregate(newAggregate([() => new VersioningCapability()])).isSuccess
    ).toBe(true);
  });

  it('tryAsAuditAggregate returns Result.fail when missing, Result.ok when present', () => {
    expect(tryAsAuditAggregate(newAggregate()).isFailure).toBe(true);
    expect(tryAsAuditAggregate(newAggregate([() => new AuditCapability()])).isSuccess).toBe(true);
  });

  it('tryAsEventSourcingAggregate returns Result.fail when missing, Result.ok when present', () => {
    expect(tryAsEventSourcingAggregate(newAggregate()).isFailure).toBe(true);
    expect(
      tryAsEventSourcingAggregate(newAggregate([() => new EventSourcingCapability()])).isSuccess
    ).toBe(true);
  });
});

describe('aggregate-utilities — capability inspection', () => {
  it('getAggregateCapabilities returns the list of registered capability type names', () => {
    const aggregate = newAggregate([() => new SnapshotCapability(), () => new AuditCapability()]);
    const types = getAggregateCapabilities(aggregate);
    // Capability.getType() convention: lowercase short name (e.g. "snapshot", "audit")
    expect(types).toHaveLength(2);
    expect(types).toEqual(expect.arrayContaining([expect.any(String)]));
  });

  it('hasAllCapabilities returns true only when every capability is present', () => {
    const aggregate = newAggregate([() => new SnapshotCapability(), () => new AuditCapability()]);
    expect(hasAllCapabilities(aggregate, [SnapshotCapability])).toBe(true);
    expect(hasAllCapabilities(aggregate, [AuditCapability])).toBe(true);
    expect(hasAllCapabilities(aggregate, [VersioningCapability])).toBe(false);
  });

  it('hasAnyCapability returns true if at least one capability is present', () => {
    const aggregate = newAggregate([() => new SnapshotCapability()]);
    expect(hasAnyCapability(aggregate, [SnapshotCapability])).toBe(true);
    expect(hasAnyCapability(aggregate, [VersioningCapability])).toBe(false);
  });

  it('getAggregateInfo returns id, type, version, hasChanges, capabilities, events', () => {
    const aggregate = newAggregate([() => new AuditCapability()]);
    aggregate.applyEvent('Created', { name: 'test' });
    const info = getAggregateInfo(aggregate);
    expect(info).toMatchObject({
      type: 'TestAggregate',
      version: 1,
      hasChanges: true,
      events: 1,
    });
    expect(info.capabilities).toHaveLength(1);
    expect(info.id).toBeDefined();
  });
});

describe('aggregate-utilities — snapshot helpers', () => {
  it('createSnapshotIfCapable returns null when capability is missing', () => {
    const result = createSnapshotIfCapable(newAggregate(), () => ({ data: 'state' }));
    expect(result).toBeNull();
  });

  it('createSnapshotIfCapable returns a snapshot when capability is present', () => {
    const aggregate = newAggregate([() => new SnapshotCapability()]);
    aggregate.applyEvent('Created', { name: 'test' });
    const snapshot = createSnapshotIfCapable(aggregate, () => ({ data: 'state' }));
    expect(snapshot).not.toBeNull();
  });

  it('createSnapshotIfCapable accepts an optional metadataCreator', () => {
    const aggregate = newAggregate([() => new SnapshotCapability()]);
    aggregate.applyEvent('Created', { name: 'test' });
    const snapshot = createSnapshotIfCapable(
      aggregate,
      () => ({ data: 'state' }),
      () => ({ author: 'test' })
    );
    expect(snapshot).not.toBeNull();
  });

  it('restoreFromSnapshotIfCapable returns false when capability is missing', () => {
    const result = restoreFromSnapshotIfCapable(
      newAggregate(),
      {
        aggregateId: 'x',
        aggregateType: 'TestAggregate',
        version: 1,
        state: {},
        metadata: {},
        timestamp: new Date(),
      },
      () => undefined
    );
    expect(result).toBe(false);
  });

  it('restoreFromSnapshotIfCapable returns true when capability is present', () => {
    const sharedId = EntityId.create();
    const source = new TestAggregate({ id: sharedId, version: 0 });
    source.addCapability(new SnapshotCapability());
    source.applyEvent('Created', { name: 'test' });
    const snapshot = createSnapshotIfCapable(source, () => ({ value: 1 }));

    // Restore into a fresh aggregate with the SAME id (snapshot ID-match invariant)
    const target = new TestAggregate({ id: sharedId, version: 0 });
    target.addCapability(new SnapshotCapability());
    const restored = restoreFromSnapshotIfCapable(target, snapshot as never, () => undefined);
    expect(restored).toBe(true);
  });
});

describe('aggregate-utilities — audit helpers', () => {
  it('getAuditLogIfCapable returns [] when capability is missing', () => {
    expect(getAuditLogIfCapable(newAggregate())).toEqual([]);
  });

  it('getAuditLogIfCapable returns audit entries when capability is present', () => {
    const aggregate = newAggregate([() => new AuditCapability()]);
    aggregate.applyEvent('Created', { name: 'test' });
    const log = getAuditLogIfCapable(aggregate);
    expect(Array.isArray(log)).toBe(true);
  });

  it('getAuditStatsIfCapable returns null when capability is missing', () => {
    expect(getAuditStatsIfCapable(newAggregate())).toBeNull();
  });

  it('getAuditStatsIfCapable returns stats object when capability is present', () => {
    const aggregate = newAggregate([() => new AuditCapability()]);
    aggregate.applyEvent('Created', { name: 'test' });
    expect(getAuditStatsIfCapable(aggregate)).not.toBeNull();
  });
});

describe('aggregate-utilities — event sourcing helpers', () => {
  it('loadFromEventStoreIfCapable returns false when capability is missing', async () => {
    expect(await loadFromEventStoreIfCapable(newAggregate(), 'agg-1')).toBe(false);
  });

  it('saveToEventStoreIfCapable returns false when capability is missing', async () => {
    expect(await saveToEventStoreIfCapable(newAggregate())).toBe(false);
  });
});

describe('aggregate-utilities — versioning helpers', () => {
  it('registerUpcasterIfCapable returns false when capability is missing', () => {
    const upcaster = { upcast: <T>(p: T): T => p };
    expect(registerUpcasterIfCapable(newAggregate(), 'OrderCreated', 1, upcaster)).toBe(false);
  });

  it('registerUpcasterIfCapable returns true when capability is present', () => {
    const aggregate = newAggregate([() => new VersioningCapability()]);
    const upcaster = { upcast: <T>(p: T): T => p };
    expect(registerUpcasterIfCapable(aggregate, 'OrderCreated', 1, upcaster)).toBe(true);
  });

  it('getVersioningInfoIfCapable returns null when capability is missing', () => {
    expect(getVersioningInfoIfCapable(newAggregate())).toBeNull();
  });

  it('getVersioningInfoIfCapable returns info object with registeredEventTypes when capability is present', () => {
    const aggregate = newAggregate([() => new VersioningCapability()]);
    const info = getVersioningInfoIfCapable(aggregate) as { registeredEventTypes: string[] } | null;
    expect(info).not.toBeNull();
    expect(Array.isArray(info?.registeredEventTypes)).toBe(true);
  });
});

describe('aggregate-utilities — bulk operations', () => {
  it('processAggregatesWithCapabilities invokes the matching processor for each aggregate', async () => {
    const calls: string[] = [];
    const aggregates = [
      newAggregate([() => new SnapshotCapability()]),
      newAggregate([() => new AuditCapability()]),
      newAggregate(),
    ];

    await processAggregatesWithCapabilities(aggregates, {
      snapshot: () => calls.push('snapshot'),
      audit: () => calls.push('audit'),
    });

    expect(calls).toEqual(['snapshot', 'audit']);
  });

  it('processAggregatesWithCapabilities invokes versioning and async eventSourcing processors', async () => {
    const calls: string[] = [];
    const aggregates = [
      newAggregate([() => new VersioningCapability()]),
      newAggregate([() => new EventSourcingCapability()]),
    ];

    await processAggregatesWithCapabilities(aggregates, {
      versioning: () => calls.push('versioning'),
      eventSourcing: async () => {
        calls.push('eventSourcing');
      },
    });

    expect(calls).toContain('versioning');
    expect(calls).toContain('eventSourcing');
  });

  it('processAggregatesWithCapabilities skips aggregates without matching capability', async () => {
    const calls: string[] = [];
    await processAggregatesWithCapabilities([newAggregate()], {
      snapshot: () => calls.push('snapshot'),
      audit: () => calls.push('audit'),
      versioning: () => calls.push('versioning'),
      eventSourcing: async () => {
        calls.push('eventSourcing');
      },
    });
    expect(calls).toEqual([]);
  });

  it('cloneAggregateCapabilities copies enabled capabilities by default', () => {
    const source = newAggregate([
      () => new SnapshotCapability(),
      () => new AuditCapability(),
      () => new VersioningCapability(),
      () => new EventSourcingCapability(),
    ]);
    const target = newAggregate();

    cloneAggregateCapabilities(source, target);

    expect(hasSnapshotCapability(target)).toBe(true);
    expect(hasAuditCapability(target)).toBe(true);
    expect(hasVersioningCapability(target)).toBe(true);
    expect(hasEventSourcingCapability(target)).toBe(true);
  });

  it('cloneAggregateCapabilities respects opt-out flags', () => {
    const source = newAggregate([() => new SnapshotCapability(), () => new AuditCapability()]);
    const target = newAggregate();

    cloneAggregateCapabilities(source, target, {
      includeSnapshot: false,
      includeAudit: true,
    });

    expect(hasSnapshotCapability(target)).toBe(false);
    expect(hasAuditCapability(target)).toBe(true);
  });

  it('cloneAggregateCapabilities does not copy capabilities the source lacks', () => {
    const source = newAggregate();
    const target = newAggregate();
    cloneAggregateCapabilities(source, target);
    expect(getAggregateCapabilities(target)).toEqual([]);
  });
});
