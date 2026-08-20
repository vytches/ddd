/**
 * Proves the aggregate→repository→event-bus→handler flow actually runs
 * (VF-032b AC5). If `forFeature()` ever stops wiring one of the links, this
 * fails here rather than in a consumer's application.
 */
import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { Test } from '@nestjs/testing';
import { ICommandBus, IQueryBus } from '@vytches/ddd-cqrs';
import { EnhancedCommandBus } from '@vytches/ddd-cqrs';

import {
  InventoryAppModule,
  ReceiveStockCommand,
  GetStockQuery,
  LowStockWatcher,
} from '../src/inventory.context';

describe('inventory bounded context', () => {
  it('runs command → aggregate → repository → local event bus → event handler', async () => {
    const module = await Test.createTestingModule({ imports: [InventoryAppModule] }).compile();
    await module.init();

    const commandBus = module.get<ICommandBus>(ICommandBus, { strict: false });
    const queryBus = module.get<IQueryBus>(IQueryBus, { strict: false });
    const watcher = module.get(LowStockWatcher, { strict: false });

    await commandBus.execute(new ReceiveStockCommand('SKU-1', 7));
    await commandBus.execute(new ReceiveStockCommand('SKU-1', 3));

    // Query goes through the same per-context bus and sees accumulated state.
    expect(await queryBus.execute(new GetStockQuery('SKU-1'))).toBe(10);

    // The event handler saw both domain events, via LOCAL_EVENT_BUS.
    expect(watcher.seen).toEqual(['SKU-1:7', 'SKU-1:3']);

    await module.close();
  });

  it("busType 'enhanced' actually reaches the per-context bus", async () => {
    const module = await Test.createTestingModule({ imports: [InventoryAppModule] }).compile();
    await module.init();

    expect(module.get(ICommandBus, { strict: false })).toBeInstanceOf(EnhancedCommandBus);

    await module.close();
  });
});
