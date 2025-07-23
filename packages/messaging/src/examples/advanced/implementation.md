# Enterprise Saga Orchestration Implementation

**Focus**: Enterprise saga orchestration with policies, events, and
comprehensive fault tolerance  
**Domain**: Cross-Border Payment System  
**Complexity**: Advanced  
**Dependencies**: @vytches-ddd/messaging, @vytches-ddd/policies,
@vytches-ddd/events, @vytches-ddd/resilience, @vytches-ddd/di

## Business Context

This example demonstrates enterprise-grade saga orchestration for a cross-border
payment system that requires:

- Policy-driven saga behavior based on compliance requirements
- Integration with events system for comprehensive audit trail
- Resilience patterns for reliable cross-border communication
- Comprehensive compensation logic for failed transactions
- Regulatory compliance with real-time monitoring and reporting

## Implementation

```typescript
// cross-border-payment-saga.ts
import {
  BaseSaga,
  SagaState,
  SagaStatus,
  ISagaActionResult,
  ISagaExecutionContext,
  SagaStep,
} from '@vytches-ddd/messaging';
import {
  PolicyBuilder,
  PolicyContext,
  ISpecification,
} from '@vytches-ddd/policies';
import { DomainEvent } from '@vytches-ddd/events';
import {
  ResiliencePolicyBuilder,
  CircuitBreakerState,
} from '@vytches-ddd/resilience';
import { Logger } from '@vytches-ddd/logging';
import { Result } from '@vytches-ddd/utils';
import {
  PaymentRequest,
  ComplianceCheck,
  ExchangeRate,
  PaymentStatus,
  CompensationAction,
} from '../types'; // ALWAYS import from app

// Domain events for saga orchestration
export class CrossBorderPaymentInitiatedEvent extends DomainEvent {
  constructor(
    public readonly paymentId: string,
    public readonly fromAccount: string,
    public readonly toAccount: string,
    public readonly amount: number,
    public readonly sourceCurrency: string,
    public readonly targetCurrency: string,
    public readonly paymentPurpose: string,
    public readonly initiatedAt: Date
  ) {
    super('CrossBorderPaymentInitiated', {
      paymentId,
      fromAccount,
      toAccount,
      amount,
      sourceCurrency,
      targetCurrency,
      paymentPurpose,
      initiatedAt,
    });
  }
}

export class SagaStepCompletedEvent extends DomainEvent {
  constructor(
    public readonly sagaId: string,
    public readonly stepName: string,
    public readonly stepResult: any,
    public readonly completedAt: Date
  ) {
    super('SagaStepCompleted', {
      sagaId,
      stepName,
      stepResult,
      completedAt,
    });
  }
}

export class SagaCompensationTriggeredEvent extends DomainEvent {
  constructor(
    public readonly sagaId: string,
    public readonly failedStep: string,
    public readonly compensationSteps: string[],
    public readonly reason: string,
    public readonly triggeredAt: Date
  ) {
    super('SagaCompensationTriggered', {
      sagaId,
      failedStep,
      compensationSteps,
      reason,
      triggeredAt,
    });
  }
}

// Policy specifications for cross-border payments
class HighValuePaymentSpec implements ISpecification<PaymentRequest> {
  constructor(private threshold: number) {}

  isSatisfiedBy(payment: PaymentRequest): boolean {
    return payment.amount > this.threshold;
  }
}

class SanctionedCountrySpec implements ISpecification<PaymentRequest> {
  constructor(private sanctionedCountries: string[]) {}

  isSatisfiedBy(payment: PaymentRequest): boolean {
    return this.sanctionedCountries.includes(payment.destinationCountry);
  }
}

class ComplianceRiskSpec implements ISpecification<PaymentRequest> {
  isSatisfiedBy(payment: PaymentRequest): boolean {
    // Complex compliance risk calculation
    return payment.riskScore > 70;
  }
}

// ⭐ Enterprise Cross-Border Payment Saga
export class CrossBorderPaymentSaga extends BaseSaga {
  private logger = Logger.forContext('CrossBorderPaymentSaga');
  private policyEngine: PaymentPolicyEngine;
  private resiliencePolicy: any;
  private sagaState: SagaState;

  constructor(
    private eventBus: any,
    private complianceService: any,
    private exchangeRateService: any,
    private paymentService: any,
    private notificationService: any
  ) {
    super('CrossBorderPaymentSaga', 'Cross-Border Payment Processing');
    this.policyEngine = new PaymentPolicyEngine();
    this.initializeResiliencePolicy();
    this.sagaState = new SagaState();
  }

  private initializeResiliencePolicy(): void {
    this.resiliencePolicy = ResiliencePolicyBuilder.create()
      .withCircuitBreaker({
        name: 'CrossBorderPaymentSaga',
        failureThreshold: 3,
        recoveryTimeout: 60000,
        onStateChange: (previous, current, reason) => {
          this.handleCircuitBreakerStateChange(previous, current, reason);
        },
      })
      .withRetry({
        maxAttempts: 3,
        baseDelay: 2000,
        maxDelay: 30000,
        backoffMultiplier: 2,
        shouldRetry: error => {
          return (
            error.message.includes('timeout') ||
            error.message.includes('rate limit') ||
            error.message.includes('temporarily unavailable')
          );
        },
      })
      .withTimeout({
        timeout: 30000,
      })
      .build();
  }

  private async handleCircuitBreakerStateChange(
    previous: CircuitBreakerState,
    current: CircuitBreakerState,
    reason: string
  ): Promise<void> {
    await this.eventBus.publish({
      eventType: 'SagaCircuitBreakerStateChanged',
      payload: {
        sagaId: this.sagaId,
        sagaType: this.sagaType,
        previousState: previous,
        currentState: current,
        reason,
        timestamp: new Date(),
      },
    });
  }

  // Main saga orchestration method
  async handleEvent(
    event: any,
    context: ISagaExecutionContext
  ): Promise<ISagaActionResult> {
    try {
      this.logger.info('Saga handling event', {
        sagaId: this.sagaId,
        eventType: event.eventType,
        correlationId: context.correlationId,
      });

      switch (event.eventType) {
        case 'CrossBorderPaymentInitiated':
          return await this.handlePaymentInitiated(event, context);
        case 'ComplianceCheckCompleted':
          return await this.handleComplianceCheckCompleted(event, context);
        case 'ExchangeRateObtained':
          return await this.handleExchangeRateObtained(event, context);
        case 'PaymentExecuted':
          return await this.handlePaymentExecuted(event, context);
        case 'PaymentFailed':
          return await this.handlePaymentFailed(event, context);
        default:
          return {
            success: false,
            error: { message: 'Unhandled event type', code: 'UNHANDLED_EVENT' },
          };
      }
    } catch (error) {
      this.logger.error('Saga event handling failed', {
        sagaId: this.sagaId,
        eventType: event.eventType,
        error: error.message,
      });

      return {
        success: false,
        error: { message: error.message, code: 'SAGA_EXECUTION_ERROR' },
      };
    }
  }

  private async handlePaymentInitiated(
    event: CrossBorderPaymentInitiatedEvent,
    context: ISagaExecutionContext
  ): Promise<ISagaActionResult> {
    try {
      // Update saga state
      this.sagaState.updateState({
        currentStep: 'compliance-check',
        paymentData: event.payload,
        startedAt: new Date(),
      });

      // Evaluate payment policies
      const policyResult = await this.evaluatePaymentPolicies(
        event.payload,
        context
      );

      if (policyResult.isFailure()) {
        return {
          success: false,
          error: {
            message: `Policy violation: ${policyResult.error.message}`,
            code: 'POLICY_VIOLATION',
          },
        };
      }

      // Execute compliance check with resilience
      const complianceResult = await this.executeWithResilience(
        'compliance-check',
        async () => {
          return await this.complianceService.performComplianceCheck({
            paymentId: event.paymentId,
            fromAccount: event.fromAccount,
            toAccount: event.toAccount,
            amount: event.amount,
            sourceCurrency: event.sourceCurrency,
            targetCurrency: event.targetCurrency,
            paymentPurpose: event.paymentPurpose,
          });
        },
        context
      );

      if (complianceResult.isFailure()) {
        return {
          success: false,
          error: {
            message: `Compliance check failed: ${complianceResult.error.message}`,
            code: 'COMPLIANCE_FAILED',
          },
        };
      }

      // Publish step completion event
      await this.publishStepCompletedEvent(
        'compliance-check',
        complianceResult.value
      );

      return {
        success: true,
        nextStep: 'exchange-rate',
        commands: [
          {
            type: 'GetExchangeRate',
            payload: {
              sourceCurrency: event.sourceCurrency,
              targetCurrency: event.targetCurrency,
              amount: event.amount,
            },
          },
        ],
      };
    } catch (error) {
      return {
        success: false,
        error: { message: error.message, code: 'INITIATION_FAILED' },
      };
    }
  }

  private async handleComplianceCheckCompleted(
    event: any,
    context: ISagaExecutionContext
  ): Promise<ISagaActionResult> {
    try {
      this.sagaState.updateState({
        currentStep: 'exchange-rate',
        complianceResult: event.payload,
      });

      // Get exchange rate with resilience
      const exchangeRateResult = await this.executeWithResilience(
        'exchange-rate',
        async () => {
          return await this.exchangeRateService.getExchangeRate(
            this.sagaState.getState().paymentData.sourceCurrency,
            this.sagaState.getState().paymentData.targetCurrency
          );
        },
        context
      );

      if (exchangeRateResult.isFailure()) {
        return {
          success: false,
          error: {
            message: `Exchange rate failed: ${exchangeRateResult.error.message}`,
            code: 'EXCHANGE_RATE_FAILED',
          },
        };
      }

      await this.publishStepCompletedEvent(
        'exchange-rate',
        exchangeRateResult.value
      );

      return {
        success: true,
        nextStep: 'payment-execution',
        commands: [
          {
            type: 'ExecutePayment',
            payload: {
              ...this.sagaState.getState().paymentData,
              exchangeRate: exchangeRateResult.value,
              complianceApproval: event.payload.approvalId,
            },
          },
        ],
      };
    } catch (error) {
      return {
        success: false,
        error: { message: error.message, code: 'COMPLIANCE_PROCESSING_FAILED' },
      };
    }
  }

  private async handleExchangeRateObtained(
    event: any,
    context: ISagaExecutionContext
  ): Promise<ISagaActionResult> {
    try {
      this.sagaState.updateState({
        currentStep: 'payment-execution',
        exchangeRate: event.payload,
      });

      // Execute payment with resilience
      const paymentResult = await this.executeWithResilience(
        'payment-execution',
        async () => {
          const state = this.sagaState.getState();
          return await this.paymentService.executePayment({
            paymentId: state.paymentData.paymentId,
            fromAccount: state.paymentData.fromAccount,
            toAccount: state.paymentData.toAccount,
            amount: state.paymentData.amount,
            sourceCurrency: state.paymentData.sourceCurrency,
            targetCurrency: state.paymentData.targetCurrency,
            exchangeRate: state.exchangeRate,
            complianceApproval: state.complianceResult.approvalId,
          });
        },
        context
      );

      if (paymentResult.isFailure()) {
        return {
          success: false,
          error: {
            message: `Payment execution failed: ${paymentResult.error.message}`,
            code: 'PAYMENT_EXECUTION_FAILED',
          },
        };
      }

      await this.publishStepCompletedEvent(
        'payment-execution',
        paymentResult.value
      );

      return {
        success: true,
        nextStep: 'notification',
        commands: [
          {
            type: 'SendNotification',
            payload: {
              paymentId: paymentResult.value.paymentId,
              status: 'completed',
              recipients: ['sender', 'receiver'],
            },
          },
        ],
      };
    } catch (error) {
      return {
        success: false,
        error: {
          message: error.message,
          code: 'EXCHANGE_RATE_PROCESSING_FAILED',
        },
      };
    }
  }

  private async handlePaymentExecuted(
    event: any,
    context: ISagaExecutionContext
  ): Promise<ISagaActionResult> {
    try {
      this.sagaState.updateState({
        currentStep: 'notification',
        paymentResult: event.payload,
        status: SagaStatus.COMPLETED,
      });

      // Send notification
      await this.notificationService.sendPaymentCompletedNotification({
        paymentId: event.payload.paymentId,
        status: 'completed',
        completedAt: new Date(),
      });

      await this.publishStepCompletedEvent('notification', { status: 'sent' });

      return {
        success: true,
        sagaStatus: SagaStatus.COMPLETED,
        events: [
          {
            eventType: 'CrossBorderPaymentCompleted',
            payload: {
              paymentId: event.payload.paymentId,
              completedAt: new Date(),
            },
          },
        ],
      };
    } catch (error) {
      return {
        success: false,
        error: { message: error.message, code: 'NOTIFICATION_FAILED' },
      };
    }
  }

  private async handlePaymentFailed(
    event: any,
    context: ISagaExecutionContext
  ): Promise<ISagaActionResult> {
    try {
      this.logger.error('Payment failed, triggering compensation', {
        sagaId: this.sagaId,
        paymentId: event.payload.paymentId,
        reason: event.payload.reason,
      });

      // Trigger compensation
      const compensationResult = await this.compensate(
        'payment-execution',
        context
      );

      if (compensationResult.success) {
        this.sagaState.updateState({
          status: SagaStatus.COMPENSATED,
          compensationReason: event.payload.reason,
          compensatedAt: new Date(),
        });

        return {
          success: true,
          sagaStatus: SagaStatus.COMPENSATED,
          events: [
            {
              eventType: 'CrossBorderPaymentCompensated',
              payload: {
                paymentId: event.payload.paymentId,
                reason: event.payload.reason,
                compensatedAt: new Date(),
              },
            },
          ],
        };
      } else {
        this.sagaState.updateState({
          status: SagaStatus.FAILED,
          failureReason: event.payload.reason,
          failedAt: new Date(),
        });

        return {
          success: false,
          sagaStatus: SagaStatus.FAILED,
          error: {
            message: `Payment failed and compensation failed: ${compensationResult.error?.message}`,
            code: 'COMPENSATION_FAILED',
          },
        };
      }
    } catch (error) {
      return {
        success: false,
        error: { message: error.message, code: 'FAILURE_HANDLING_ERROR' },
      };
    }
  }

  // Compensation logic
  async compensate(
    stepName: string,
    context: ISagaExecutionContext
  ): Promise<ISagaActionResult> {
    try {
      this.logger.info('Starting compensation', {
        sagaId: this.sagaId,
        stepName,
        correlationId: context.correlationId,
      });

      const compensationSteps = this.determineCompensationSteps(stepName);

      // Publish compensation event
      await this.eventBus.publish(
        new SagaCompensationTriggeredEvent(
          this.sagaId,
          stepName,
          compensationSteps,
          `Compensation triggered for failed step: ${stepName}`,
          new Date()
        )
      );

      // Execute compensation steps
      for (const step of compensationSteps) {
        const stepResult = await this.executeCompensationStep(step, context);
        if (stepResult.isFailure()) {
          return {
            success: false,
            error: {
              message: `Compensation step failed: ${step} - ${stepResult.error.message}`,
              code: 'COMPENSATION_STEP_FAILED',
            },
          };
        }
      }

      return {
        success: true,
        compensationSteps: compensationSteps,
      };
    } catch (error) {
      return {
        success: false,
        error: { message: error.message, code: 'COMPENSATION_ERROR' },
      };
    }
  }

  private determineCompensationSteps(failedStep: string): string[] {
    const state = this.sagaState.getState();
    const steps = [];

    switch (failedStep) {
      case 'payment-execution':
        if (state.exchangeRate) {
          steps.push('release-exchange-rate-lock');
        }
        if (state.complianceResult) {
          steps.push('notify-compliance-failure');
        }
        steps.push('refund-fees');
        break;
      case 'exchange-rate':
        if (state.complianceResult) {
          steps.push('cancel-compliance-hold');
        }
        break;
      case 'compliance-check':
        steps.push('cleanup-payment-request');
        break;
    }

    return steps;
  }

  private async executeCompensationStep(
    step: string,
    context: ISagaExecutionContext
  ): Promise<Result<any, Error>> {
    try {
      switch (step) {
        case 'release-exchange-rate-lock':
          return await this.exchangeRateService.releaseLock(
            this.sagaState.getState().exchangeRate.lockId
          );
        case 'notify-compliance-failure':
          return await this.complianceService.notifyFailure(
            this.sagaState.getState().complianceResult.approvalId
          );
        case 'refund-fees':
          return await this.paymentService.refundFees(
            this.sagaState.getState().paymentData.paymentId
          );
        case 'cancel-compliance-hold':
          return await this.complianceService.cancelHold(
            this.sagaState.getState().complianceResult.holdId
          );
        case 'cleanup-payment-request':
          return await this.paymentService.cleanupRequest(
            this.sagaState.getState().paymentData.paymentId
          );
        default:
          return Result.failure(
            new Error(`Unknown compensation step: ${step}`)
          );
      }
    } catch (error) {
      return Result.failure(error);
    }
  }

  // Policy evaluation
  private async evaluatePaymentPolicies(
    paymentData: any,
    context: ISagaExecutionContext
  ): Promise<Result<void, Error>> {
    try {
      const policyResult = await this.policyEngine.evaluatePayment(
        paymentData,
        context
      );

      if (policyResult.isFailure()) {
        await this.eventBus.publish({
          eventType: 'PaymentPolicyViolation',
          payload: {
            sagaId: this.sagaId,
            paymentId: paymentData.paymentId,
            violations: policyResult.error.violations,
            timestamp: new Date(),
          },
        });
      }

      return policyResult;
    } catch (error) {
      return Result.failure(error);
    }
  }

  // Resilient execution wrapper
  private async executeWithResilience<T>(
    stepName: string,
    operation: () => Promise<T>,
    context: ISagaExecutionContext
  ): Promise<Result<T, Error>> {
    try {
      const result = await this.resiliencePolicy.execute(operation);

      this.logger.info('Saga step executed successfully', {
        sagaId: this.sagaId,
        stepName,
        correlationId: context.correlationId,
      });

      return Result.success(result);
    } catch (error) {
      this.logger.error('Saga step execution failed', {
        sagaId: this.sagaId,
        stepName,
        correlationId: context.correlationId,
        error: error.message,
      });

      return Result.failure(error);
    }
  }

  private async publishStepCompletedEvent(
    stepName: string,
    result: any
  ): Promise<void> {
    await this.eventBus.publish(
      new SagaStepCompletedEvent(this.sagaId, stepName, result, new Date())
    );
  }

  // Saga metadata
  canHandle(event: any): boolean {
    return [
      'CrossBorderPaymentInitiated',
      'ComplianceCheckCompleted',
      'ExchangeRateObtained',
      'PaymentExecuted',
      'PaymentFailed',
    ].includes(event.eventType);
  }

  getCorrelationData(event: any): any {
    return { paymentId: event.payload.paymentId };
  }
}

// payment-policy-engine.ts
export class PaymentPolicyEngine {
  private highValuePolicy: any;
  private sanctionsPolicy: any;
  private compliancePolicy: any;

  constructor() {
    this.initializePolicies();
  }

  private initializePolicies(): void {
    this.highValuePolicy = PolicyBuilder.create<PaymentRequest>()
      .withId('high-value-payment')
      .withDomain('payments')
      .withName('High Value Payment Policy')
      .must(new HighValuePaymentSpec(100000))
      .withCode('HIGH_VALUE_APPROVAL_REQUIRED')
      .withMessage('High value payments require additional approval')
      .withSeverity('ERROR')
      .build();

    this.sanctionsPolicy = PolicyBuilder.create<PaymentRequest>()
      .withId('sanctions-check')
      .withDomain('compliance')
      .withName('Sanctions Check Policy')
      .mustNot(new SanctionedCountrySpec(['IR', 'KP', 'SY']))
      .withCode('SANCTIONED_COUNTRY')
      .withMessage('Payments to sanctioned countries are prohibited')
      .withSeverity('ERROR')
      .build();

    this.compliancePolicy = PolicyBuilder.create<PaymentRequest>()
      .withId('compliance-risk')
      .withDomain('compliance')
      .withName('Compliance Risk Policy')
      .mustNot(new ComplianceRiskSpec())
      .withCode('HIGH_COMPLIANCE_RISK')
      .withMessage('Payment exceeds compliance risk threshold')
      .withSeverity('ERROR')
      .build();
  }

  async evaluatePayment(
    paymentData: any,
    context: ISagaExecutionContext
  ): Promise<Result<void, Error>> {
    try {
      const policyContext = PolicyContext.create()
        .withUserId(context.userId)
        .withRequestId(context.correlationId)
        .withContext(context)
        .build();

      // Evaluate all policies
      const policies = [
        this.highValuePolicy,
        this.sanctionsPolicy,
        this.compliancePolicy,
      ];

      for (const policy of policies) {
        const result = await policy.check({
          entity: paymentData,
          context: policyContext,
        });

        if (result.isFailure()) {
          return Result.failure(
            new Error(`Policy violation: ${result.error.message}`)
          );
        }
      }

      return Result.success(undefined);
    } catch (error) {
      return Result.failure(error);
    }
  }
}

// enterprise-saga-orchestrator.ts
import {
  SagaOrchestrator,
  ISagaDefinition,
  InMemorySagaRepository,
} from '@vytches-ddd/messaging';
import { DomainService, ServiceLifetime } from '@vytches-ddd/di';

// ⭐ Enterprise Saga Orchestrator with Full Integration
@DomainService('enterpriseSagaOrchestrator', {
  lifetime: ServiceLifetime.Singleton,
  context: 'PaymentProcessing',
})
export class EnterpriseSagaOrchestrator extends SagaOrchestrator {
  private logger = Logger.forContext('EnterpriseSagaOrchestrator');

  constructor(
    private eventBus: any,
    private complianceService: any,
    private exchangeRateService: any,
    private paymentService: any,
    private notificationService: any
  ) {
    const sagaRepository = new InMemorySagaRepository({
      enableOptimisticLocking: true,
      enableAuditLog: true,
      retentionPolicy: {
        completedAfterDays: 30,
        compensatedAfterDays: 90,
        failedAfterDays: 180,
      },
    });

    super(sagaRepository, {
      maxConcurrentExecutions: 100,
      enableMetrics: true,
      enableAutoRetry: true,
      enableCircuitBreaker: true,
    });

    this.registerSagas();
  }

  private registerSagas(): void {
    // Register cross-border payment saga
    const crossBorderPaymentSaga: ISagaDefinition = {
      sagaType: 'CrossBorderPaymentSaga',
      displayName: 'Cross-Border Payment Processing',
      description:
        'Handles cross-border payment processing with compliance and exchange rate management',
      startEvents: ['CrossBorderPaymentInitiated'],
      defaultTimeout: 1800000, // 30 minutes
      maxInstances: 1000,
      steps: [
        { name: 'compliance-check', timeout: 300000, retries: 3 },
        { name: 'exchange-rate', timeout: 60000, retries: 2 },
        { name: 'payment-execution', timeout: 600000, retries: 1 },
        { name: 'notification', timeout: 30000, retries: 3 },
      ],
      createInstance: async (event, context) => {
        return new CrossBorderPaymentSaga(
          this.eventBus,
          this.complianceService,
          this.exchangeRateService,
          this.paymentService,
          this.notificationService
        );
      },
      getCorrelationData: event => ({ paymentId: event.payload.paymentId }),
      validate: event => {
        const errors = [];
        if (!event.payload.paymentId) errors.push('paymentId is required');
        if (!event.payload.amount || event.payload.amount <= 0)
          errors.push('amount must be positive');
        return errors;
      },
    };

    this.registerSagaDefinition(crossBorderPaymentSaga);

    this.logger.info('Enterprise saga orchestrator initialized', {
      registeredSagas: 1,
      maxConcurrentExecutions: 100,
    });
  }
}
```

