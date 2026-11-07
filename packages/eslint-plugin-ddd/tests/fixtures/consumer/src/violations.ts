// FIXTURE with known violations: one per rule of the plugin. Never run, only linted.
// The number and the rules of the findings are asserted by the contract test; zero findings fail it.
import { Result } from '@vytches/ddd-contracts';
import { EventHandler } from '@vytches/ddd-events';
import { internalLogger } from '@vytches/ddd-utils';
import { EntityId, PolicyBuilder } from './facade';

class OrderPlaced {}

// ddd/no-instanceof-result
export const isResult = (value: unknown): boolean => value instanceof Result;

// ddd/no-new-entity-id (through the project facade)
export const created = new EntityId('abc-123', 'text');

// ddd/no-deprecated-entity-id-factories (warning)
export const legacy = EntityId.createText('abc-123');

// ddd/event-handler-requires-handle
@EventHandler(OrderPlaced)
export class OrderPlacedHandler {
  notify(): void {}
}

// ddd/policy-builder-required-calls (through the project facade)
export const policy = PolicyBuilder.create({}).withId('p').build();

// ddd/no-internal-imports: the import of `internalLogger` above, and this one
export const lazyInternals = (): Promise<unknown> => import('@vytches/ddd-cqrs/internal');

void internalLogger;
