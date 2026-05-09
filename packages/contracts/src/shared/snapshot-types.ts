/**
 * Shared snapshot types to avoid circular dependencies.
 *
 * REL-009 (2026-05-08): tightened `aggregateId: unknown` → `aggregateId: string`
 * to match the actual implementation in
 * `packages/aggregates/src/capabilities/snapshot-capability.ts` which calls
 * `this.aggregate.getId().toString()`. Consumers were getting strings at
 * runtime; the `unknown` type forced unnecessary casts. This is the canonical
 * IAggregateSnapshot used by SnapshotCapability — a duplicate definition in
 * `packages/aggregates/src/aggregate-interfaces.ts` was removed as dead code
 * (no consumer imported it).
 */

export interface IAggregateSnapshot<TState = unknown, TMeta = unknown> {
  /** Aggregate identifier (stringified) */
  aggregateId: string;

  /** Aggregate version */
  version: number;

  /** Aggregate type */
  aggregateType: string;

  /** Aggregate state */
  state: TState;

  /** When the snapshot was created */
  timestamp: Date;

  /** Snapshot metadata (optional) */
  metadata?: TMeta | undefined;

  /** ID of the last event included in the snapshot (optional) */
  lastEventId?: string;

  /** Checksum for snapshot integrity verification (optional) */
  checksum?: string;
}
