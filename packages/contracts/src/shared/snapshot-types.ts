/**
 * Shared snapshot types to avoid circular dependencies
 */

export interface IAggregateSnapshot<TState = unknown, TMeta = unknown> {
  /** Aggregate ID */
  aggregateId: unknown;

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
