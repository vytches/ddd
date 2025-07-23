# Enterprise Domain Orchestration - Advanced Example

**Version**: 1.0.0 **Package**: @vytches-ddd/domain-primitives **Complexity**:
advanced **Domain**: Domain Orchestration **Patterns**: Domain Orchestration,
Event-Driven Architecture, CQRS Integration, Cross-Domain Communication
**Dependencies**: BaseError, IDomainError, IActor, Error Enums, Actor Error

## Description

Demonstrates sophisticated enterprise domain orchestration using domain
primitives as the foundation for complex multi-domain coordination, event-driven
communication, CQRS integration, and advanced error propagation patterns across
bounded contexts.

## Business Context

Large enterprise with multiple bounded contexts (Customer Management, Order
Processing, Payment Systems, Inventory, Logistics) requiring sophisticated
coordination, distributed transactions, event choreography, and comprehensive
error handling with regulatory compliance and audit requirements.

## Code Example

```typescript
// domain-orchestrator.ts
import {
  BaseError,
  IDomainError,
  IActor,
  ActorError,
  DomainErrorCode,
  type DomainErrorOptions,
} from '@vytches-ddd/domain-primitives';
import {
  DomainContext,
  CrossDomainEvent,
  OrchestrationSaga,
  DomainCapabilities,
  CompensationStrategy,
} from './types'; // From your app

/**
 * Enterprise domain orchestration error hierarchy
 */
export abstract class DomainOrchestrationError
  extends BaseError
  implements IDomainError
{
  public readonly domain = 'DomainOrchestration';
  public readonly boundedContext: string;
  public readonly correlationId: string;
  public readonly sagaId?: string;
  public readonly affectedDomains: string[];
  public readonly orchestrationPhase: OrchestrationPhase;

  constructor(
    message: string,
    code: DomainErrorCode,
    boundedContext: string,
    correlationId: string,
    orchestrationPhase: OrchestrationPhase,
    options: DomainErrorOptions & {
      sagaId?: string;
      affectedDomains?: string[];
    } = {}
  ) {
    super(message, { code, ...options });
    this.boundedContext = boundedContext;
    this.correlationId = correlationId;
    this.sagaId = options.sagaId;
    this.affectedDomains = options.affectedDomains || [];
    this.orchestrationPhase = orchestrationPhase;
  }

  /**
   * Get orchestration context for error handling
   */
  getOrchestrationContext(): OrchestrationErrorContext {
    return {
      domain: this.domain,
      boundedContext: this.boundedContext,
      correlationId: this.correlationId,
      sagaId: this.sagaId,
      affectedDomains: this.affectedDomains,
      orchestrationPhase: this.orchestrationPhase,
      timestamp: new Date(),
      errorCode: this.code,
    };
  }

  /**
   * Determine if error requires saga compensation
   */
  abstract requiresCompensation(): boolean;

  /**
   * Get compensation strategy for this error
   */
  abstract getCompensationStrategy(): CompensationStrategy;

  /**
   * Check if error affects other domains
   */
  hasCrossDomainImpact(): boolean {
    return this.affectedDomains.length > 1;
  }
}

/**
 * Cross-domain coordination failure
 */
export class CrossDomainCoordinationError extends DomainOrchestrationError {
  public readonly coordinationType: 'SAGA' | 'CHOREOGRAPHY' | 'ORCHESTRATION';
  public readonly failedDomains: DomainFailureContext[];
  public readonly coordinationTimeout: boolean;

  constructor(
    message: string,
    boundedContext: string,
    correlationId: string,
    coordinationType: 'SAGA' | 'CHOREOGRAPHY' | 'ORCHESTRATION',
    failedDomains: DomainFailureContext[],
    options: DomainErrorOptions & {
      sagaId?: string;
      coordinationTimeout?: boolean;
    } = {}
  ) {
    super(
      message,
      DomainErrorCode.COORDINATION_FAILED,
      boundedContext,
      correlationId,
      'COORDINATION',
      {
        affectedDomains: failedDomains.map(d => d.domainName),
        ...options,
      }
    );

    this.coordinationType = coordinationType;
    this.failedDomains = failedDomains;
    this.coordinationTimeout = options.coordinationTimeout || false;
  }

  requiresCompensation(): boolean {
    return this.coordinationType === 'SAGA' || this.failedDomains.length > 0;
  }

  getCompensationStrategy(): CompensationStrategy {
    if (this.coordinationType === 'SAGA') {
      return {
        type: 'SAGA_COMPENSATION',
        priority: 'HIGH',
        compensationOrder: this.calculateCompensationOrder(),
        timeoutMinutes: 30,
        retryPolicy: {
          maxAttempts: 3,
          backoffStrategy: 'EXPONENTIAL',
        },
      };
    }

    return {
      type: 'MANUAL_INTERVENTION',
      priority: 'CRITICAL',
      compensationOrder: [],
      timeoutMinutes: 0,
      requiresApproval: true,
    };
  }

  /**
   * Get detailed failure analysis
   */
  getFailureAnalysis(): CrossDomainFailureAnalysis {
    return {
      coordinationType: this.coordinationType,
      totalDomains: this.affectedDomains.length,
      failedDomains: this.failedDomains.length,
      successfulDomains:
        this.affectedDomains.length - this.failedDomains.length,
      failurePattern: this.identifyFailurePattern(),
      rootCause: this.identifyRootCause(),
      recoveryComplexity: this.assessRecoveryComplexity(),
      businessImpact: this.assessBusinessImpact(),
    };
  }

  private calculateCompensationOrder(): string[] {
    // Calculate optimal compensation order based on dependencies
    return this.failedDomains
      .sort((a, b) => (b.dependencyLevel || 0) - (a.dependencyLevel || 0))
      .map(domain => domain.domainName);
  }

  private identifyFailurePattern():
    | 'CASCADING'
    | 'ISOLATED'
    | 'TIMEOUT'
    | 'RESOURCE_EXHAUSTION' {
    if (this.coordinationTimeout) return 'TIMEOUT';
    if (this.failedDomains.length === 1) return 'ISOLATED';
    if (this.failedDomains.some(d => d.failureReason?.includes('TIMEOUT')))
      return 'TIMEOUT';
    if (this.failedDomains.some(d => d.failureReason?.includes('RESOURCE')))
      return 'RESOURCE_EXHAUSTION';
    return 'CASCADING';
  }

  private identifyRootCause(): string {
    // Analyze failed domains to identify root cause
    const commonReasons = this.failedDomains
      .map(d => d.failureReason)
      .filter(Boolean)
      .reduce(
        (acc, reason) => {
          acc[reason!] = (acc[reason!] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

    return (
      Object.keys(commonReasons).reduce((a, b) =>
        commonReasons[a] > commonReasons[b] ? a : b
      ) || 'UNKNOWN'
    );
  }

  private assessRecoveryComplexity(): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const complexity =
      this.failedDomains.length * 2 +
      (this.coordinationTimeout ? 3 : 0) +
      (this.coordinationType === 'SAGA' ? 1 : 2);

    if (complexity >= 10) return 'CRITICAL';
    if (complexity >= 7) return 'HIGH';
    if (complexity >= 4) return 'MEDIUM';
    return 'LOW';
  }

  private assessBusinessImpact(): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    // Assess based on affected domains and their criticality
    const criticalDomains = [
      'PaymentProcessing',
      'OrderFulfillment',
      'CustomerManagement',
    ];
    const hasCriticalDomains = this.affectedDomains.some(domain =>
      criticalDomains.includes(domain)
    );

    if (hasCriticalDomains && this.failedDomains.length > 2) return 'CRITICAL';
    if (hasCriticalDomains || this.failedDomains.length > 1) return 'HIGH';
    return 'MEDIUM';
  }
}

/**
 * Distributed transaction failure with advanced recovery
 */
export class DistributedTransactionError extends DomainOrchestrationError {
  public readonly transactionId: string;
  public readonly transactionType:
    | 'XA'
    | 'SAGA'
    | 'TCC'
    | 'EVENTUAL_CONSISTENCY';
  public readonly participantStates: ParticipantState[];
  public readonly rollbackRequired: boolean;

  constructor(
    message: string,
    boundedContext: string,
    correlationId: string,
    transactionId: string,
    transactionType: 'XA' | 'SAGA' | 'TCC' | 'EVENTUAL_CONSISTENCY',
    participantStates: ParticipantState[],
    options: DomainErrorOptions & {
      rollbackRequired?: boolean;
    } = {}
  ) {
    super(
      message,
      DomainErrorCode.TRANSACTION_FAILED,
      boundedContext,
      correlationId,
      'TRANSACTION',
      {
        affectedDomains: participantStates.map(p => p.domain),
        ...options,
      }
    );

    this.transactionId = transactionId;
    this.transactionType = transactionType;
    this.participantStates = participantStates;
    this.rollbackRequired = options.rollbackRequired || this.shouldRollback();
  }

  requiresCompensation(): boolean {
    return (
      this.rollbackRequired ||
      this.participantStates.some(
        p => p.state === 'COMMITTED' || p.state === 'PREPARED'
      )
    );
  }

  getCompensationStrategy(): CompensationStrategy {
    switch (this.transactionType) {
      case 'SAGA':
        return {
          type: 'SAGA_COMPENSATION',
          priority: 'HIGH',
          compensationOrder: this.calculateSagaCompensationOrder(),
          timeoutMinutes: 15,
          retryPolicy: {
            maxAttempts: 5,
            backoffStrategy: 'EXPONENTIAL',
          },
        };

      case 'TCC':
        return {
          type: 'TCC_CANCEL',
          priority: 'HIGH',
          compensationOrder: this.participantStates.map(p => p.domain),
          timeoutMinutes: 10,
          retryPolicy: {
            maxAttempts: 3,
            backoffStrategy: 'FIXED',
          },
        };

      case 'XA':
        return {
          type: 'XA_ROLLBACK',
          priority: 'CRITICAL',
          compensationOrder: this.participantStates.map(p => p.domain),
          timeoutMinutes: 5,
          retryPolicy: {
            maxAttempts: 1,
            backoffStrategy: 'NONE',
          },
        };

      default:
        return {
          type: 'EVENTUAL_CONSISTENCY_REPAIR',
          priority: 'MEDIUM',
          compensationOrder: [],
          timeoutMinutes: 60,
          retryPolicy: {
            maxAttempts: 10,
            backoffStrategy: 'LINEAR',
          },
        };
    }
  }

  /**
   * Get distributed transaction analysis
   */
  getTransactionAnalysis(): DistributedTransactionAnalysis {
    return {
      transactionId: this.transactionId,
      transactionType: this.transactionType,
      totalParticipants: this.participantStates.length,
      committedParticipants: this.participantStates.filter(
        p => p.state === 'COMMITTED'
      ).length,
      preparedParticipants: this.participantStates.filter(
        p => p.state === 'PREPARED'
      ).length,
      failedParticipants: this.participantStates.filter(
        p => p.state === 'FAILED'
      ).length,
      abortedParticipants: this.participantStates.filter(
        p => p.state === 'ABORTED'
      ).length,
      consistencyState: this.assessConsistencyState(),
      recoveryStrategy: this.getCompensationStrategy().type,
      estimatedRecoveryTime: this.estimateRecoveryTime(),
    };
  }

  private shouldRollback(): boolean {
    const committedCount = this.participantStates.filter(
      p => p.state === 'COMMITTED'
    ).length;
    const failedCount = this.participantStates.filter(
      p => p.state === 'FAILED'
    ).length;

    // Rollback if more participants failed than succeeded
    return failedCount > committedCount;
  }

  private calculateSagaCompensationOrder(): string[] {
    // Reverse order of successful participants for saga compensation
    return this.participantStates
      .filter(p => p.state === 'COMMITTED')
      .sort((a, b) => (b.order || 0) - (a.order || 0))
      .map(p => p.domain);
  }

  private assessConsistencyState(): 'CONSISTENT' | 'INCONSISTENT' | 'UNKNOWN' {
    const committedCount = this.participantStates.filter(
      p => p.state === 'COMMITTED'
    ).length;
    const totalCount = this.participantStates.length;

    if (committedCount === 0 || committedCount === totalCount) {
      return 'CONSISTENT';
    }

    return 'INCONSISTENT';
  }

  private estimateRecoveryTime(): number {
    const baseTime = this.participantStates.length * 30; // 30 seconds per participant
    const complexityMultiplier =
      this.transactionType === 'XA'
        ? 0.5
        : this.transactionType === 'SAGA'
          ? 1.5
          : 1.0;

    return Math.round(baseTime * complexityMultiplier);
  }
}

/**
 * Enterprise Domain Orchestrator
 */
export class EnterpriseDomainOrchestrator {
  private domainRegistry: Map<string, DomainContext> = new Map();
  private activeOrchestrations: Map<string, OrchestrationSaga> = new Map();
  private compensationHandlers: Map<string, CompensationHandler> = new Map();
  private eventBridge: CrossDomainEventBridge;
  private metricsCollector: OrchestrationMetricsCollector;
  private auditLogger: OrchestrationAuditLogger;

  constructor(
    eventBridge: CrossDomainEventBridge,
    metricsCollector: OrchestrationMetricsCollector,
    auditLogger: OrchestrationAuditLogger
  ) {
    this.eventBridge = eventBridge;
    this.metricsCollector = metricsCollector;
    this.auditLogger = auditLogger;
  }

  /**
   * Register domain context with orchestrator
   */
  async registerDomain(
    domainName: string,
    domainContext: DomainContext,
    actor: IActor
  ): Promise<void> {
    try {
      // Validate actor has domain registration permissions
      if (!this.canRegisterDomain(actor, domainName)) {
        throw new ActorError(
          `Actor ${actor.id} cannot register domain: ${domainName}`,
          'DOMAIN_REGISTRATION_DENIED',
          { actorId: actor.id, domainName }
        );
      }

      // Validate domain capabilities
      await this.validateDomainCapabilities(domainContext);

      // Register domain
      this.domainRegistry.set(domainName, domainContext);

      // Setup cross-domain event handlers
      await this.setupDomainEventHandlers(domainName, domainContext);

      // Record registration
      await this.auditLogger.logDomainRegistration(
        domainName,
        domainContext,
        actor
      );

      console.log(`Domain registered: ${domainName}`);
    } catch (error) {
      await this.auditLogger.logDomainRegistrationFailure(
        domainName,
        error,
        actor
      );
      throw error;
    }
  }

  /**
   * Initiate cross-domain orchestration saga
   */
  async initiateOrchestration(
    orchestrationId: string,
    orchestrationType: 'SAGA' | 'CHOREOGRAPHY' | 'COMMAND_ORCHESTRATION',
    targetDomains: string[],
    orchestrationData: any,
    initiatingActor: IActor,
    options: OrchestrationOptions = {}
  ): Promise<OrchestrationResult> {
    const correlationId = `CORR-${Date.now()}-${orchestrationId}`;
    const saga: OrchestrationSaga = {
      id: orchestrationId,
      correlationId,
      type: orchestrationType,
      targetDomains,
      initiatedBy: initiatingActor.id,
      initiatedAt: new Date(),
      currentPhase: 'INITIALIZATION',
      participantStates: targetDomains.map(domain => ({
        domain,
        state: 'PENDING',
        order: this.getDomainOrder(domain),
      })),
      orchestrationData,
      options,
      compensationRequired: false,
      compensationSteps: [],
    };

    try {
      // Validate orchestration permissions
      if (!this.canInitiateOrchestration(initiatingActor, targetDomains)) {
        throw new CrossDomainCoordinationError(
          'Insufficient permissions for cross-domain orchestration',
          'DomainOrchestration',
          correlationId,
          orchestrationType,
          [],
          { sagaId: orchestrationId }
        );
      }

      // Validate target domains are registered
      const unregisteredDomains = targetDomains.filter(
        domain => !this.domainRegistry.has(domain)
      );

      if (unregisteredDomains.length > 0) {
        throw new CrossDomainCoordinationError(
          `Unregistered domains: ${unregisteredDomains.join(', ')}`,
          'DomainOrchestration',
          correlationId,
          orchestrationType,
          unregisteredDomains.map(domain => ({
            domainName: domain,
            failureReason: 'DOMAIN_NOT_REGISTERED',
          })),
          { sagaId: orchestrationId }
        );
      }

      // Store active orchestration
      this.activeOrchestrations.set(orchestrationId, saga);

      // Execute orchestration based on type
      const result = await this.executeOrchestration(saga);

      await this.auditLogger.logOrchestrationInitiated(
        saga,
        result,
        initiatingActor
      );
      await this.metricsCollector.recordOrchestrationStart(saga);

      return result;
    } catch (error) {
      const orchestrationError = error as DomainOrchestrationError;

      // Initiate compensation if required
      if (orchestrationError.requiresCompensation()) {
        await this.initiateCompensation(saga, orchestrationError);
      }

      await this.auditLogger.logOrchestrationFailure(
        saga,
        error,
        initiatingActor
      );
      await this.metricsCollector.recordOrchestrationFailure(saga, error);

      throw error;
    }
  }

  /**
   * Execute orchestration based on type
   */
  private async executeOrchestration(
    saga: OrchestrationSaga
  ): Promise<OrchestrationResult> {
    switch (saga.type) {
      case 'SAGA':
        return await this.executeSagaOrchestration(saga);

      case 'CHOREOGRAPHY':
        return await this.executeChoreographyOrchestration(saga);

      case 'COMMAND_ORCHESTRATION':
        return await this.executeCommandOrchestration(saga);

      default:
        throw new CrossDomainCoordinationError(
          `Unsupported orchestration type: ${saga.type}`,
          'DomainOrchestration',
          saga.correlationId,
          saga.type,
          []
        );
    }
  }

  /**
   * Execute SAGA orchestration with compensation support
   */
  private async executeSagaOrchestration(
    saga: OrchestrationSaga
  ): Promise<OrchestrationResult> {
    const result: OrchestrationResult = {
      orchestrationId: saga.id,
      correlationId: saga.correlationId,
      success: true,
      completedDomains: [],
      failedDomains: [],
      compensationRequired: false,
      duration: 0,
      metadata: {},
    };

    const startTime = Date.now();
    saga.currentPhase = 'EXECUTION';

    try {
      // Execute saga steps in order
      for (const participant of saga.participantStates.sort(
        (a, b) => (a.order || 0) - (b.order || 0)
      )) {
        const domainContext = this.domainRegistry.get(participant.domain)!;

        try {
          // Update participant state
          participant.state = 'EXECUTING';
          participant.startedAt = new Date();

          // Execute domain operation
          const domainResult = await this.executeDomainOperation(
            participant.domain,
            domainContext,
            saga.orchestrationData,
            saga.correlationId
          );

          // Update participant state on success
          participant.state = 'COMMITTED';
          participant.completedAt = new Date();
          participant.result = domainResult;

          result.completedDomains.push(participant.domain);
          saga.compensationSteps.push({
            domain: participant.domain,
            compensationAction: domainContext.compensationActions?.get(
              saga.orchestrationData.operationType
            ),
            executedAt: new Date(),
          });
        } catch (error) {
          // Update participant state on failure
          participant.state = 'FAILED';
          participant.completedAt = new Date();
          participant.error = error.message;

          result.failedDomains.push({
            domainName: participant.domain,
            failureReason: error.message,
          });

          // Saga failure requires compensation
          result.success = false;
          result.compensationRequired = true;
          saga.compensationRequired = true;

          throw new CrossDomainCoordinationError(
            `SAGA step failed in domain: ${participant.domain}`,
            'DomainOrchestration',
            saga.correlationId,
            'SAGA',
            result.failedDomains,
            { sagaId: saga.id }
          );
        }
      }

      saga.currentPhase = 'COMPLETED';
      result.duration = Date.now() - startTime;

      return result;
    } catch (error) {
      saga.currentPhase = 'FAILED';
      result.duration = Date.now() - startTime;

      // Initiate compensation for completed steps
      if (saga.compensationRequired) {
        await this.executeCompensation(saga);
      }

      throw error;
    }
  }

  /**
   * Execute choreography orchestration with event coordination
   */
  private async executeChoreographyOrchestration(
    saga: OrchestrationSaga
  ): Promise<OrchestrationResult> {
    const result: OrchestrationResult = {
      orchestrationId: saga.id,
      correlationId: saga.correlationId,
      success: true,
      completedDomains: [],
      failedDomains: [],
      compensationRequired: false,
      duration: 0,
      metadata: {
        choreographyType: 'EVENT_DRIVEN',
      },
    };

    const startTime = Date.now();
    saga.currentPhase = 'EXECUTION';

    try {
      // Publish initial choreography event
      const choreographyEvent: CrossDomainEvent = {
        id: `EVENT-${Date.now()}-${saga.correlationId}`,
        type: 'CHOREOGRAPHY_INITIATED',
        correlationId: saga.correlationId,
        sagaId: saga.id,
        sourceContext: 'DomainOrchestration',
        targetContexts: saga.targetDomains,
        payload: saga.orchestrationData,
        timestamp: new Date(),
        metadata: {
          choreographyId: saga.id,
          expectedResponses: saga.targetDomains.length,
        },
      };

      await this.eventBridge.publishCrossDomainEvent(choreographyEvent);

      // Wait for choreography completion or timeout
      const choreographyTimeout = saga.options.timeoutMinutes || 30;
      const choreographyResult = await this.waitForChoreographyCompletion(
        saga.correlationId,
        saga.targetDomains,
        choreographyTimeout * 60 * 1000
      );

      result.completedDomains = choreographyResult.completedDomains;
      result.failedDomains = choreographyResult.failedDomains;
      result.success = choreographyResult.success;
      result.duration = Date.now() - startTime;

      saga.currentPhase = result.success ? 'COMPLETED' : 'FAILED';

      return result;
    } catch (error) {
      saga.currentPhase = 'FAILED';
      result.success = false;
      result.duration = Date.now() - startTime;
      throw error;
    }
  }

  /**
   * Execute command orchestration with direct domain calls
   */
  private async executeCommandOrchestration(
    saga: OrchestrationSaga
  ): Promise<OrchestrationResult> {
    const result: OrchestrationResult = {
      orchestrationId: saga.id,
      correlationId: saga.correlationId,
      success: true,
      completedDomains: [],
      failedDomains: [],
      compensationRequired: false,
      duration: 0,
      metadata: {
        orchestrationType: 'COMMAND_DRIVEN',
      },
    };

    const startTime = Date.now();
    saga.currentPhase = 'EXECUTION';

    const executionPromises = saga.targetDomains.map(async domainName => {
      const domainContext = this.domainRegistry.get(domainName)!;

      try {
        const domainResult = await this.executeDomainCommand(
          domainName,
          domainContext,
          saga.orchestrationData,
          saga.correlationId
        );

        result.completedDomains.push(domainName);
        return { domain: domainName, success: true, result: domainResult };
      } catch (error) {
        result.failedDomains.push({
          domainName,
          failureReason: error.message,
        });
        return { domain: domainName, success: false, error: error.message };
      }
    });

    try {
      const executionResults = await Promise.allSettled(executionPromises);

      const failedCount = executionResults.filter(
        r =>
          r.status === 'rejected' ||
          (r.status === 'fulfilled' && !r.value.success)
      ).length;

      result.success = failedCount === 0;
      result.duration = Date.now() - startTime;

      saga.currentPhase = result.success ? 'COMPLETED' : 'FAILED';

      if (!result.success) {
        throw new CrossDomainCoordinationError(
          `Command orchestration failed: ${failedCount}/${saga.targetDomains.length} domains failed`,
          'DomainOrchestration',
          saga.correlationId,
          'COMMAND_ORCHESTRATION',
          result.failedDomains
        );
      }

      return result;
    } catch (error) {
      saga.currentPhase = 'FAILED';
      result.success = false;
      result.duration = Date.now() - startTime;
      throw error;
    }
  }

  /**
   * Initiate compensation for failed orchestration
   */
  private async initiateCompensation(
    saga: OrchestrationSaga,
    error: DomainOrchestrationError
  ): Promise<void> {
    const compensationStrategy = error.getCompensationStrategy();

    try {
      saga.currentPhase = 'COMPENSATING';
      saga.compensationStartedAt = new Date();

      await this.auditLogger.logCompensationInitiated(
        saga,
        compensationStrategy,
        error
      );

      switch (compensationStrategy.type) {
        case 'SAGA_COMPENSATION':
          await this.executeSagaCompensation(saga, compensationStrategy);
          break;

        case 'TCC_CANCEL':
          await this.executeTCCCompensation(saga, compensationStrategy);
          break;

        case 'XA_ROLLBACK':
          await this.executeXACompensation(saga, compensationStrategy);
          break;

        case 'MANUAL_INTERVENTION':
          await this.initiateManualCompensation(saga, compensationStrategy);
          break;

        default:
          await this.executeEventualConsistencyRepair(
            saga,
            compensationStrategy
          );
          break;
      }

      saga.currentPhase = 'COMPENSATED';
      saga.compensationCompletedAt = new Date();

      await this.auditLogger.logCompensationCompleted(saga);
    } catch (compensationError) {
      saga.currentPhase = 'COMPENSATION_FAILED';
      await this.auditLogger.logCompensationFailed(saga, compensationError);

      // Escalate to manual intervention
      await this.escalateToManualIntervention(saga, error, compensationError);
    }
  }

  /**
   * Execute saga-specific compensation
   */
  private async executeCompensation(saga: OrchestrationSaga): Promise<void> {
    const compensationSteps = [...saga.compensationSteps].reverse(); // Reverse order

    for (const step of compensationSteps) {
      if (!step.compensationAction) {
        continue; // Skip if no compensation action defined
      }

      try {
        const domainContext = this.domainRegistry.get(step.domain)!;
        await this.executeDomainCompensation(
          step.domain,
          domainContext,
          step.compensationAction,
          saga.correlationId
        );

        step.compensatedAt = new Date();
      } catch (error) {
        step.compensationError = error.message;

        // Log compensation failure but continue with others
        await this.auditLogger.logCompensationStepFailed(saga, step, error);
      }
    }
  }

  /**
   * Generate comprehensive orchestration report
   */
  async generateOrchestrationReport(
    timeframe: { start: Date; end: Date },
    domainFilter?: string[]
  ): Promise<OrchestrationReport> {
    const activeOrchestrations = Array.from(
      this.activeOrchestrations.values()
    ).filter(
      saga =>
        saga.initiatedAt >= timeframe.start &&
        saga.initiatedAt <= timeframe.end &&
        (!domainFilter ||
          saga.targetDomains.some(domain => domainFilter.includes(domain)))
    );

    const report: OrchestrationReport = {
      timeframe,
      totalOrchestrations: activeOrchestrations.length,
      orchestrationTypeBreakdown:
        this.calculateOrchestrationTypeBreakdown(activeOrchestrations),
      phaseBreakdown: this.calculatePhaseBreakdown(activeOrchestrations),
      successRate: this.calculateSuccessRate(activeOrchestrations),
      averageDuration: this.calculateAverageDuration(activeOrchestrations),
      compensationMetrics:
        await this.calculateCompensationMetrics(activeOrchestrations),
      domainParticipation:
        this.calculateDomainParticipation(activeOrchestrations),
      errorAnalysis:
        await this.analyzeOrchestrationErrors(activeOrchestrations),
      performanceMetrics:
        await this.metricsCollector.getPerformanceMetrics(timeframe),
      recommendations:
        this.generateOrchestrationRecommendations(activeOrchestrations),
    };

    return report;
  }

  // Private helper methods implementation
  private canRegisterDomain(actor: IActor, domainName: string): boolean {
    // Implementation for domain registration permission check
    return true; // Simplified for example
  }

  private async validateDomainCapabilities(
    domainContext: DomainContext
  ): Promise<void> {
    // Validate domain context has required capabilities
  }

  private async setupDomainEventHandlers(
    domainName: string,
    domainContext: DomainContext
  ): Promise<void> {
    // Setup event handlers for cross-domain communication
  }

  private getDomainOrder(domain: string): number {
    // Return execution order for domain (based on dependencies)
    return 1;
  }

  private canInitiateOrchestration(
    actor: IActor,
    targetDomains: string[]
  ): boolean {
    // Check if actor can initiate orchestration for target domains
    return true; // Simplified for example
  }

  private async executeDomainOperation(
    domain: string,
    domainContext: DomainContext,
    data: any,
    correlationId: string
  ): Promise<any> {
    // Execute operation in target domain
    return { success: true };
  }

  private async executeDomainCommand(
    domain: string,
    domainContext: DomainContext,
    data: any,
    correlationId: string
  ): Promise<any> {
    // Execute command in target domain
    return { success: true };
  }

  private async executeDomainCompensation(
    domain: string,
    domainContext: DomainContext,
    compensationAction: any,
    correlationId: string
  ): Promise<any> {
    // Execute compensation action in domain
    return { success: true };
  }

  private async waitForChoreographyCompletion(
    correlationId: string,
    targetDomains: string[],
    timeoutMs: number
  ): Promise<{
    completedDomains: string[];
    failedDomains: DomainFailureContext[];
    success: boolean;
  }> {
    // Wait for choreography completion with timeout
    return {
      completedDomains: targetDomains,
      failedDomains: [],
      success: true,
    };
  }

  private async executeSagaCompensation(
    saga: OrchestrationSaga,
    strategy: CompensationStrategy
  ): Promise<void> {
    // Execute SAGA-specific compensation
  }

  private async executeTCCCompensation(
    saga: OrchestrationSaga,
    strategy: CompensationStrategy
  ): Promise<void> {
    // Execute TCC (Try-Confirm-Cancel) compensation
  }

  private async executeXACompensation(
    saga: OrchestrationSaga,
    strategy: CompensationStrategy
  ): Promise<void> {
    // Execute XA transaction rollback
  }

  private async initiateManualCompensation(
    saga: OrchestrationSaga,
    strategy: CompensationStrategy
  ): Promise<void> {
    // Initiate manual intervention workflow
  }

  private async executeEventualConsistencyRepair(
    saga: OrchestrationSaga,
    strategy: CompensationStrategy
  ): Promise<void> {
    // Execute eventual consistency repair mechanisms
  }

  private async escalateToManualIntervention(
    saga: OrchestrationSaga,
    originalError: DomainOrchestrationError,
    compensationError: Error
  ): Promise<void> {
    // Escalate to manual intervention when compensation fails
  }

  // Report calculation methods
  private calculateOrchestrationTypeBreakdown(
    orchestrations: OrchestrationSaga[]
  ): Record<string, number> {
    return orchestrations.reduce(
      (acc, saga) => {
        acc[saga.type] = (acc[saga.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
  }

  private calculatePhaseBreakdown(
    orchestrations: OrchestrationSaga[]
  ): Record<string, number> {
    return orchestrations.reduce(
      (acc, saga) => {
        acc[saga.currentPhase] = (acc[saga.currentPhase] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
  }

  private calculateSuccessRate(orchestrations: OrchestrationSaga[]): number {
    if (orchestrations.length === 0) return 0;
    const completed = orchestrations.filter(
      saga => saga.currentPhase === 'COMPLETED'
    ).length;
    return (completed / orchestrations.length) * 100;
  }

  private calculateAverageDuration(
    orchestrations: OrchestrationSaga[]
  ): number {
    const completedOrchestrations = orchestrations.filter(
      saga =>
        saga.currentPhase === 'COMPLETED' &&
        saga.participantStates.every(p => p.completedAt)
    );

    if (completedOrchestrations.length === 0) return 0;

    const totalDuration = completedOrchestrations.reduce((sum, saga) => {
      const startTime = saga.initiatedAt.getTime();
      const endTime = Math.max(
        ...saga.participantStates.map(p => p.completedAt!.getTime())
      );
      return sum + (endTime - startTime);
    }, 0);

    return totalDuration / completedOrchestrations.length;
  }

  private async calculateCompensationMetrics(
    orchestrations: OrchestrationSaga[]
  ): Promise<CompensationMetrics> {
    const compensatedOrchestrations = orchestrations.filter(
      saga => saga.compensationRequired
    );

    return {
      totalCompensations: compensatedOrchestrations.length,
      successfulCompensations: compensatedOrchestrations.filter(
        saga => saga.currentPhase === 'COMPENSATED'
      ).length,
      failedCompensations: compensatedOrchestrations.filter(
        saga => saga.currentPhase === 'COMPENSATION_FAILED'
      ).length,
      averageCompensationTime: this.calculateAverageCompensationTime(
        compensatedOrchestrations
      ),
    };
  }

  private calculateAverageCompensationTime(
    orchestrations: OrchestrationSaga[]
  ): number {
    const completedCompensations = orchestrations.filter(
      saga => saga.compensationStartedAt && saga.compensationCompletedAt
    );

    if (completedCompensations.length === 0) return 0;

    const totalTime = completedCompensations.reduce((sum, saga) => {
      return (
        sum +
        (saga.compensationCompletedAt!.getTime() -
          saga.compensationStartedAt!.getTime())
      );
    }, 0);

    return totalTime / completedCompensations.length;
  }

  private calculateDomainParticipation(
    orchestrations: OrchestrationSaga[]
  ): Record<string, number> {
    return orchestrations.reduce(
      (acc, saga) => {
        saga.targetDomains.forEach(domain => {
          acc[domain] = (acc[domain] || 0) + 1;
        });
        return acc;
      },
      {} as Record<string, number>
    );
  }

  private async analyzeOrchestrationErrors(
    orchestrations: OrchestrationSaga[]
  ): Promise<OrchestrationErrorAnalysis> {
    const failedOrchestrations = orchestrations.filter(
      saga => saga.currentPhase === 'FAILED'
    );

    return {
      totalErrors: failedOrchestrations.length,
      errorPatterns: {},
      mostFailedDomains: [],
      commonFailureReasons: [],
    };
  }

  private generateOrchestrationRecommendations(
    orchestrations: OrchestrationSaga[]
  ): string[] {
    const recommendations: string[] = [];

    const failureRate = this.calculateFailureRate(orchestrations);
    if (failureRate > 0.1) {
      // 10% failure rate
      recommendations.push('REVIEW_ORCHESTRATION_PATTERNS');
      recommendations.push('IMPLEMENT_CIRCUIT_BREAKERS');
    }

    return recommendations;
  }

  private calculateFailureRate(orchestrations: OrchestrationSaga[]): number {
    if (orchestrations.length === 0) return 0;
    const failed = orchestrations.filter(
      saga => saga.currentPhase === 'FAILED'
    ).length;
    return failed / orchestrations.length;
  }
}
```

