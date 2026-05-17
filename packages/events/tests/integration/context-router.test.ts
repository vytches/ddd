import { describe, it, expect } from 'vitest';
import type { IDomainEvent, ISpecification } from '@vytches/ddd-contracts';

import { ContextRouter } from '../../src/integration/context-router';

const buildEvent = (eventName: string): IDomainEvent =>
  ({
    eventName,
    payload: {},
    metadata: {},
  }) as unknown as IDomainEvent;

describe('ContextRouter — sendAllEventsTo', () => {
  it('routes every event to the listed contexts', () => {
    const router = new ContextRouter();
    router.sendAllEventsTo('billing', 'shipping');
    expect(router.determineTargetContexts(buildEvent('AnyEvent')).sort()).toEqual([
      'billing',
      'shipping',
    ]);
  });

  it('returns [] when no rules are configured', () => {
    const router = new ContextRouter();
    expect(router.determineTargetContexts(buildEvent('Whatever'))).toEqual([]);
  });
});

describe('ContextRouter — sendEventTypeTo', () => {
  it('routes only matching event names', () => {
    const router = new ContextRouter()
      .sendEventTypeTo('OrderPlaced', 'billing')
      .sendEventTypeTo('OrderShipped', 'shipping');
    expect(router.determineTargetContexts(buildEvent('OrderPlaced'))).toEqual(['billing']);
    expect(router.determineTargetContexts(buildEvent('OrderShipped'))).toEqual(['shipping']);
    expect(router.determineTargetContexts(buildEvent('Other'))).toEqual([]);
  });

  it('deduplicates target contexts when multiple rules match the same event', () => {
    const router = new ContextRouter()
      .sendEventTypeTo('OrderPlaced', 'billing')
      .sendEventTypeTo('OrderPlaced', 'billing');
    expect(router.determineTargetContexts(buildEvent('OrderPlaced'))).toEqual(['billing']);
  });
});

describe('ContextRouter — sendEventsMatchingPredicateTo', () => {
  it('routes events that satisfy the predicate', () => {
    const router = new ContextRouter().sendEventsMatchingPredicateTo(
      event => event.eventName.startsWith('Order'),
      'orders'
    );
    expect(router.determineTargetContexts(buildEvent('OrderPlaced'))).toEqual(['orders']);
    expect(router.determineTargetContexts(buildEvent('UserCreated'))).toEqual([]);
  });
});

describe('ContextRouter — sendEventsMatchingSpecificationTo', () => {
  it('routes events satisfying the ISpecification', () => {
    const spec: ISpecification<IDomainEvent> = {
      isSatisfiedBy: (event: IDomainEvent) => event.eventName.includes('Critical'),
    } as ISpecification<IDomainEvent>;
    const router = new ContextRouter().sendEventsMatchingSpecificationTo(spec, 'alerting');
    expect(router.determineTargetContexts(buildEvent('CriticalIssueRaised'))).toEqual(['alerting']);
    expect(router.determineTargetContexts(buildEvent('NormalEvent'))).toEqual([]);
  });
});

describe('ContextRouter — configure with array (broadcast)', () => {
  it('treats an array as broadcast to all contexts in the array', () => {
    const router = new ContextRouter(['analytics', 'audit']);
    expect(router.determineTargetContexts(buildEvent('Anything')).sort()).toEqual([
      'analytics',
      'audit',
    ]);
  });
});

describe('ContextRouter — configure with Map of conditions', () => {
  it('routes per Map<context, condition>', () => {
    const config = new Map<string, ((e: IDomainEvent) => boolean) | string>([
      ['billing', 'OrderPlaced'],
      ['shipping', (event: IDomainEvent) => event.eventName.endsWith('Shipped')],
    ]);
    const router = new ContextRouter(config);
    expect(router.determineTargetContexts(buildEvent('OrderPlaced'))).toEqual(['billing']);
    expect(router.determineTargetContexts(buildEvent('OrderShipped'))).toEqual(['shipping']);
  });
});

describe('ContextRouter — configure with Record (object)', () => {
  it('treats array values as event-name lists', () => {
    const router = new ContextRouter({
      billing: ['OrderPlaced', 'OrderPaid'],
      shipping: ['OrderShipped'],
    });
    expect(router.determineTargetContexts(buildEvent('OrderPaid'))).toEqual(['billing']);
    expect(router.determineTargetContexts(buildEvent('OrderShipped'))).toEqual(['shipping']);
    expect(router.determineTargetContexts(buildEvent('Random'))).toEqual([]);
  });

  it('treats string values as single event-name match', () => {
    const router = new ContextRouter({
      billing: 'OrderPaid' as never,
    });
    expect(router.determineTargetContexts(buildEvent('OrderPaid'))).toEqual(['billing']);
    expect(router.determineTargetContexts(buildEvent('Other'))).toEqual([]);
  });

  it('treats function values as predicates', () => {
    const router = new ContextRouter({
      billing: ((event: IDomainEvent) => event.eventName === 'OrderPaid') as never,
    });
    expect(router.determineTargetContexts(buildEvent('OrderPaid'))).toEqual(['billing']);
  });

  it('treats specification values via isSatisfiedBy', () => {
    const spec: ISpecification<IDomainEvent> = {
      isSatisfiedBy: (e: IDomainEvent) => e.eventName === 'OrderPaid',
    } as ISpecification<IDomainEvent>;
    const router = new ContextRouter({
      billing: spec as never,
    });
    expect(router.determineTargetContexts(buildEvent('OrderPaid'))).toEqual(['billing']);
  });
});

describe('ContextRouter — clear', () => {
  it('removes all routing rules', () => {
    const router = new ContextRouter().sendAllEventsTo('billing');
    expect(router.determineTargetContexts(buildEvent('X'))).toEqual(['billing']);
    router.clear();
    expect(router.determineTargetContexts(buildEvent('X'))).toEqual([]);
  });
});

describe('ContextRouter — fluent chaining', () => {
  it('returns this from every configure-style method', () => {
    const router = new ContextRouter();
    expect(router.sendAllEventsTo('a')).toBe(router);
    expect(router.sendEventTypeTo('E', 'a')).toBe(router);
    expect(router.sendEventsMatchingPredicateTo(() => true, 'a')).toBe(router);
    expect(router.clear()).toBe(router);
  });
});
