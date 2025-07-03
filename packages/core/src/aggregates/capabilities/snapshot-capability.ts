import { AggregateError } from '../aggregate-errors';
import type {
  IAggregateRoot,
  ISnapshotCapability,
  IAggregateSnapshot,
} from '../aggregate-interfaces';

/**
 * Snapshot capability implementation
 * Handles aggregate state snapshots for audit and performance optimization
 */
export class SnapshotCapability<TState = unknown, TMeta = unknown>
  implements ISnapshotCapability<TState, TMeta>
{
  private aggregate!: IAggregateRoot;
  private _snapshot: IAggregateSnapshot<TState, TMeta> | null = null;

  attach(aggregate: IAggregateRoot): void {
    this.aggregate = aggregate;
  }

  detach?(): void {
    this.aggregate = undefined!;
    this._snapshot = null;
  }

  createSnapshot(
    serializer: () => TState,
    metadataCreator?: () => TMeta
  ): IAggregateSnapshot<TState, TMeta> {
    const events = this.aggregate.getDomainEvents();
    const lastEvent = events.length > 0 ? events[events.length - 1] : null;

    const snapshot: IAggregateSnapshot<TState, TMeta> = {
      id: this.aggregate.getId().getValue(),
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

  restoreFromSnapshot(
    snapshot: IAggregateSnapshot<TState, TMeta>,
    deserializer: (state: TState) => void,
    metadataRestorer?: (metadata: TMeta) => void
  ): void {
    if (!snapshot || !snapshot.state) {
      throw AggregateError.invalidSnapshot(this.aggregate.constructor.name, 'Invalid snapshot');
    }

    if (snapshot.id !== this.aggregate.getId().getValue()) {
      throw AggregateError.idMismatch(
        snapshot.id as string | number, 
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

  saveSnapshot(serializer: () => TState, metadataCreator?: () => TMeta): void {
    this._snapshot = this.createSnapshot(serializer, metadataCreator);
  }

  getPreviousState(): IAggregateSnapshot<TState, TMeta> | null {
    const snapshot = this._snapshot;
    this._snapshot = null;
    return snapshot;
  }
}