```typescript
// cross-domain-event-bridge.ts
import { IActor } from '@vytches-ddd/domain-primitives';
import {
  CrossDomainEvent,
  EventBridgeConfig,
  EventSubscription,
} from './types'; // From your app

/**
 * Enterprise cross-domain event bridge for domain communication
 */
export class CrossDomainEventBridge {
  private eventSubscriptions: Map<string, EventSubscription[]> = new Map();
  private eventHistory: Map<string, CrossDomainEvent[]> = new Map();
  private bridgeConfig: EventBridgeConfig;
  private metricsCollector: EventMetricsCollector;

  constructor(
    bridgeConfig: EventBridgeConfig,
    metricsCollector: EventMetricsCollector
  ) {
    this.bridgeConfig = bridgeConfig;
    this.metricsCollector = metricsCollector;
  }

  /**
   * Publish cross-domain event
   */
  async publishCrossDomainEvent(event: CrossDomainEvent): Promise<void> {
    try {
      // Store event in history
      const domainHistory = this.eventHistory.get(event.sourceContext) || [];
      domainHistory.push(event);
      this.eventHistory.set(event.sourceContext, domainHistory);

      // Route event to target contexts
      for (const targetContext of event.targetContexts) {
        const subscriptions = this.eventSubscriptions.get(targetContext) || [];

        for (const subscription of subscriptions) {
          if (this.matchesEventFilter(event, subscription.filter)) {
            try {
              await subscription.handler(event);
              await this.metricsCollector.recordEventDelivery(
                event,
                targetContext,
                true
              );
            } catch (error) {
              await this.metricsCollector.recordEventDelivery(
                event,
                targetContext,
                false
              );
              console.error(
                `Event delivery failed to ${targetContext}:`,
                error
              );
            }
          }
        }
      }

      await this.metricsCollector.recordEventPublished(event);
    } catch (error) {
      await this.metricsCollector.recordEventError(event, error);
      throw error;
    }
  }

  /**
   * Subscribe to cross-domain events
   */
  subscribeToEvents(
    contextName: string,
    eventFilter: EventFilter,
    handler: EventHandler,
    actor: IActor
  ): string {
    const subscriptionId = `SUB-${Date.now()}-${contextName}`;

    const subscription: EventSubscription = {
      id: subscriptionId,
      contextName,
      filter: eventFilter,
      handler,
      subscribedBy: actor.id,
      subscribedAt: new Date(),
    };

    const contextSubscriptions = this.eventSubscriptions.get(contextName) || [];
    contextSubscriptions.push(subscription);
    this.eventSubscriptions.set(contextName, contextSubscriptions);

    return subscriptionId;
  }

  private matchesEventFilter(
    event: CrossDomainEvent,
    filter: EventFilter
  ): boolean {
    // Implementation for event filter matching
    return true; // Simplified for example
  }
}
```

