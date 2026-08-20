/**
 * The full core flow, wired through `forFeature()` — VF-032b AC5.
 *
 * aggregate → command handler → repository → per-context event bus → event handler
 *
 * `orders.module.ts` next door shows the root-level wiring (`forRoot()` with
 * explicitly provided buses). This file shows the other half of the recommended
 * pattern: a bounded context that owns its buses, gets them from
 * `forFeature()`, and publishes domain events onto its own local event bus
 * rather than the application-wide one.
 *
 * Everything here is in-memory on purpose. The library ships no persistence
 * adapters — `StockRepository` is the shape your real repository implements,
 * not something to import.
 */
import { Inject, Injectable, Module, type OnModuleInit } from '@nestjs/common';
import { AggregateRoot, type IAggregateConstructorParams } from '@vytches/ddd-aggregates';
import { EntityId, type IDomainEvent } from '@vytches/ddd-contracts';
import { CommandHandler, ICommandBus, IQueryBus, QueryHandler } from '@vytches/ddd-cqrs';
import { LOCAL_EVENT_BUS, VytchesDDDModule } from '@vytches/ddd-nestjs';
import type { IEventBus } from '@vytches/ddd-contracts';

// ─── Aggregate ───────────────────────────────────────────────────────────────

interface StockReceivedPayload {
  sku: string;
  quantity: number;
}

/**
 * Records stock arriving for one SKU.
 *
 * State changes go through `apply()`, never through direct field assignment:
 * `apply()` records the domain event AND routes it to the handler registered in
 * the constructor, so replaying history rebuilds identical state.
 */
export class StockItem extends AggregateRoot<string> {
  private sku = '';
  private quantity = 0;

  constructor(params: IAggregateConstructorParams<string>) {
    super(params);
    this.registerEventHandler<StockReceivedPayload>('StockReceived', payload => {
      this.sku = payload!.sku;
      this.quantity += payload!.quantity;
    });
  }

  static receive(sku: string, quantity: number): StockItem {
    const item = new StockItem({ id: EntityId.create(), version: 0 });
    item.apply('StockReceived', { sku, quantity });
    return item;
  }

  /**
   * Records a further delivery for this SKU.
   *
   * `apply()` is protected — the aggregate owns its transitions, so callers go
   * through a domain method rather than poking events in from outside. That
   * protection is what keeps the invariant enforceable in one place.
   */
  receiveMore(quantity: number): void {
    this.apply('StockReceived', { sku: this.sku, quantity });
  }

  getSku(): string {
    return this.sku;
  }

  getQuantity(): number {
    return this.quantity;
  }
}

// ─── Repository ──────────────────────────────────────────────────────────────

export class ReceiveStockCommand {
  constructor(
    public readonly sku: string,
    public readonly quantity: number
  ) {}
}

export class GetStockQuery {
  constructor(public readonly sku: string) {}
}

/**
 * In-memory stand-in for a real repository.
 *
 * Note what `save()` does with events: it drains the aggregate's uncommitted
 * events onto the context's event bus and then calls `commit()`. Publishing
 * before commit means a handler failure leaves the events uncommitted and
 * retryable; committing first would lose them.
 */
@Injectable()
export class StockRepository {
  private readonly items = new Map<string, StockItem>();

  constructor(@Inject(LOCAL_EVENT_BUS) private readonly events: IEventBus) {}

  async save(item: StockItem): Promise<void> {
    this.items.set(item.getSku(), item);

    const pending: ReadonlyArray<IDomainEvent> = item.getDomainEvents();
    for (const event of pending) {
      await this.events.publish(event);
    }
    item.commit();
  }

  find(sku: string): StockItem | undefined {
    return this.items.get(sku);
  }
}

// ─── Handlers ────────────────────────────────────────────────────────────────

@Injectable()
@CommandHandler(ReceiveStockCommand)
export class ReceiveStockHandler {
  // Explicit @Inject rather than relying on emitDecoratorMetadata — this
  // example runs under Vitest and esbuild does not emit design:paramtypes.
  constructor(@Inject(StockRepository) private readonly repository: StockRepository) {}

  async execute(command: ReceiveStockCommand): Promise<void> {
    // Create-or-append, without a zero-quantity placeholder event: seeding an
    // empty aggregate via receive(sku, 0) would record a StockReceived nobody
    // asked for, and every subscriber would see it.
    const existing = this.repository.find(command.sku);
    const item = existing ?? StockItem.receive(command.sku, command.quantity);
    if (existing) {
      existing.receiveMore(command.quantity);
    }
    await this.repository.save(item);
  }
}

@Injectable()
@QueryHandler(GetStockQuery)
export class GetStockHandler {
  constructor(@Inject(StockRepository) private readonly repository: StockRepository) {}

  execute(query: GetStockQuery): Promise<number> {
    return Promise.resolve(this.repository.find(query.sku)?.getQuantity() ?? 0);
  }
}

/**
 * Reacts to what the aggregate recorded.
 *
 * Subscribed manually in `onModuleInit` against LOCAL_EVENT_BUS — this is the
 * context's own bus, so a `StockReceived` raised in another bounded context
 * never reaches it.
 */
@Injectable()
export class LowStockWatcher implements OnModuleInit {
  readonly seen: string[] = [];

  constructor(@Inject(LOCAL_EVENT_BUS) private readonly events: IEventBus) {}

  onModuleInit(): void {
    this.events.subscribe('StockReceived', (event: IDomainEvent) => {
      const payload = event.payload as StockReceivedPayload | undefined;
      if (payload) this.seen.push(`${payload.sku}:${payload.quantity}`);
      return Promise.resolve();
    });
  }
}

// ─── Module ──────────────────────────────────────────────────────────────────

/**
 * One bounded context, one `forFeature()`.
 *
 * `busType: 'enhanced'` gets this context the metrics-carrying buses; before
 * VF-032a there was no supported way to ask for them here. The buses,
 * LOCAL_EVENT_BUS and handler registration all come from the imported module —
 * nothing is wired by hand.
 */
@Module({
  imports: [VytchesDDDModule.forFeature('inventory', { busType: 'enhanced' })],
  providers: [StockRepository, ReceiveStockHandler, GetStockHandler, LowStockWatcher],
  exports: [StockRepository, LowStockWatcher],
})
export class InventoryModule {}

/** Root module — `forRoot()` once, then one `forFeature()` per context. */
@Module({ imports: [VytchesDDDModule.forRoot(), InventoryModule] })
export class InventoryAppModule {}

export { ICommandBus, IQueryBus };
