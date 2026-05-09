/**
 * Example 2 — Payment orchestration with event emission.
 *
 * Domain service that coordinates a payment workflow and emits domain
 * events as state transitions happen. Extends `EventAwareDomainService`
 * to get a built-in `publishEvent()` helper backed by an `IEventBus`.
 *
 * Use case: process payment authorization — emit `PaymentAuthorized` /
 * `PaymentDeclined` events that downstream subscribers (audit log, fraud
 * detection, customer notification) can react to.
 *
 * Pattern: orchestration service that emits events but does NOT mutate
 * aggregates directly — that's the command handler's job.
 */

import { DomainEvent } from '@vytches/ddd-events';
import { DomainService, EventAwareDomainService } from '@vytches/ddd-domain-services';
import { Result } from '@vytches/ddd-utils';

export interface PaymentAuthorizationPayload {
  readonly orderId: string;
  readonly amount: number;
  readonly currency: string;
  readonly authCode: string;
}

export class PaymentAuthorized extends DomainEvent<PaymentAuthorizationPayload> {
  constructor(payload: PaymentAuthorizationPayload) {
    super(payload);
  }
}

export interface PaymentDeclinedPayload {
  readonly orderId: string;
  readonly amount: number;
  readonly currency: string;
  readonly reason: string;
}

export class PaymentDeclined extends DomainEvent<PaymentDeclinedPayload> {
  constructor(payload: PaymentDeclinedPayload) {
    super(payload);
  }
}

/**
 * Stub gateway response — in real code this is the SDK's response shape.
 */
export interface GatewayResponse {
  readonly approved: boolean;
  readonly authCode?: string;
  readonly declineReason?: string;
}

export interface PaymentGateway {
  authorize(orderId: string, amount: number, currency: string): Promise<GatewayResponse>;
}

@DomainService('PaymentOrchestrationService')
export class PaymentOrchestrationService extends EventAwareDomainService {
  constructor(private readonly gateway: PaymentGateway) {
    super('PaymentOrchestrationService');
  }

  /**
   * Authorize a payment. Calls the gateway, emits the appropriate event,
   * returns Result for the caller. The event bus is set externally via
   * `setEventBus()` (typically by the DI container at composition root).
   */
  async authorize(
    orderId: string,
    amount: number,
    currency: string
  ): Promise<Result<PaymentAuthorizationPayload, PaymentDeclinedPayload>> {
    const response = await this.gateway.authorize(orderId, amount, currency);

    if (response.approved && response.authCode) {
      const event = new PaymentAuthorized({
        orderId,
        amount,
        currency,
        authCode: response.authCode,
      });
      this.publishEvent(event);
      return Result.ok(event.payload!);
    }

    const declined: PaymentDeclinedPayload = {
      orderId,
      amount,
      currency,
      reason: response.declineReason ?? 'unknown',
    };
    this.publishEvent(new PaymentDeclined(declined));
    return Result.fail(declined);
  }
}