## Usage Example

```typescript
// enterprise-orchestration-demo.ts
import {
  EnterpriseDomainOrchestrator,
  CrossDomainCoordinationError,
  DistributedTransactionError,
  CrossDomainEventBridge,
} from './domain-orchestration';
import { SystemAdministratorActor } from '../intermediate/example-3'; // Reference to actor example

export class EnterpriseOrchestrationDemo {
  private domainOrchestrator: EnterpriseDomainOrchestrator;
  private eventBridge: CrossDomainEventBridge;

  constructor(
    domainOrchestrator: EnterpriseDomainOrchestrator,
    eventBridge: CrossDomainEventBridge
  ) {
    this.domainOrchestrator = domainOrchestrator;
    this.eventBridge = eventBridge;
  }

  async demonstrateComplexOrchestration(): Promise<void> {
    try {
      // Create system admin for orchestration
      const sysAdmin = new SystemAdministratorActor(
        'SYSADMIN-ORCH-001',
        'ENTERPRISE',
        {
          sessionMetadata: {
            sessionId: 'ORCH-SESSION-001',
            createdAt: new Date(),
            ipAddress: '10.0.0.1',
            userAgent: 'OrchestrationDemo/1.0',
          },
        }
      );

      // Register multiple domain contexts
      await this.domainOrchestrator.registerDomain(
        'CustomerManagement',
        {
          name: 'CustomerManagement',
          capabilities: ['CUSTOMER_CRUD', 'KYC_VALIDATION', 'CREDIT_CHECK'],
          compensationActions: new Map([
            ['CREATE_CUSTOMER', 'ROLLBACK_CUSTOMER_CREATION'],
            ['UPDATE_CUSTOMER', 'RESTORE_CUSTOMER_STATE'],
          ]),
          eventSubscriptions: ['OrderCreated', 'PaymentProcessed'],
        },
        sysAdmin
      );

      await this.domainOrchestrator.registerDomain(
        'OrderProcessing',
        {
          name: 'OrderProcessing',
          capabilities: [
            'ORDER_MANAGEMENT',
            'INVENTORY_RESERVATION',
            'PRICING_CALCULATION',
          ],
          compensationActions: new Map([
            ['CREATE_ORDER', 'CANCEL_ORDER'],
            ['RESERVE_INVENTORY', 'RELEASE_INVENTORY'],
          ]),
          eventSubscriptions: ['CustomerValidated', 'PaymentAuthorized'],
        },
        sysAdmin
      );

      await this.domainOrchestrator.registerDomain(
        'PaymentProcessing',
        {
          name: 'PaymentProcessing',
          capabilities: [
            'PAYMENT_AUTHORIZATION',
            'PAYMENT_CAPTURE',
            'REFUND_PROCESSING',
          ],
          compensationActions: new Map([
            ['AUTHORIZE_PAYMENT', 'VOID_AUTHORIZATION'],
            ['CAPTURE_PAYMENT', 'REFUND_PAYMENT'],
          ]),
          eventSubscriptions: ['OrderCreated', 'InventoryConfirmed'],
        },
        sysAdmin
      );

      console.log('Domain contexts registered successfully');

      // Demonstrate SAGA orchestration for complex order flow
      const sagaResult = await this.domainOrchestrator.initiateOrchestration(
        'SAGA-ORDER-FLOW-001',
        'SAGA',
        ['CustomerManagement', 'OrderProcessing', 'PaymentProcessing'],
        {
          operationType: 'COMPLETE_ORDER_FLOW',
          customerId: 'CUSTOMER-12345',
          orderData: {
            items: [
              { sku: 'PROD-001', quantity: 2, price: 99.99 },
              { sku: 'PROD-002', quantity: 1, price: 199.99 },
            ],
            total: 399.97,
            currency: 'USD',
          },
          paymentData: {
            method: 'credit_card',
            cardToken: 'tok_1234567890',
          },
        },
        sysAdmin,
        {
          timeoutMinutes: 15,
          retryPolicy: {
            maxAttempts: 3,
            backoffStrategy: 'EXPONENTIAL',
          },
        }
      );

      console.log('SAGA Orchestration Result:', {
        success: sagaResult.success,
        completedDomains: sagaResult.completedDomains,
        duration: sagaResult.duration,
      });

      // Demonstrate choreography orchestration
      const choreographyResult =
        await this.domainOrchestrator.initiateOrchestration(
          'CHOREO-INVENTORY-SYNC-001',
          'CHOREOGRAPHY',
          ['OrderProcessing', 'PaymentProcessing'],
          {
            operationType: 'INVENTORY_SYNCHRONIZATION',
            syncData: {
              products: ['PROD-001', 'PROD-002'],
              locations: ['WAREHOUSE-A', 'WAREHOUSE-B'],
            },
          },
          sysAdmin,
          { timeoutMinutes: 5 }
        );

      console.log('Choreography Orchestration Result:', {
        success: choreographyResult.success,
        completedDomains: choreographyResult.completedDomains,
      });

      // Generate comprehensive orchestration report
      const report = await this.domainOrchestrator.generateOrchestrationReport(
        {
          start: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
          end: new Date(),
        },
        ['CustomerManagement', 'OrderProcessing', 'PaymentProcessing']
      );

      console.log('\n=== Orchestration Report ===');
      console.log('Total Orchestrations:', report.totalOrchestrations);
      console.log('Success Rate:', report.successRate.toFixed(2) + '%');
      console.log(
        'Average Duration:',
        report.averageDuration.toFixed(0) + 'ms'
      );
      console.log('Orchestration Types:', report.orchestrationTypeBreakdown);
      console.log('Compensation Metrics:', report.compensationMetrics);
      console.log('Recommendations:', report.recommendations);
    } catch (error) {
      if (error instanceof CrossDomainCoordinationError) {
        console.error('Cross-Domain Coordination Failed:');
        console.error('- Error:', error.message);
        console.error('- Coordination Type:', error.coordinationType);
        console.error(
          '- Failed Domains:',
          error.failedDomains.map(d => d.domainName)
        );
        console.error('- Requires Compensation:', error.requiresCompensation());

        const failureAnalysis = error.getFailureAnalysis();
        console.error('- Failure Analysis:', failureAnalysis);

        if (error.requiresCompensation()) {
          const compensationStrategy = error.getCompensationStrategy();
          console.error('- Compensation Strategy:', compensationStrategy);
        }
      } else if (error instanceof DistributedTransactionError) {
        console.error('Distributed Transaction Failed:');
        console.error('- Transaction ID:', error.transactionId);
        console.error('- Transaction Type:', error.transactionType);
        console.error('- Participant States:', error.participantStates);

        const txAnalysis = error.getTransactionAnalysis();
        console.error('- Transaction Analysis:', txAnalysis);
      } else {
        console.error('Unexpected orchestration error:', error);
      }
    }
  }

  async demonstrateDistributedTransactionHandling(): Promise<void> {
    try {
      // Simulate distributed transaction failure
      const txError = new DistributedTransactionError(
        'Distributed transaction failed due to participant timeout',
        'OrderProcessing',
        'CORR-TX-12345',
        'TX-DISTRIBUTED-789',
        'SAGA',
        [
          {
            domain: 'CustomerManagement',
            state: 'COMMITTED',
            order: 1,
            startedAt: new Date(Date.now() - 5000),
            completedAt: new Date(Date.now() - 3000),
            result: { customerId: 'CUSTOMER-12345', validated: true },
          },
          {
            domain: 'OrderProcessing',
            state: 'PREPARED',
            order: 2,
            startedAt: new Date(Date.now() - 3000),
            completedAt: new Date(Date.now() - 1000),
            result: { orderId: 'ORDER-98765', reserved: true },
          },
          {
            domain: 'PaymentProcessing',
            state: 'FAILED',
            order: 3,
            startedAt: new Date(Date.now() - 1000),
            error: 'Payment authorization timeout',
            dependencyLevel: 3,
          },
        ],
        { rollbackRequired: true }
      );

      console.log('\n=== Distributed Transaction Error Analysis ===');
      console.log('Transaction Analysis:', txError.getTransactionAnalysis());
      console.log('Requires Compensation:', txError.requiresCompensation());
      console.log('Compensation Strategy:', txError.getCompensationStrategy());
      console.log('Orchestration Context:', txError.getOrchestrationContext());
    } catch (error) {
      console.error('Error in transaction demo:', error);
    }
  }

  async demonstrateEventDrivenCoordination(): Promise<void> {
    try {
      // Set up cross-domain event subscriptions
      const sysAdmin = new SystemAdministratorActor(
        'SYSADMIN-EVENT-001',
        'ENTERPRISE'
      );

      const orderSubscription = this.eventBridge.subscribeToEvents(
        'OrderProcessing',
        {
          eventTypes: ['CustomerValidated', 'PaymentAuthorized'],
          sourceContexts: ['CustomerManagement', 'PaymentProcessing'],
        },
        async event => {
          console.log(
            `OrderProcessing received event: ${event.type} from ${event.sourceContext}`
          );

          if (event.type === 'CustomerValidated') {
            // Process customer validation result
            console.log('Processing customer validation result...');
          } else if (event.type === 'PaymentAuthorized') {
            // Process payment authorization result
            console.log('Processing payment authorization...');
          }
        },
        sysAdmin
      );

      // Publish cross-domain events
      await this.eventBridge.publishCrossDomainEvent({
        id: 'EVENT-CUSTOMER-VALIDATED-001',
        type: 'CustomerValidated',
        correlationId: 'CORR-ORDER-FLOW-001',
        sourceContext: 'CustomerManagement',
        targetContexts: ['OrderProcessing'],
        payload: {
          customerId: 'CUSTOMER-12345',
          validationStatus: 'APPROVED',
          kycLevel: 'ENHANCED',
          creditScore: 750,
        },
        timestamp: new Date(),
        metadata: {
          validationId: 'KYC-VALIDATION-001',
          riskScore: 'LOW',
        },
      });

      await this.eventBridge.publishCrossDomainEvent({
        id: 'EVENT-PAYMENT-AUTHORIZED-001',
        type: 'PaymentAuthorized',
        correlationId: 'CORR-ORDER-FLOW-001',
        sourceContext: 'PaymentProcessing',
        targetContexts: ['OrderProcessing'],
        payload: {
          paymentId: 'PAY-AUTH-98765',
          authorizationCode: 'AUTH-12345',
          authorizedAmount: 399.97,
          currency: 'USD',
          expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
        },
        timestamp: new Date(),
        metadata: {
          paymentMethod: 'credit_card',
          processorResponse: 'APPROVED',
        },
      });

      console.log('Cross-domain events published successfully');
    } catch (error) {
      console.error('Event-driven coordination error:', error);
    }
  }
}
```

