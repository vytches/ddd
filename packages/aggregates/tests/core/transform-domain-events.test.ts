/**
 * transformDomainEvents() — the persistence-boundary escape hatch.
 *
 * getDomainEvents() deep-freezes what it hands out and the event list is
 * private, so a repository that has to stamp events on their way to the store
 * (crypto-shredding key ids, correlation ids, encrypted payloads) previously
 * had no supported way in.
 */
import { describe, it, expect } from 'vitest';
import { EntityId } from '@vytches/ddd-contracts';

import { AggregateRoot } from '../../src/core/aggregate-root';
import type { IAggregateConstructorParams } from '../../src/aggregate-interfaces';

interface UserRegisteredPayload {
  email: string;
}

class User extends AggregateRoot<string> {
  private _email = '';

  constructor(params: IAggregateConstructorParams<string>) {
    super(params);
    this.registerEventHandler<UserRegisteredPayload>('UserRegistered', payload => {
      this._email = payload!.email;
    });
  }

  get email(): string {
    return this._email;
  }

  static register(email: string): User {
    const user = new User({ id: EntityId.create<string>('user-1').value });
    user.apply<UserRegisteredPayload>('UserRegistered', { email });
    return user;
  }

  registerAgain(email: string): void {
    this.apply<UserRegisteredPayload>('UserRegistered', { email });
  }
}

describe('AggregateRoot.transformDomainEvents()', () => {
  it('replaces the payload of recorded events', () => {
    const user = User.register('someone@example.test');

    user.transformDomainEvents<UserRegisteredPayload>(() => ({
      payload: { email: '<encrypted>' },
    }));

    const [event] = user.getDomainEvents();
    expect((event.payload as UserRegisteredPayload).email).toBe('<encrypted>');
  });

  it('merges metadata the persistence boundary supplies', () => {
    const user = User.register('someone@example.test');

    user.transformDomainEvents(() => ({ metadata: { userSpecificKeyId: 'key-42' } }));

    const [event] = user.getDomainEvents();
    expect(event.metadata!.userSpecificKeyId).toBe('key-42');
    // The metadata apply() already recorded must survive the merge.
    expect(event.metadata!.timestamp).toBeDefined();
  });

  it('keeps event identity and name intact', () => {
    const user = User.register('someone@example.test');
    const before = user.getDomainEvents()[0];

    user.transformDomainEvents(() => ({ metadata: { userSpecificKeyId: 'key-42' } }));

    const after = user.getDomainEvents()[0];
    expect(after.eventName).toBe(before.eventName);
    expect(after.metadata!.eventId).toBe(before.metadata!.eventId);
  });

  it('leaves an event untouched when the transform returns nothing', () => {
    const user = User.register('someone@example.test');

    user.transformDomainEvents(() => undefined);

    const [event] = user.getDomainEvents();
    expect((event.payload as UserRegisteredPayload).email).toBe('someone@example.test');
  });

  it('works on events already frozen by a previous getDomainEvents() call', () => {
    // getDomainEvents() freezes the stored objects in place, so a repository
    // that inspects events before transforming them must not hit a TypeError.
    const user = User.register('someone@example.test');
    user.getDomainEvents();

    expect(() =>
      user.transformDomainEvents<UserRegisteredPayload>(() => ({
        payload: { email: '<encrypted>' },
      }))
    ).not.toThrow();

    const [event] = user.getDomainEvents();
    expect((event.payload as UserRegisteredPayload).email).toBe('<encrypted>');
  });

  it('passes the index so per-event decisions are possible', () => {
    const user = User.register('first@example.test');
    user.registerAgain('second@example.test');

    user.transformDomainEvents<UserRegisteredPayload>((_event, index) =>
      index === 1 ? { payload: { email: '<encrypted>' } } : undefined
    );

    const events = user.getDomainEvents();
    expect((events[0].payload as UserRegisteredPayload).email).toBe('first@example.test');
    expect((events[1].payload as UserRegisteredPayload).email).toBe('<encrypted>');
  });

  it('does not disturb aggregate state', () => {
    const user = User.register('someone@example.test');
    const countBefore = user.getDomainEvents().length;

    user.transformDomainEvents(() => ({ metadata: { userSpecificKeyId: 'key-42' } }));

    expect(user.email).toBe('someone@example.test');
    expect(user.getDomainEvents()).toHaveLength(countBefore);
  });
});
