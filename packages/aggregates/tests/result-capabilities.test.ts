import { EntityId } from '@vytches/ddd-contracts';
import { describe, expect, it } from 'vitest';
import type { IAggregateConstructorParams } from '../src/aggregate-interfaces';
import { AggregateRoot } from '../src/core/aggregate-root';
import { aggregateBuilder } from '../src/core/aggregate-root.builder';
import {
  tryAsSnapshotAggregate,
  tryAsVersioningAggregate,
  tryAsAuditAggregate,
  tryAsEventSourcingAggregate,
} from '../src';
import { SnapshotCapability } from '../src/capabilities/snapshot-capability';
import { VersioningCapability } from '../src/capabilities/versioning-capability';
import { AuditCapability } from '../src/capabilities/audit-capability';
import { EventSourcingCapability } from '../src/capabilities/event-sourcing-capability';

class TestAggregate extends AggregateRoot<string> {
  constructor(params: IAggregateConstructorParams<string>) {
    super(params);
  }
}

function bare(): TestAggregate {
  return new TestAggregate({ id: EntityId.fromText('test-id') as any });
}

describe('tryAs* result-based casting utilities', () => {
  describe('tryAsSnapshotAggregate', () => {
    it('returns Result.ok when SnapshotCapability is present', () => {
      const aggregate = aggregateBuilder({ id: 'snap-ok' }).withSnapshots().build(TestAggregate);
      const result = tryAsSnapshotAggregate(aggregate);
      expect(result.isSuccess).toBe(true);
    });

    it('returns Result.fail when SnapshotCapability is absent', () => {
      const result = tryAsSnapshotAggregate(bare());
      expect(result.isSuccess).toBe(false);
      expect(result.isFailure).toBe(true);
    });

    it('ok value has getCapability returning SnapshotCapability', () => {
      const aggregate = aggregateBuilder({ id: 'snap-cap' }).withSnapshots().build(TestAggregate);
      const result = tryAsSnapshotAggregate(aggregate);
      const cap = result.value.getCapability(SnapshotCapability);
      expect(cap).toBeInstanceOf(SnapshotCapability);
    });
  });

  describe('tryAsVersioningAggregate', () => {
    it('returns Result.ok when VersioningCapability is present', () => {
      const aggregate = aggregateBuilder({ id: 'ver-ok' }).withVersioning().build(TestAggregate);
      const result = tryAsVersioningAggregate(aggregate);
      expect(result.isSuccess).toBe(true);
    });

    it('returns Result.fail when VersioningCapability is absent', () => {
      const result = tryAsVersioningAggregate(bare());
      expect(result.isSuccess).toBe(false);
      expect(result.isFailure).toBe(true);
    });

    it('ok value has getCapability returning VersioningCapability', () => {
      const aggregate = aggregateBuilder({ id: 'ver-cap' }).withVersioning().build(TestAggregate);
      const result = tryAsVersioningAggregate(aggregate);
      const cap = result.value.getCapability(VersioningCapability);
      expect(cap).toBeInstanceOf(VersioningCapability);
    });
  });

  describe('tryAsAuditAggregate', () => {
    it('returns Result.ok when AuditCapability is present', () => {
      const aggregate = aggregateBuilder({ id: 'aud-ok' }).withAudit().build(TestAggregate);
      const result = tryAsAuditAggregate(aggregate);
      expect(result.isSuccess).toBe(true);
    });

    it('returns Result.fail when AuditCapability is absent', () => {
      const result = tryAsAuditAggregate(bare());
      expect(result.isSuccess).toBe(false);
      expect(result.isFailure).toBe(true);
    });

    it('ok value has getCapability returning AuditCapability', () => {
      const aggregate = aggregateBuilder({ id: 'aud-cap' }).withAudit().build(TestAggregate);
      const result = tryAsAuditAggregate(aggregate);
      const cap = result.value.getCapability(AuditCapability);
      expect(cap).toBeInstanceOf(AuditCapability);
    });
  });

  describe('tryAsEventSourcingAggregate', () => {
    it('returns Result.ok when EventSourcingCapability is present', () => {
      const aggregate = bare();
      aggregate.addCapability(new EventSourcingCapability());
      const result = tryAsEventSourcingAggregate(aggregate);
      expect(result.isSuccess).toBe(true);
    });

    it('returns Result.fail when EventSourcingCapability is absent', () => {
      const result = tryAsEventSourcingAggregate(bare());
      expect(result.isSuccess).toBe(false);
      expect(result.isFailure).toBe(true);
    });

    it('ok value has getCapability returning EventSourcingCapability', () => {
      const aggregate = bare();
      aggregate.addCapability(new EventSourcingCapability());
      const result = tryAsEventSourcingAggregate(aggregate);
      const cap = result.value.getCapability(EventSourcingCapability);
      expect(cap).toBeInstanceOf(EventSourcingCapability);
    });
  });
});
