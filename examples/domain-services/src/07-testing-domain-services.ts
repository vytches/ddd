/**
 * Example 7 — Testing patterns for domain services.
 *
 * Domain services should be testable in PURE isolation — no DI container,
 * no real database, no real event bus. This file demonstrates the
 * canonical test patterns:
 *
 *   1. Stub external dependencies (PaymentGateway, repositories).
 *   2. Capture published events via a recording event bus stub.
 *   3. Use in-memory Unit of Work fake for transactional services.
 *   4. Assert outcomes via Result inspection.
 *
 * Use case: this file is meant to be IMPORTED by tests
 * (`tests/07-testing.test.ts`) — it provides the helpers but does not
 * itself contain assertions.
 */

import type { IDomainEvent, IEventBus } from '@vytches/ddd-contracts';

import type { GatewayResponse, PaymentGateway } from './02-payment-orchestration';

/**
 * An event-bus stub that records every published event for inspection.
 * Use in tests to assert which domain events fired during a service
 * operation, without coupling to a real bus implementation.
 */
export class RecordingEventBus implements Pick<IEventBus, 'publish'> {
  public readonly published: IDomainEvent[] = [];

  async publish<T extends IDomainEvent>(event: T): Promise<void> {
    this.published.push(event);
  }

  /** Convenience: how many events of a given class were published? */
  countOfType<T extends IDomainEvent>(ctor: new (...args: never[]) => T): number {
    return this.published.filter(e => e instanceof ctor).length;
  }

  /** Convenience: get the first event of a given class. */
  firstOfType<T extends IDomainEvent>(ctor: new (...args: never[]) => T): T | undefined {
    return this.published.find(e => e instanceof ctor) as T | undefined;
  }
}

/**
 * A fake payment gateway — returns a scripted response. Useful for
 * deterministic tests of payment orchestration without HTTP / SDK calls.
 */
export class FakePaymentGateway implements PaymentGateway {
  public calls: Array<{ orderId: string; amount: number; currency: string }> = [];

  constructor(private readonly response: GatewayResponse) {}

  async authorize(orderId: string, amount: number, currency: string): Promise<GatewayResponse> {
    this.calls.push({ orderId, amount, currency });
    return this.response;
  }
}

/**
 * Approval / decline factory helpers — keep tests readable.
 */
export const gatewayApproved = (authCode = 'AUTH-123'): GatewayResponse => ({
  approved: true,
  authCode,
});

export const gatewayDeclined = (declineReason = 'insufficient_funds'): GatewayResponse => ({
  approved: false,
  declineReason,
});

/**
 * Minimal in-memory Unit of Work for tests of UoW-aware services.
 * Real implementation lives in your infrastructure layer; tests should
 * never see it.
 */
export class InMemoryUnitOfWork {
  private active = false;
  private readonly committed: Array<() => Promise<void> | void> = [];

  constructor(private readonly repos: Record<string, unknown>) {}

  async begin(): Promise<void> {
    if (this.active) throw new Error('Transaction already active');
    this.active = true;
    this.committed.length = 0;
  }

  async commit(): Promise<void> {
    if (!this.active) throw new Error('No active transaction');
    for (const fn of this.committed) await fn();
    this.active = false;
  }

  async rollback(): Promise<void> {
    if (!this.active) throw new Error('No active transaction');
    this.committed.length = 0; // discard pending commits
    this.active = false;
  }

  getRepository(name: string): unknown {
    const repo = this.repos[name];
    if (!repo) throw new Error(`Repository not registered: ${name}`);
    return repo;
  }

  getEventBus(): unknown {
    return undefined; // tests can override if needed
  }

  isActive(): boolean {
    return this.active;
  }
}
