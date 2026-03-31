import type { IDomainEvent } from '@vytches/ddd-contracts';
import type { IAggregateRoot } from '@vytches/ddd-contracts';
import { eventsMatch, isPartialMatch, partialEventMatches } from './event-matcher';
import { GWTAssertionError } from './gwt-error';

/**
 * Internal type for accessing protected aggregate methods in tests.
 * TypeScript's `protected` is compile-time only — at runtime these methods exist.
 */
interface TestableAggregate extends IAggregateRoot {
  loadFromHistory(events: IDomainEvent[]): void;
}

// --- Fluent step interfaces ---

/**
 * @public
 * @stable
 * @since 0.24.0
 */
export interface GivenStep<T extends IAggregateRoot> {
  given(...events: IDomainEvent[]): WhenStep<T>;
  givenNothing(): WhenStep<T>;
}

/**
 * @public
 * @stable
 * @since 0.24.0
 */
export interface WhenStep<T extends IAggregateRoot> {
  when(action: (aggregate: T) => void): ThenStep;
  whenAsync(action: (aggregate: T) => Promise<void>): AsyncThenStep;
}

/**
 * @public
 * @stable
 * @since 0.24.0
 */
export interface ThenStep {
  then(...expectedEvents: IDomainEvent[]): void;
  thenError(errorMessageOrCode: string): void;
  thenNothing(): void;
}

/**
 * @public
 * @stable
 * @since 0.24.0
 */
export interface AsyncThenStep {
  then(...expectedEvents: IDomainEvent[]): Promise<void>;
  thenError(errorMessageOrCode: string): Promise<void>;
  thenNothing(): Promise<void>;
}

/**
 * GWT aggregate test builder.
 *
 * @public
 * @stable
 * @since 0.24.0
 *
 * @example
 * ```typescript
 * Test(Order)
 *   .given(new OrderCreated({ id: '1', customerId: 'c1' }))
 *   .when(order => order.place({ items: [{ sku: 'ABC', qty: 2 }] }))
 *   .then(new OrderPlaced({ items: [{ sku: 'ABC', qty: 2 }] }));
 * ```
 */
class AggregateTestBuilder<T extends IAggregateRoot> implements GivenStep<T> {
  private readonly createAggregate: () => T;
  private historyEvents: IDomainEvent[] = [];

  constructor(aggregateClassOrFactory: (new (...args: unknown[]) => T) | (() => T)) {
    if (typeof aggregateClassOrFactory === 'function' && aggregateClassOrFactory.prototype) {
      // It's a class constructor — but we can't call new on it without params.
      // Store as factory.
      this.createAggregate = aggregateClassOrFactory as () => T;
    } else {
      this.createAggregate = aggregateClassOrFactory as () => T;
    }
  }

  given(...events: IDomainEvent[]): WhenStep<T> {
    this.historyEvents = [...events];
    return new WhenStepImpl(this.createAggregate, this.historyEvents);
  }

  givenNothing(): WhenStep<T> {
    this.historyEvents = [];
    return new WhenStepImpl(this.createAggregate, this.historyEvents);
  }
}

class WhenStepImpl<T extends IAggregateRoot> implements WhenStep<T> {
  constructor(
    private readonly createAggregate: () => T,
    private readonly historyEvents: IDomainEvent[]
  ) {}

  when(action: (aggregate: T) => void): ThenStep {
    const aggregate = this.createAggregate();

    if (this.historyEvents.length > 0) {
      (aggregate as unknown as TestableAggregate).loadFromHistory(this.historyEvents);
      aggregate.commit();
    }

    let caughtError: Error | undefined;
    try {
      action(aggregate);
    } catch (err) {
      caughtError = err instanceof Error ? err : new Error(String(err));
    }

    return new ThenStepImpl(this.historyEvents, aggregate.getDomainEvents(), caughtError);
  }

