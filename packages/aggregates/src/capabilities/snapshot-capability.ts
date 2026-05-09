import type { IAggregateSnapshot, ISnapshotCapability } from '@vytches/ddd-contracts';
import { Capability } from '@vytches/ddd-contracts';
import { AggregateError } from '../aggregate-errors';
import type { IAggregateRoot } from '../aggregate-interfaces';

/**
 * Capability that enables snapshot creation and restoration on an aggregate
 * — a performance optimization for event-sourced aggregates with long
 * event histories. Instead of replaying all events to reconstitute state,
 * load a recent snapshot and replay only events after it.
 *
 * Attach via {@link AggregateBuilder} (preferred) or directly with
 * `aggregate.addCapability(new SnapshotCapability())`. The capability
 * stores its state inside the aggregate's `CapabilityRegistry` — there is
 * no separate persistence; *you* serialize/deserialize the aggregate's
 * fields via callbacks.
 *
 * Two operations:
 *
 * - {@link createSnapshot} — produce an `IAggregateSnapshot<TState, TMeta>`
 *   capturing version, type, id, and a state slice you choose. Hand off to
 *   your snapshot store (database, blob, file).
 * - {@link restoreFromSnapshot} — load a snapshot, validate id/type match,
 *   and restore the aggregate's version + reset uncommitted events. The
 *   `deserializer` callback is responsible for putting state back into
 *   the aggregate's private fields.
 *
 * @example Creating a snapshot from inside the aggregate
 * ```typescript
 * import {
 *   AggregateRoot,
 *   AggregateBuilder,
 *   SnapshotCapability,
 * } from '@vytches/ddd-aggregates';
 *
 * interface OrderState { amount: number; customerId: string; }
 *
 * class Order extends AggregateRoot<string> {
 *   private amount = 0;
 *   private customerId = '';
 *
 *   takeSnapshot(): IAggregateSnapshot<OrderState> {
 *     const cap = this.getCapability(SnapshotCapability)!;
 *     return cap.createSnapshot<OrderState>(() => ({
 *       amount: this.amount,
 *       customerId: this.customerId,
 *     }));
 *   }
 *
 *   restore(snap: IAggregateSnapshot<OrderState>): void {
 *     const cap = this.getCapability(SnapshotCapability)!;
 *     cap.restoreFromSnapshot(snap, state => {
 *       this.amount = state.amount;
 *       this.customerId = state.customerId;
 *     });
 *   }
 * }
 *
 * const order = AggregateBuilder
 *   .create({ id: EntityId.create() })
 *   .withSnapshots()
 *   .build(Order);
 *
 * const snap = order.takeSnapshot();
 * await snapshotStore.save(snap);
 * ```
 *
 * @remarks
 * `restoreFromSnapshot` calls the aggregate's `_internal_setState` —
 * this is intentional and required, but means snapshots must be the
 * very first restoration step before any subsequent event replay.
 *
 * @public
 * @stable
 * @since 0.1.0
 */
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
    const lastEventId = lastEvent?.metadata?.eventId;

    const aggregateId = this.aggregate.getId().toString();
    const snapshot: IAggregateSnapshot<TState, TMeta> = {
      aggregateId,
      version: this.aggregate.getVersion(),
      aggregateType: this.aggregate.constructor.name,
      state: serializer(),
      timestamp: new Date(),
      ...(lastEventId !== undefined && { lastEventId }),
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

    const currentAggregateId = this.aggregate.getId().toString();
    if (snapshot.aggregateId !== currentAggregateId) {
      throw AggregateError.idMismatch(snapshot.aggregateId as string | number, currentAggregateId);
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
