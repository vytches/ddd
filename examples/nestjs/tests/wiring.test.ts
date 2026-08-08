/**
 * Proves the documented NestJS wiring actually dispatches.
 *
 * The README and LLMGUIDE showed this shape for a long time without anything
 * compiling or running it, and a consumer ended up with a silently dead
 * explorer. This test is the guard: if handler auto-discovery stops reaching
 * the buses, it fails here rather than in someone's application.
 */
import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { Test } from '@nestjs/testing';
import { ICommandBus, IQueryBus } from '@vytches/ddd-cqrs';
import { VytchesExplorerService } from '@vytches/ddd-nestjs';

import { OrdersModule, PlaceOrderCommand, GetOrderQuery } from '../src/orders.module';

describe('OrdersModule', () => {
  it('registers the decorated handlers on the buses', async () => {
    const module = await Test.createTestingModule({ imports: [OrdersModule] }).compile();
    await module.init();

    const explorer = module.get(VytchesExplorerService, { strict: false });
    expect(explorer.hasCommandBus()).toBe(true);
    expect(explorer.hasQueryBus()).toBe(true);

    await module.close();
  });

  it('dispatches a command and reads it back through a query', async () => {
    const module = await Test.createTestingModule({ imports: [OrdersModule] }).compile();
    await module.init();

    const commandBus = module.get<ICommandBus>(ICommandBus, { strict: false });
    const queryBus = module.get<IQueryBus>(IQueryBus, { strict: false });

    await commandBus.execute(new PlaceOrderCommand('order-1', 4200));
    const total = await queryBus.execute(new GetOrderQuery('order-1'));

    expect(total).toBe(4200);

    await module.close();
  });
});
