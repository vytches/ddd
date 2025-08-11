import { EntityId } from '@vytches/ddd-contracts';
import { describe, expect, it } from 'vitest';
import { AggregateRoot } from '../src/core/aggregate-root';
import { aggregateBuilder } from '../src/core/aggregate-root.builder';

import { AuditCapability } from '../src/capabilities/audit-capability';
import { SnapshotCapability } from '../src/capabilities/snapshot-capability';
import { VersioningCapability } from '../src/capabilities/versioning-capability';
import {
  hasAuditCapability,
  hasSnapshotCapability,
  hasVersioningCapability,
} from '../src/core/aggregate-utilities';

class TestAggregate extends AggregateRoot<string> {
  private value = '';

  constructor(params: { id: EntityId<string>; version?: number }) {
    super(params);
  }

  setValue(newValue: string): void {
    this.value = newValue;
    this.apply('ValueChanged', { value: newValue });
  }

  getValue(): string {
    return this.value;
  }

  serialize() {
    return { value: this.value };
  }

  deserialize(state: { value: string }) {
    this.value = state.value;
  }
}

describe('Type-Safe Capability System', () => {
  it('should create aggregate with type-safe capabilities using builder', () => {
    const aggregate = aggregateBuilder({ id: 'test-123' })
      .withSnapshots()
      .withVersioning()
      .withAudit()
      .build(TestAggregate);

    expect(hasSnapshotCapability(aggregate)).toBe(true);
    expect(hasVersioningCapability(aggregate)).toBe(true);
    expect(hasAuditCapability(aggregate)).toBe(true);
  });

  it('should support type-safe capability access', () => {
    const aggregate = new TestAggregate({ id: new EntityId('test-456', 'text') });

    // Add capabilities using new type-safe API
    aggregate.addCapability(new SnapshotCapability());
    aggregate.addCapability(new VersioningCapability());

    // Type-safe access
    const snapshotCap = aggregate.getCapability(SnapshotCapability);
    const versioningCap = aggregate.getCapability(VersioningCapability);

    expect(snapshotCap).toBeInstanceOf(SnapshotCapability);
    expect(versioningCap).toBeInstanceOf(VersioningCapability);
  });

  it('should work with snapshot capability', () => {
    const aggregate = aggregateBuilder({ id: 'test-789' }).withSnapshots().build(TestAggregate);

    aggregate.setValue('hello world');

    if (hasSnapshotCapability(aggregate)) {
      const snapshotCap = aggregate.getCapability(SnapshotCapability)!;
      const snapshot = snapshotCap.createSnapshot(() => aggregate.serialize());

      expect(snapshot.aggregateId).toBe('test-789');
      expect(snapshot.state).toEqual({ value: 'hello world' });
      expect(snapshot.aggregateType).toBe('TestAggregate');
    } else {
      throw new Error('Should have snapshot capability');
    }
  });

  it('should work with versioning capability', () => {
    const aggregate = aggregateBuilder({ id: 'test-version' })
      .withVersioning()
      .build(TestAggregate);

    if (hasVersioningCapability(aggregate)) {
      const versioningCap = aggregate.getCapability(VersioningCapability)!;

      // Register an upcaster
      versioningCap.registerUpcaster('ValueChanged', 1, {
        upcast: (payload: any) => ({
          ...payload,
          timestamp: new Date().toISOString(),
        }),
      });

      expect(versioningCap.hasUpcaster('ValueChanged', 1)).toBe(true);
      expect(versioningCap.getRegisteredEventTypes()).toContain('ValueChanged');
    } else {
      throw new Error('Should have versioning capability');
    }
  });

  it('should work with audit capability', () => {
    const aggregate = aggregateBuilder({ id: 'test-audit' }).withAudit().build(TestAggregate);

    // Make some changes to generate audit events
    aggregate.setValue('first value');
    aggregate.setValue('second value');

    if (hasAuditCapability(aggregate)) {
      const auditCap = aggregate.getCapability(AuditCapability)!;
      const auditLog = auditCap.getAuditLog();
      const stats = auditCap.getAuditStatistics();

      expect(auditLog.length).toBeGreaterThan(0);
      expect(stats.totalEvents).toBeGreaterThan(0);
      expect(stats.eventsByType).toBeDefined();
    } else {
      throw new Error('Should have audit capability');
    }
  });

  it('should work with direct capability class access', () => {
    const aggregate = new TestAggregate({ id: new EntityId('test-compat', 'text') });

    // Direct capability access
    aggregate.addCapability(new SnapshotCapability());
    const capability = aggregate.getCapability(SnapshotCapability);

    expect(capability).toBeInstanceOf(SnapshotCapability);
  });

  it('should return undefined for non-existent capabilities', () => {
    const aggregate = new TestAggregate({ id: new EntityId('test-empty', 'text') });

    const snapshotCap = aggregate.getCapability(SnapshotCapability);
    expect(snapshotCap).toBeUndefined();

    expect(hasSnapshotCapability(aggregate)).toBe(false);
  });

  it('should support capability removal', () => {
    const aggregate = new TestAggregate({ id: new EntityId('test-remove', 'text') });

    aggregate.addCapability(new SnapshotCapability());
    expect(hasSnapshotCapability(aggregate)).toBe(true);

    aggregate.removeCapability(SnapshotCapability);
    expect(hasSnapshotCapability(aggregate)).toBe(false);
  });
});
