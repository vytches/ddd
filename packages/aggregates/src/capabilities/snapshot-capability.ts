import { Capability } from '@vytches/ddd-contracts';
import type { ISnapshotCapability, IAggregateSnapshot } from '@vytches/ddd-contracts';
import { AggregateError } from '../aggregate-errors';
import type { IAggregateRoot } from '../aggregate-interfaces';

export class SnapshotCapability<TState = unknown, TMeta = unknown>
  extends Capability<'snapshot'>
  implements ISnapshotCapability<TState, TMeta>
{
  override readonly type = 'snapshot' as const;

  static override get capabilityType(): string {
    return 'snapshot';
  }
  private aggregate!: IAggregateRoot;
  private _snapshot: IAggregateSnapshot<TState, TMeta> | null = null;

  /**
   * @param {unknown} aggregate - Aggregate to attach this capability to
   */
  attach(aggregate: unknown): void {
    this.aggregate = aggregate as IAggregateRoot;
  }

  detach?(): void {
    this.aggregate = undefined!;
    this._snapshot = null;
  }

  /**
   * @param {() => TState} serializer - Function to serialize aggregate state
   * @param {() => TMeta} metadataCreator - Optional function to create snapshot metadata
   * @returns {IAggregateSnapshot<TState, TMeta>} Created snapshot with state and metadata
   */
  createSnapshot(
    serializer: () => TState,
    metadataCreator?: () => TMeta
  ): IAggregateSnapshot<TState, TMeta> {
    const events = this.aggregate.getDomainEvents();
    const lastEvent = events.length > 0 ? events[events.length - 1] : null;

    const snapshot: IAggregateSnapshot<TState, TMeta> = {
      aggregateId: this.aggregate.getId().getValue(),
      version: this.aggregate.getVersion(),
      aggregateType: this.aggregate.constructor.name,
      state: serializer(),
      timestamp: new Date(),
      lastEventId: lastEvent?.metadata?.eventId,
    };

    if (metadataCreator) {
      snapshot.metadata = metadataCreator();
    }

    return snapshot;
  }

  /**
   * @param {IAggregateSnapshot<TState, TMeta>} snapshot - Snapshot to restore from
   * @param {(state: TState) => void} deserializer - Function to deserialize state into aggregate
   * @param {(metadata: TMeta) => void} metadataRestorer - Optional function to restore metadata
   * @throws {AggregateError} When snapshot is invalid or IDs don't match
   */
  restoreFromSnapshot(
    snapshot: IAggregateSnapshot<TState, TMeta>,
    deserializer: (state: TState) => void,
    metadataRestorer?: (metadata: TMeta) => void
  ): void {
    if (!snapshot || !snapshot.state) {
      throw AggregateError.invalidSnapshot(this.aggregate.constructor.name, 'Invalid snapshot');
    }

    if (snapshot.aggregateId !== this.aggregate.getId().getValue()) {
      throw AggregateError.idMismatch(
        snapshot.aggregateId as string | number,
        this.aggregate.getId().getValue() as string | number
      );
    }

    if (snapshot.aggregateType !== this.aggregate.constructor.name) {
      throw AggregateError.typeMismatch(snapshot.aggregateType, this.aggregate.constructor.name);
    }

    deserializer(snapshot.state);

    if (snapshot.metadata && metadataRestorer) {
      metadataRestorer(snapshot.metadata);
    }

    // Reset aggregate state using internal method (type-safe approach)
    const aggregateWithInternalState = this.aggregate as IAggregateRoot & {
      _internal_setState?: (state: {
        version: number;
        initialVersion: number;
        domainEvents: unknown[];
      }) => void;
    };

    if (aggregateWithInternalState._internal_setState) {
      aggregateWithInternalState._internal_setState({
        version: snapshot.version,
        initialVersion: snapshot.version,
        domainEvents: [],
      });
    }
  }

  /**
   * @param {TState} state - State to save temporarily
   */
  saveTemporaryState?(state: TState): void {
    this._snapshot = this.createSnapshot(() => state);
  }

  /**
   * @returns {Date | null} Timestamp of last snapshot or null if none exists
   */
  getLastSnapshotTimestamp?(): Date | null {
    return this._snapshot?.timestamp || null;
  }

  /**
   * @param {() => TState} serializer - Function to serialize aggregate state
   * @param {() => TMeta} metadataCreator - Optional metadata creator function
   */
  saveSnapshot(serializer: () => TState, metadataCreator?: () => TMeta): void {
    this._snapshot = this.createSnapshot(serializer, metadataCreator);
  }

  /**
   * @returns {IAggregateSnapshot<TState, TMeta> | null} Previous snapshot state if exists
   */
  getPreviousState(): IAggregateSnapshot<TState, TMeta> | null {
    const snapshot = this._snapshot;
    this._snapshot = null;
    return snapshot;
  }
}