## Key Features

- **Policy-Driven Behavior**: Business rules determine saga execution paths
- **Comprehensive Resilience**: Circuit breaker, retry, and timeout patterns
- **Event-Driven Architecture**: Full integration with events system
- **Advanced Compensation**: Sophisticated rollback logic for failed
  transactions
- **Regulatory Compliance**: Complete audit trail and monitoring
- **Enterprise Orchestration**: Scalable saga management with metrics

## Usage Example

```typescript
// Usage in payment application
export class PaymentController {
  constructor(
    private sagaOrchestrator: EnterpriseSagaOrchestrator,
    private eventBus: UnifiedEventBus
  ) {}

  async initiateCrossBorderPayment(
    paymentRequest: PaymentRequest
  ): Promise<Result<{ sagaId: string }, Error>> {
    try {
      // Create payment initiated event
      const event = new CrossBorderPaymentInitiatedEvent(
        paymentRequest.paymentId,
        paymentRequest.fromAccount,
        paymentRequest.toAccount,
        paymentRequest.amount,
        paymentRequest.sourceCurrency,
        paymentRequest.targetCurrency,
        paymentRequest.paymentPurpose,
        new Date()
      );

      // Start saga through orchestrator
      const sagaResult = await this.sagaOrchestrator.processEvent(event, {
        correlationId: paymentRequest.paymentId,
        userId: paymentRequest.initiatorId,
      });

      if (sagaResult.isFailure()) {
        return Result.failure(sagaResult.error);
      }

      return Result.success({
        sagaId: sagaResult.value.sagaId,
      });
    } catch (error) {
      return Result.failure(
        new Error(`Payment initiation failed: ${error.message}`)
      );
    }
  }

  async getSagaStatus(sagaId: string): Promise<{
    status: string;
    currentStep: string;
    completedSteps: string[];
    errors: any[];
  }> {
    const saga = await this.sagaOrchestrator.getSaga(sagaId);

    return {
      status: saga.status,
      currentStep: saga.currentStep,
      completedSteps: saga.completedSteps,
      errors: saga.errors,
    };
  }
}
```

## Common Pitfalls

- **Saga Complexity**: Keep sagas focused on orchestration, not business logic
- **Compensation Order**: Ensure compensation steps are executed in reverse
  order
- **State Management**: Maintain consistent saga state across failures
- **Policy Integration**: Don't duplicate business rules between policies and
  sagas
- **Timeout Configuration**: Set appropriate timeouts for external service calls
- **Event Correlation**: Maintain proper correlation IDs throughout the saga
  lifecycle