## Key Features

- **Enterprise Domain Orchestration**: Sophisticated coordination across
  multiple bounded contexts
- **Advanced Error Hierarchies**: Comprehensive error handling with compensation
  and recovery strategies
- **SAGA Pattern Implementation**: Full SAGA orchestration with compensation
  support
- **Choreography Support**: Event-driven choreography for loosely coupled
  domains
- **Cross-Domain Communication**: Event bridge for inter-domain communication
- **Distributed Transaction Management**: Support for various transaction
  patterns (XA, TCC, SAGA)
- **Compensation Strategies**: Multiple compensation patterns based on
  transaction type
- **Analytics and Reporting**: Comprehensive orchestration analytics and error
  analysis
- **Actor Integration**: Full integration with enterprise actor patterns for
  security

## Common Pitfalls

- **Compensation Complexity**: Carefully design compensation logic to handle
  partial failures
- **Event Ordering**: Ensure proper event ordering in choreography patterns
- **Timeout Management**: Implement appropriate timeouts for different
  orchestration types
- **Error Propagation**: Avoid cascading failures through proper error
  boundaries
- **Resource Management**: Monitor resource usage in long-running orchestrations

## Related Examples

- [Domain Error Hierarchies](../intermediate/example-2.md) - Foundation error
  patterns for orchestration
- [Actor Pattern Implementation](../intermediate/example-3.md) - Actor security
  patterns for orchestration
- [Basic Domain Primitives](../basic/example-1.md) - Foundation concepts for
  domain modeling
- [NestJS Enterprise Integration](../frameworks/nestjs/advanced/example-1.md) -
  Framework-specific orchestration patterns
