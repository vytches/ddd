import { describe, it, expect, beforeEach } from 'vitest';
import type { IAggregateWithEvents, IDomainEvent } from '@vytches/ddd-contracts';
import {
  EntityId,
  IEnhancedEventDispatcher,
  IEventPersistenceHandler,
} from '@vytches/ddd-contracts';
import type { IRepositoryAggregate } from '../src';
import { IBaseRepository, VersionError } from '../src';

class MockEventPersistenceHandler extends IEventPersistenceHandler {
  versions = new Map<string, number>();

  async handleEvent(_event: IDomainEvent): Promise<number> {
    return 1;
  }

  async getCurrentVersion(aggregateId: EntityId): Promise<number | undefined> {
    return this.versions.get(aggregateId.getValue() as string);
  }
}

class MockEventDispatcher extends IEnhancedEventDispatcher {
  async dispatchEventsForAggregate(aggregate: IAggregateWithEvents): Promise<void> {
    aggregate.commit();
  }
  async dispatchEvent(_event: IDomainEvent): Promise<void> {}
  async dispatchEvents(..._events: IDomainEvent[]): Promise<void> {}
  use(_middleware: any): this {
    return this;
  }
  registerProcessor(_processor: any): this {
    return this;
  }
}

class StubAggregate implements IRepositoryAggregate {
  private _events: IDomainEvent[];
  constructor(
    private id: EntityId,
    private version: number,
    events: IDomainEvent[] = []
  ) {
    this._events = events;
  }
  getId(): EntityId {
    return this.id;
  }
  getInitialVersion(): number {
    return this.version;
  }
  getDomainEvents(): ReadonlyArray<IDomainEvent> {
    return [...this._events];
  }
  commit(): void {
    this._events = [];
  }
  hasChanges(): boolean {
    return this._events.length > 0;
  }
}

class ConcreteRepository extends IBaseRepository {
  async findById(_id: unknown): Promise<unknown | null> {
    return null;
  }
}

const makeEvent = (): IDomainEvent =>
  ({
    eventId: '1',
    eventName: 'test',
    occurredOn: new Date(),
    metadata: {},
  }) as unknown as IDomainEvent;

describe('IBaseRepository.trySave', () => {
  let persistence: MockEventPersistenceHandler;
  let dispatcher: MockEventDispatcher;
  let repo: ConcreteRepository;

  beforeEach(() => {
    persistence = new MockEventPersistenceHandler();
    dispatcher = new MockEventDispatcher();
    repo = new ConcreteRepository(dispatcher, persistence);
  });

  it('returns Result.ok on successful save', async () => {
    const id = EntityId.createText('agg-1');
    persistence.versions.set('agg-1', 0);
    const aggregate = new StubAggregate(id, 0, [makeEvent()]);

    const result = await repo.trySave(aggregate);

    expect(result.isSuccess).toBe(true);
  });

  it('returns Result.fail with VersionError on version conflict', async () => {
    const id = EntityId.createText('agg-2');
    persistence.versions.set('agg-2', 5); // DB is at version 5, aggregate thinks it's at 0
    const aggregate = new StubAggregate(id, 0, [makeEvent()]);

    const result = await repo.trySave(aggregate);

    expect(result.isFailure).toBe(true);
    expect(result.error).toBeInstanceOf(VersionError);
  });
});
