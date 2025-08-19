import { EntityId } from '@vytches/ddd-contracts';
import { AggregateRoot } from '@vytches/ddd-core';
import { Logger } from '@vytches/ddd-logging';
import type { GuardEvaluationResult, IProcessGuard, ProcessGuardContext } from '../guards';
import { GuardManager, GuardOperation } from '../guards';
import type {
  IProcessManager,
  IProcessManagerContext,
  IProcessManagerEvent,
  IProcessManagerState,
  ProcessManagerResult,
} from '../interfaces';
import { ProcessManagerStatus } from '../interfaces';
import type { IProcessInvariant, InvariantContext } from '../invariants';
import { InvariantManager, InvariantTrigger } from '../invariants';
import {
  ProcessManagerAuth,
  ProcessManagerSecurity,
  ProcessManagerSecurityError,
  type IProcessManagerSecurityContext,
} from '../security';

/**
 * Abstract base class for all process managers.
 * Provides common functionality and enforces the process manager contract.
 */
export abstract class BaseProcessManager<TState extends IProcessManagerState = IProcessManagerState>
  extends AggregateRoot<string>
  implements IProcessManager<TState>
{
  protected readonly logger = Logger.forContext(this.constructor.name);
  private _state: TState;
  private _status: ProcessManagerStatus;
  private _updatedAt: Date;

  public readonly type: string;
  public readonly createdAt: Date;
  private readonly _timeout: number | undefined;

  // Guards and Invariants
  private readonly guardManager: GuardManager<TState>;
  private readonly invariantManager: InvariantManager<TState>;

  constructor(params: {
    id: string;
    type: string;
    initialState: TState;
    version?: number;
    createdAt?: Date;
    timeout?: number;
    securityContext?: IProcessManagerSecurityContext;
    guards?: IProcessGuard<TState>[];
    invariants?: IProcessInvariant<TState>[];
  }) {
    // Initialize AggregateRoot with proper parameters
    const validatedId = ProcessManagerSecurity.validateId(params.id);
    super({
      id: EntityId.fromText(validatedId),
      version: params.version || 0,
    });

    // Security: Validate all constructor inputs
    this.type = ProcessManagerSecurity.validateType(params.type);
    this._timeout = ProcessManagerSecurity.validateTimeout(params.timeout);
    this.createdAt = params.createdAt || new Date();

    // Security: Validate and sanitize initial state
    if (!params.initialState || typeof params.initialState !== 'object') {
      throw new ProcessManagerSecurityError('Initial state must be a valid object');
    }

    const sanitizedState = this.validateAndSanitizeState(params.initialState as Partial<TState>);
    this._state = {
      ...sanitizedState,
      version: sanitizedState.version ?? 0,
      lastModified: new Date(),
    } as TState;

    this._status = ProcessManagerStatus.CREATED;
    this._updatedAt = new Date();

    // Initialize Guards and Invariants
    this.guardManager = new GuardManager<TState>({
      enableLogging: true,
      enablePerformanceMonitoring: true,
    });

    this.invariantManager = new InvariantManager<TState>({
      enableLogging: true,
      enablePerformanceTracking: true,
      enableAutoCorrection: true,
    });

    // Register provided guards and invariants
    if (params.guards) {
      for (const guard of params.guards) {
        this.guardManager.registerGuard(guard);
      }
    }

    if (params.invariants) {
      for (const invariant of params.invariants) {
        this.invariantManager.registerInvariant(invariant);
      }
    }

    // Validate initial state with invariants
    this.validateInvariantsAsync(this._state, {
      processContext: {
        correlationId: this.id,
        processedAt: new Date(),
        ...(params.securityContext?.userId && { userId: params.securityContext.userId }),
        ...(params.securityContext?.tenantId && { tenantId: params.securityContext.tenantId }),
        ...(params.securityContext && { securityContext: params.securityContext }),
      },
      triggeringOperation: InvariantTrigger.INITIALIZATION,
    }).catch(error => {
      this.logger.warn('Initial state invariant validation failed', {
        processManagerId: this.id,
        error: error.message,
      });
    });

    // Security: Log creation with masked sensitive data
    this.logger.info('Process manager created', {
      processManagerId: this.id,
      processManagerType: this.type,
      userId: params.securityContext?.userId,
      tenantId: params.securityContext?.tenantId,
      // Mask potentially sensitive state data
      initialState: ProcessManagerSecurity.maskSensitiveData(
        this._state as Record<string, unknown>
      ),
      guardsRegistered: this.guardManager.getGuards().size,
      invariantsRegistered: this.invariantManager.getInvariants().size,
    });
  }

  // Getter for IProcessManager interface compliance - returns string ID value
  get id(): string {
    return this.getId().toString();
  }

  get state(): TState {
    return { ...this._state };
  }

  get status(): ProcessManagerStatus {
    return this._status;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get timeout(): number | undefined {
    return this._timeout;
  }

  /**
   * Abstract method that must be implemented by concrete process managers
   * to determine if they can handle a specific event
   */
  abstract canHandle(event: IProcessManagerEvent): boolean;

  /**
   * Abstract method that must be implemented by concrete process managers
   * to handle events and orchestrate workflow steps.
   * Security: This method includes automatic security validation.
   */
  async handle(
    event: IProcessManagerEvent,
    context: IProcessManagerContext
  ): Promise<ProcessManagerResult> {
    try {
      // Check if process manager is timed out
      if (this.isTimedOut()) {
        this._status = ProcessManagerStatus.TIMED_OUT;
      }

      // Check if process manager can handle events
      if (this._status === ProcessManagerStatus.FAILED) {
        throw new Error('Cannot handle events when process manager is in FAILED status');
      }
      if (this._status === ProcessManagerStatus.COMPLETED) {
        throw new Error('Cannot handle events when process manager is in COMPLETED status');
      }
      if (this._status === ProcessManagerStatus.TIMED_OUT) {
        throw new Error('Cannot handle events when process manager is in TIMED_OUT status');
      }

      // Security: Validate event and context
      this.validateEvent(event);
      this.validateContext(context);

      // Security: Perform authorization checks
      this.performAuthorizationChecks(context);

      // Note: Guards will be evaluated during state transitions in updateState()
      // Skip guard evaluation here to avoid duplicate evaluation for events that trigger state updates

      // Security: Sanitize event payload
      const sanitizedEvent = {
        ...event,
        payload: ProcessManagerSecurity.validateEventPayload(event.payload),
      };

      // Validate invariants before event processing
      await this.validateInvariantsAsync(this._state, {
        processContext: context,
        triggeringOperation: InvariantTrigger.EVENT_PROCESSING,
      });

      // Call the concrete implementation
      const result = await this.handleSecure(sanitizedEvent, context);

      // Security: Validate and sanitize the result
      return this.validateResult(result, context);
    } catch (error) {
      // Security: Log security violations with context but mask sensitive data
      this.logger.error('Process manager security violation', error as Error, {
        processManagerId: this.id,
        userId: context.securityContext?.userId,
        eventType: event?.eventType,
        // Don't log full event payload for security
        hasPayload: !!event?.payload,
      });

      // Security: Return sanitized error
      return this.createSecureFailureResult(error as Error);
    }
  }

  /**
   * Abstract method that concrete implementations must provide.
   * This is called after security validation.
   */
  protected abstract handleSecure(
    event: IProcessManagerEvent,
    context: IProcessManagerContext
  ): Promise<ProcessManagerResult>;

  /**
   * Abstract method to determine if the process is complete
   */
  abstract isComplete(): boolean;

  /**
   * Abstract method to get correlation data for event routing
   */
  abstract getCorrelationData(): Record<string, unknown>;

  /**
   * Checks if the process has timed out
   */
  isTimedOut(): boolean {
    if (!this._timeout) {
      return false;
    }

    const elapsed = Date.now() - this.createdAt.getTime();
    return elapsed > this._timeout;
  }

  /**
   * Updates the internal state of the process manager
   * Security: Validates and sanitizes state updates
   * Returns a promise that resolves when guards have been evaluated and state has been updated
   */
  async updateState(
    newState: Partial<TState>,
    securityContext?: IProcessManagerSecurityContext
  ): Promise<void> {
    // Security: Validate authorization for state updates
    if (securityContext) {
      ProcessManagerAuth.requireAuthentication(securityContext);
    }

    // Security: Validate and sanitize the new state
    const sanitizedState = this.validateAndSanitizeState(newState);

    const previousState = { ...this._state };
    const updatedState = {
      ...this._state,
      ...sanitizedState,
      version: this._state.version + 1,
      lastModified: new Date(),
    };

    // Check if guards are registered - if not, apply state update synchronously
    if (!this.guardManager || this.guardManager.getGuards().size === 0) {
      // Apply state update immediately when no guards
      this._state = updatedState;
      this._updatedAt = new Date();

      // Still validate invariants asynchronously
      this.validateInvariantsAsync(this._state, {
        processContext: {
          correlationId: this.id,
          processedAt: new Date(),
          ...(securityContext?.userId && { userId: securityContext.userId }),
          ...(securityContext?.tenantId && { tenantId: securityContext.tenantId }),
          ...(securityContext && { securityContext }),
        },
        triggeringOperation: InvariantTrigger.STATE_CHANGE,
        previousState,
      }).catch(error => {
        this.logger.warn('State change invariant validation failed', {
          processManagerId: this.id,
          error: error.message,
        });
      });

      this.logger.debug('Process manager state updated', {
        processManagerId: this.id,
        userId: securityContext?.userId,
        currentStep: updatedState.currentStep,
        version: updatedState.version,
      });

      return;
    }

    // Execute guards before state transition
    try {
      const guardResult = await this.executeGuardsSync(
        updatedState,
        GuardOperation.STATE_TRANSITION,
        securityContext
      );

      if (!guardResult.allowed) {
        this.logger.warn('State update blocked by guards', {
          processManagerId: this.id,
          userId: securityContext?.userId,
          blockingIssues: guardResult.blockingIssues,
        });
        // Throw error so calling code can handle guard blocking appropriately
        const blockingReasons =
          guardResult.blockingIssues?.map(issue => issue.reason).join(', ') ||
          'Unknown guard failure';
        throw new Error(`State update blocked by guards: ${blockingReasons}`);
      }

      // Apply state update
      this._state = updatedState;
      this._updatedAt = new Date();

      // Validate invariants after state change
      this.validateInvariantsAsync(this._state, {
        processContext: {
          correlationId: this.id,
          processedAt: new Date(),
          ...(securityContext?.userId && { userId: securityContext.userId }),
          ...(securityContext?.tenantId && { tenantId: securityContext.tenantId }),
          ...(securityContext && { securityContext }),
        },
        triggeringOperation: InvariantTrigger.STATE_CHANGE,
        previousState,
      }).catch(error => {
        this.logger.warn('State change invariant validation failed', {
          processManagerId: this.id,
          error: error.message,
        });
      });

      this.logger.debug('Process manager state updated', {
        processManagerId: this.id,
        userId: securityContext?.userId,
        // Security: Mask sensitive data in logs
        newState: ProcessManagerSecurity.maskSensitiveData(
          sanitizedState as Record<string, unknown>
        ),
        currentVersion: this._state.version,
      });
    } catch (error) {
      this.logger.error(
        'Guard evaluation failed during state update',
        error instanceof Error ? error : new Error(String(error)),
        {
          processManagerId: this.id,
          userId: securityContext?.userId,
        }
      );
      throw error;
    }
  }

  /**
   * Marks the process as complete
   * Security: Enhanced logging with context
   */
  complete(securityContext?: IProcessManagerSecurityContext): void {
    // Security: Validate authorization for completing process
    if (securityContext) {
      ProcessManagerAuth.requireAuthentication(securityContext);
    }

    // Check if guards are registered - if not, complete synchronously
    if (!this.guardManager || this.guardManager.getGuards().size === 0) {
      // Complete immediately when no guards
      this._status = ProcessManagerStatus.COMPLETED;
      this._updatedAt = new Date();

      // Still validate invariants asynchronously
      this.validateInvariantsAsync(this._state, {
        processContext: {
          correlationId: this.id,
          processedAt: new Date(),
          ...(securityContext?.userId && { userId: securityContext.userId }),
          ...(securityContext?.tenantId && { tenantId: securityContext.tenantId }),
          ...(securityContext && { securityContext }),
        },
        triggeringOperation: InvariantTrigger.COMPLETION,
      }).catch(error => {
        this.logger.warn('Completion invariant validation failed', {
          processManagerId: this.id,
          error: error.message,
        });
      });

      this.logger.info('Process manager completed', {
        processManagerId: this.id,
        userId: securityContext?.userId,
        tenantId: securityContext?.tenantId,
        // Security: Mask sensitive data in final state
        finalState: ProcessManagerSecurity.maskSensitiveData(
          this._state as Record<string, unknown>
        ),
      });

      return;
    }

    // Execute guards before completion when guards are present
    this.executeGuardsSync(
      { lastModified: new Date() } as Partial<TState>, // Minimal proposed state for completion
      GuardOperation.COMPLETION,
      securityContext
    )
      .then(guardResult => {
        if (!guardResult.allowed) {
          this.logger.warn('Process completion blocked by guards', {
            processManagerId: this.id,
            userId: securityContext?.userId,
            blockingIssues: guardResult.blockingIssues,
          });
          throw new ProcessManagerSecurityError('Process completion blocked by guards');
        }

        this._status = ProcessManagerStatus.COMPLETED;
        this._updatedAt = new Date();

        // Validate invariants after completion
        this.validateInvariantsAsync(this._state, {
          processContext: {
            correlationId: this.id,
            processedAt: new Date(),
            ...(securityContext?.userId && { userId: securityContext.userId }),
            ...(securityContext?.tenantId && { tenantId: securityContext.tenantId }),
            ...(securityContext && { securityContext }),
          },
          triggeringOperation: InvariantTrigger.COMPLETION,
        }).catch(error => {
          this.logger.warn('Completion invariant validation failed', {
            processManagerId: this.id,
            error: error.message,
          });
        });

        this.logger.info('Process manager completed', {
          processManagerId: this.id,
          userId: securityContext?.userId,
          tenantId: securityContext?.tenantId,
          // Security: Mask sensitive data in final state
          finalState: ProcessManagerSecurity.maskSensitiveData(
            this._state as Record<string, unknown>
          ),
        });
      })
      .catch(error => {
        this.logger.error('Guard evaluation failed during completion', error, {
          processManagerId: this.id,
          userId: securityContext?.userId,
        });
        throw error;
      });
  }

  /**
   * Marks the process as failed with an error
   * Security: Sanitized error logging
   */

  fail(error: Error, securityContext?: IProcessManagerSecurityContext): void {
    this._status = ProcessManagerStatus.FAILED;
    this._updatedAt = new Date();

    this.logger.error('Process manager failed', error, {
      processManagerId: this.id,
      userId: securityContext?.userId,
      tenantId: securityContext?.tenantId,
      errorType: error.constructor.name,
      // Security: Don't log sensitive state data on failure
      hasState: !!this._state,
      stateVersion: this._state.version,
    });
  }

  /**
   * Sets the status to running
   */
  protected setRunning(): void {
    this._status = ProcessManagerStatus.RUNNING;
    this._updatedAt = new Date();
  }

  /**
   * Sets the status to waiting
   */
  protected setWaiting(): void {
    this._status = ProcessManagerStatus.WAITING;
    this._updatedAt = new Date();
  }

  /**
   * Sets the status to timed out
   */
  protected setTimedOut(): void {
    this._status = ProcessManagerStatus.TIMED_OUT;
    this._updatedAt = new Date();

    this.logger.warn('Process manager timed out', {
      processManagerId: this.id,
      timeout: this._timeout,
      elapsed: Date.now() - this.createdAt.getTime(),
    });
  }

  /**
   * Helper method to create a successful result
   */
  protected createSuccessResult(
    commands?: ProcessManagerResult['commands'],
    events?: ProcessManagerResult['events'],
    shouldContinue = true
  ): ProcessManagerResult {
    return {
      success: true,
      ...(commands !== undefined && { commands }),
      ...(events !== undefined && { events }),
      shouldContinue,
    };
  }

  /**
   * Helper method to create a failure result
   * Security: Sanitizes error details
   */
  protected createFailureResult(
    message: string,
    code?: string,
    details?: unknown
  ): ProcessManagerResult {
    // Security: Sanitize error details to prevent information disclosure
    const sanitizedDetails =
      details && typeof details === 'object'
        ? ProcessManagerSecurity.maskSensitiveData(details as Record<string, unknown>)
        : details;

    return {
      success: false,
      shouldContinue: false,
      error: {
        message,
        ...(code !== undefined && { code }),
        ...(sanitizedDetails !== undefined && { details: sanitizedDetails }),
      },
    };
  }

  /**
   * Security validation methods
   */

  /**
   * Validates and sanitizes state updates
   */
  private validateAndSanitizeState(state: Partial<TState>): Partial<TState> {
    if (!state || typeof state !== 'object') {
      throw new ProcessManagerSecurityError('State must be a valid object');
    }

    const sanitized: any = {};

    // Validate currentStep if provided
    if (state.currentStep !== undefined) {
      if (typeof state.currentStep !== 'string' || state.currentStep.length === 0) {
        throw new ProcessManagerSecurityError('currentStep must be a non-empty string');
      }
      sanitized.currentStep = state.currentStep.trim();
    }

    // Validate and sanitize stepData - provide default if not present to allow auto-correction
    if (state.stepData !== undefined) {
      sanitized.stepData = ProcessManagerSecurity.sanitizeStepData(state.stepData);
    } else {
      sanitized.stepData = {}; // Default empty object for auto-correction
    }

    // Validate version
    if (state.version !== undefined) {
      if (typeof state.version !== 'number' || state.version < 0) {
        throw new ProcessManagerSecurityError('version must be a non-negative number');
      }
      sanitized.version = state.version;
    }

    // Validate correlationData - provide default if not present to allow auto-correction
    if (state.correlationData !== undefined) {
      sanitized.correlationData = ProcessManagerSecurity.sanitizeCorrelationData(
        state.correlationData
      );
    } else {
      sanitized.correlationData = {}; // Default empty object for auto-correction
    }

    // Validate metadata - provide default if not present to allow auto-correction
    if (state.metadata !== undefined) {
      sanitized.metadata = ProcessManagerSecurity.sanitizeMetadata(state.metadata);
    } else {
      sanitized.metadata = {}; // Default empty object for auto-correction
    }

    // Validate lastModified
    if (state.lastModified !== undefined) {
      if (!(state.lastModified instanceof Date)) {
        throw new ProcessManagerSecurityError('lastModified must be a Date object');
      }
      sanitized.lastModified = state.lastModified;
    }

    return sanitized;
  }

  /**
   * Validates event structure and content
   */
  private validateEvent(event: IProcessManagerEvent): void {
    if (!event) {
      throw new ProcessManagerSecurityError('Event is required');
    }

    // Validate required string fields
    const stringFields = ['id', 'eventType', 'eventName', 'aggregateId', 'aggregateType'];
    for (const field of stringFields) {
      const value = (event as any)[field];
      if (!value || typeof value !== 'string' || value.trim().length === 0) {
        throw new ProcessManagerSecurityError(`Event.${field} must be a non-empty string`);
      }
    }

    // Validate aggregateVersion
    if (typeof event.aggregateVersion !== 'number' || event.aggregateVersion < 0) {
      throw new ProcessManagerSecurityError('Event.aggregateVersion must be a non-negative number');
    }

    // Validate timestamp
    if (!(event.timestamp instanceof Date)) {
      throw new ProcessManagerSecurityError('Event.timestamp must be a Date object');
    }

    // Validate optional string fields
    if (event.correlationId !== undefined && typeof event.correlationId !== 'string') {
      throw new ProcessManagerSecurityError('Event.correlationId must be a string');
    }

    if (event.causationId !== undefined && typeof event.causationId !== 'string') {
      throw new ProcessManagerSecurityError('Event.causationId must be a string');
    }

    // Validate metadata
    if (event.metadata && typeof event.metadata !== 'object') {
      throw new ProcessManagerSecurityError('Event.metadata must be an object');
    }
  }

  /**
   * Validates context structure and content
   */
  private validateContext(context: IProcessManagerContext): void {
    if (!context) {
      throw new ProcessManagerSecurityError('Context is required');
    }

    // Validate correlationId
    if (!context.correlationId || typeof context.correlationId !== 'string') {
      throw new ProcessManagerSecurityError('Context.correlationId must be a non-empty string');
    }

    // Validate processedAt
    if (!(context.processedAt instanceof Date)) {
      throw new ProcessManagerSecurityError('Context.processedAt must be a Date object');
    }

    // Validate optional string fields
    const optionalStringFields = ['userId', 'tenantId', 'requestId', 'sessionId'];
    for (const field of optionalStringFields) {
      const value = (context as any)[field];
      if (value !== undefined && typeof value !== 'string') {
        throw new ProcessManagerSecurityError(`Context.${field} must be a string`);
      }
    }

    // Validate metadata
    if (context.metadata && typeof context.metadata !== 'object') {
      throw new ProcessManagerSecurityError('Context.metadata must be an object');
    }
  }

  /**
   * Performs authorization checks based on context
   */
  private performAuthorizationChecks(context: IProcessManagerContext): void {
    // If security context is provided, perform authentication checks
    if (context.securityContext) {
      ProcessManagerAuth.requireAuthentication(context.securityContext);

      // Validate tenant isolation if applicable
      const processTenantId = this._state.correlationData?.tenantId as string;
      ProcessManagerAuth.validateTenantAccess(context.securityContext, processTenantId);
    }
  }

  /**
   * Validates and sanitizes process manager result
   */
  private validateResult(
    result: ProcessManagerResult,
    context: IProcessManagerContext
  ): ProcessManagerResult {
    if (!result || typeof result !== 'object') {
      throw new ProcessManagerSecurityError('Result must be a valid object');
    }

    if (typeof result.success !== 'boolean') {
      throw new ProcessManagerSecurityError('Result.success must be a boolean');
    }

    // Sanitize commands if present
    if (result.commands) {
      if (!Array.isArray(result.commands)) {
        throw new ProcessManagerSecurityError('Result.commands must be an array');
      }

      result.commands = result.commands.map(cmd => ({
        ...cmd,
        payload: ProcessManagerSecurity.validateEventPayload(cmd.payload),
      }));
    }

    // Sanitize events if present
    if (result.events) {
      if (!Array.isArray(result.events)) {
        throw new ProcessManagerSecurityError('Result.events must be an array');
      }

      result.events = result.events.map(evt => ({
        ...evt,
        payload: ProcessManagerSecurity.validateEventPayload(evt.payload),
      }));
    }

    return result;
  }

  /**
   * Creates a secure failure result that doesn't leak sensitive information
   */
  private createSecureFailureResult(error: Error): ProcessManagerResult {
    let message = error.message;
    let code = 'PROCESS_MANAGER_ERROR';

    // Only include specific error details for known security errors
    if (error instanceof ProcessManagerSecurityError) {
      message = error.message;
      code = error.code || 'SECURITY_ERROR';
    }

    return {
      success: false,
      shouldContinue: false,
      error: {
        message,
        code,
        // Don't include error details that might leak sensitive information
      },
    };
  }

  /**
   * Guards and Invariants Management
   */

  /**
   * Registers a guard with the process manager
   */
  registerGuard(guard: IProcessGuard<TState>): void {
    this.guardManager.registerGuard(guard);
    this.logger.debug('Guard registered', {
      processManagerId: this.id,
      guardName: guard.getName(),
      totalGuards: this.guardManager.getGuards().size,
    });
  }

  /**
   * Unregisters a guard from the process manager
   */
  unregisterGuard(guardName: string): boolean {
    const result = this.guardManager.unregisterGuard(guardName);
    if (result) {
      this.logger.debug('Guard unregistered', {
        processManagerId: this.id,
        guardName,
        remainingGuards: this.guardManager.getGuards().size,
      });
    }
    return result;
  }

  /**
   * Registers an invariant with the process manager
   */
  registerInvariant(invariant: IProcessInvariant<TState>): void {
    this.invariantManager.registerInvariant(invariant);
    this.logger.debug('Invariant registered', {
      processManagerId: this.id,
      invariantId: invariant.getId(),
      totalInvariants: this.invariantManager.getInvariants().size,
    });
  }

  /**
   * Unregisters an invariant from the process manager
   */
  unregisterInvariant(invariantId: string): boolean {
    const result = this.invariantManager.unregisterInvariant(invariantId);
    if (result) {
      this.logger.debug('Invariant unregistered', {
        processManagerId: this.id,
        invariantId,
        remainingInvariants: this.invariantManager.getInvariants().size,
      });
    }
    return result;
  }

  /**
   * Executes guards for a given operation (synchronous version for internal use)
   */
  private async executeGuardsSync(
    proposedState: Partial<TState>,
    operation: GuardOperation,
    securityContext?: IProcessManagerSecurityContext
  ): Promise<GuardEvaluationResult> {
    const guardContext: ProcessGuardContext<TState> = {
      currentState: this._state,
      proposedState,
      context: {
        correlationId: this.id,
        processedAt: new Date(),
        ...(securityContext?.userId && { userId: securityContext.userId }),
        ...(securityContext?.tenantId && { tenantId: securityContext.tenantId }),
        ...(securityContext && { securityContext }),
      },
      operation,
      metadata: {
        processManagerType: this.type,
        currentStatus: this._status,
      },
    };

    const result = await this.guardManager.evaluateGuards(guardContext);

    if (result.isFailure) {
      throw result.error;
    }

    return result.value;
  }

  /**
   * Validates invariants asynchronously (fire and forget for performance)
   */
  private async validateInvariantsAsync(state: TState, context: InvariantContext): Promise<void> {
    try {
      const result = await this.invariantManager.validateInvariants(state, context);

      if (result.isFailure) {
        this.logger.error('Invariant validation error', result.error, {
          processManagerId: this.id,
          trigger: context.triggeringOperation,
        });
        return;
      }

      const validationResult = result.value;

      if (!validationResult.isValid) {
        this.logger.warn('Invariant validation failed', {
          processManagerId: this.id,
          trigger: context.triggeringOperation,
          totalViolations: validationResult.allViolations.length,
          criticalViolations: validationResult.criticalViolations.length,
          violations: validationResult.allViolations.map(v => ({
            violationId: v.violationId,
            severity: v.severity,
            description: v.description,
          })),
        });

        // If auto-corrections were applied, update our state
        if (validationResult.autoCorrectionsApplied && validationResult.finalState) {
          this._state = validationResult.finalState as TState;
          this.logger.info('State auto-corrected by invariants', {
            processManagerId: this.id,
            trigger: context.triggeringOperation,
          });
        }
      }
    } catch (error) {
      this.logger.error('Invariant validation failed', error as Error, {
        processManagerId: this.id,
        trigger: context.triggeringOperation,
      });
    }
  }

  /**
   * Gets guard manager statistics
   */
  getGuardStatistics(): ReturnType<GuardManager<TState>['getStatistics']> {
    return this.guardManager.getStatistics();
  }

  /**
   * Gets invariant manager statistics
   */
  getInvariantStatistics(): ReturnType<InvariantManager<TState>['getStatistics']> {
    return this.invariantManager.getStatistics();
  }

  /**
   * Validates the current guards and invariants configuration
   */
  validateGuardsAndInvariantsConfiguration(): {
    guards: ReturnType<GuardManager<TState>['validateConfiguration']>;
    invariants: ReturnType<InvariantManager<TState>['validateConfiguration']>;
  } {
    return {
      guards: this.guardManager.validateConfiguration(),
      invariants: this.invariantManager.validateConfiguration(),
    };
  }

  /**
   * Resets performance metrics for guards and invariants
   */
  resetPerformanceMetrics(): void {
    this.guardManager.resetPerformanceMetrics();
    this.invariantManager.resetPerformanceMetrics();

    this.logger.info('Performance metrics reset', {
      processManagerId: this.id,
    });
  }
}
