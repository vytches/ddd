// FIXTURE without violations: correct uses of the same symbols. Any finding here is a false alarm.
import { Result } from '@vytches/ddd-contracts';
import { EventHandler } from '@vytches/ddd-events';
import { EntityId, PolicyBuilder } from './facade';

class OrderPlaced {}

export const ok = Result.ok(1);
export const isError = (value: unknown): boolean => value instanceof Error;
export const parsed = EntityId.fromText('abc-123');

@EventHandler(OrderPlaced)
export class OrderPlacedHandler {
  handle(): void {}
}

export const policy = PolicyBuilder.create({}).withId('p').withName('n').withDomain('d').build();