  whenAsync(action: (aggregate: T) => Promise<void>): AsyncThenStep {
    const historyEvents = this.historyEvents;
    const createAggregate = this.createAggregate;

    return new AsyncThenStepImpl(async () => {
      const aggregate = createAggregate();

      if (historyEvents.length > 0) {
        (aggregate as unknown as TestableAggregate).loadFromHistory(historyEvents);
        aggregate.commit();
      }

      let caughtError: Error | undefined;
      try {
        await action(aggregate);
      } catch (err) {
        caughtError = err instanceof Error ? err : new Error(String(err));
      }

      return {
        givenEvents: historyEvents,
        producedEvents: aggregate.getDomainEvents(),
        caughtError,
      };
    });
  }
}

interface ExecutionResult {
  givenEvents: IDomainEvent[];
  producedEvents: ReadonlyArray<IDomainEvent>;
  caughtError?: Error;
}

class ThenStepImpl implements ThenStep {
  constructor(
    private readonly givenEvents: IDomainEvent[],
    private readonly producedEvents: ReadonlyArray<IDomainEvent>,
    private readonly caughtError?: Error
  ) {}

  then(...expectedEvents: IDomainEvent[]): void {
    if (this.caughtError) {
      throw new GWTAssertionError(
        this.givenEvents,
        expectedEvents,
        [...this.producedEvents],
        undefined,
        this.caughtError
      );
    }

    if (expectedEvents.length !== this.producedEvents.length) {
      throw new GWTAssertionError(this.givenEvents, expectedEvents, [...this.producedEvents]);
    }

    const allMatch = expectedEvents.every((expected, i) => {
      const actual = this.producedEvents[i];
      if (isPartialMatch(expected)) {
        return partialEventMatches(expected, actual);
      }
      return eventsMatch(expected, actual);
    });

    if (!allMatch) {
      throw new GWTAssertionError(this.givenEvents, expectedEvents, [...this.producedEvents]);
    }
  }

  thenError(errorMessageOrCode: string): void {
    if (!this.caughtError) {
      throw new GWTAssertionError(
        this.givenEvents,
        [],
        [...this.producedEvents],
        errorMessageOrCode
      );
    }

    const errorString = this.caughtError.message;
    if (!errorString.includes(errorMessageOrCode)) {
      throw new GWTAssertionError(
        this.givenEvents,
        [],
        [...this.producedEvents],
        errorMessageOrCode,
        this.caughtError
      );
    }
  }

  thenNothing(): void {
    if (this.caughtError) {
      throw new GWTAssertionError(
        this.givenEvents,
        [],
        [...this.producedEvents],
        undefined,
        this.caughtError
      );
    }

    if (this.producedEvents.length > 0) {
      throw new GWTAssertionError(this.givenEvents, [], [...this.producedEvents]);
    }
  }
}

class AsyncThenStepImpl implements AsyncThenStep {
  constructor(private readonly execute: () => Promise<ExecutionResult>) {}

  async then(...expectedEvents: IDomainEvent[]): Promise<void> {
    const { givenEvents, producedEvents, caughtError } = await this.execute();
    const syncStep = new ThenStepImpl(givenEvents, producedEvents, caughtError);
    syncStep.then(...expectedEvents);
  }

  async thenError(errorMessageOrCode: string): Promise<void> {
    const { givenEvents, producedEvents, caughtError } = await this.execute();
    const syncStep = new ThenStepImpl(givenEvents, producedEvents, caughtError);
    syncStep.thenError(errorMessageOrCode);
  }

  async thenNothing(): Promise<void> {
    const { givenEvents, producedEvents, caughtError } = await this.execute();
    const syncStep = new ThenStepImpl(givenEvents, producedEvents, caughtError);
    syncStep.thenNothing();
  }
}

/**
 * Entry point for GWT aggregate testing.
 *
 * @public
 * @stable
 * @since 0.24.0
 *
 * @param aggregateFactory - Factory function that creates the aggregate under test
 * @returns A GivenStep to start the GWT chain
 *
 * @example
 * ```typescript
 * Test(() => new Order({ id: EntityId.create(), version: 0 }))
 *   .given(new OrderCreated({ customerId: 'c1' }))
 *   .when(order => order.place(items))
 *   .then(new OrderPlaced({ items }));
 * ```
 */
export function Test<T extends IAggregateRoot>(aggregateFactory: () => T): GivenStep<T> {
  return new AggregateTestBuilder(aggregateFactory);
}
