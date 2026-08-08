import { Module, Injectable, Inject } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { VytchesDDDModule, NestJSContainerAdapter } from '@vytches/ddd-nestjs';
import {
  CommandHandler,
  QueryHandler,
  EnhancedCommandBus,
  EnhancedQueryBus,
  ICommandBus,
  IQueryBus,
} from '@vytches/ddd-cqrs';

export class PlaceOrderCommand {
  constructor(
    public readonly orderId: string,
    public readonly total: number
  ) {}
}

export class GetOrderQuery {
  constructor(public readonly orderId: string) {}
}

/** Stands in for a repository. */
@Injectable()
export class OrderStore {
  private readonly orders = new Map<string, number>();

  put(orderId: string, total: number): void {
    this.orders.set(orderId, total);
  }

  get(orderId: string): number | undefined {
    return this.orders.get(orderId);
  }
}

@Injectable()
@CommandHandler(PlaceOrderCommand)
export class PlaceOrderHandler {
  // Explicit @Inject rather than relying on emitDecoratorMetadata: this example
  // runs under Vitest, and esbuild does not emit design:paramtypes. In an
  // application built with tsc or SWC the bare constructor type is enough.
  constructor(@Inject(OrderStore) private readonly store: OrderStore) {}

  execute(command: PlaceOrderCommand): Promise<void> {
    this.store.put(command.orderId, command.total);
    return Promise.resolve();
  }
}

@Injectable()
@QueryHandler(GetOrderQuery)
export class GetOrderHandler {
  constructor(@Inject(OrderStore) private readonly store: OrderStore) {}

  execute(query: GetOrderQuery): Promise<number | undefined> {
    return Promise.resolve(this.store.get(query.orderId));
  }
}

/**
 * The wiring the documentation teaches.
 *
 * The buses go in through `forRoot({ providers })`, which also registers the
 * bridge that lets `VytchesExplorerService` resolve them via
 * `COMMAND_BUS_TOKEN` / `QUERY_BUS_TOKEN`. Handlers are ordinary providers —
 * the explorer finds them by their decorators during `onApplicationBootstrap`
 * and registers them on the buses. No manual registration anywhere.
 *
 * Give each bus a `NestJSContainerAdapter`. Without it the bus has no way to
 * resolve a handler's own dependencies, and a handler that injects anything
 * (here: `OrderStore`) receives `undefined` at dispatch time.
 */
@Module({
  imports: [
    VytchesDDDModule.forRoot({
      providers: [
        {
          provide: ICommandBus,
          useFactory: (moduleRef: ModuleRef) =>
            new EnhancedCommandBus(new NestJSContainerAdapter(moduleRef)),
          inject: [ModuleRef],
        },
        {
          provide: IQueryBus,
          useFactory: (moduleRef: ModuleRef) =>
            new EnhancedQueryBus(new NestJSContainerAdapter(moduleRef)),
          inject: [ModuleRef],
        },
      ],
    }),
  ],
  providers: [OrderStore, PlaceOrderHandler, GetOrderHandler],
})
export class OrdersModule {}
