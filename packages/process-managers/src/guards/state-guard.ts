import type { IProcessManagerState } from '../interfaces';
import { BaseProcessGuard } from './base-guard';
import { GuardOperation, GuardSeverity } from './guard.interface';
import type { ProcessGuardContext, GuardResult } from './guard.interface';

/**
 * Configuration for state guard validation
 */
export interface StateGuardConfiguration {
  /**
   * Valid state transitions mapping from current step to allowed next steps
   */
  validTransitions: Record<string, string[]>;

  /**
   * Steps that are considered terminal (process should complete after these)
   */
  terminalSteps: string[];

  /**
   * Steps that require specific conditions to be met
   */
  conditionalSteps?: Record<
    string,
    {
      requiredFields: string[];
      forbiddenFields?: string[];
      customValidator?: (state: IProcessManagerState) => boolean;
    }
  >;

  /**
   * Maximum version difference allowed for state updates
   */
  maxVersionSkip?: number;

  /**
   * Whether to allow backward transitions
   */
  allowBackwardTransitions?: boolean;
}

/**
 * Guard that validates state transitions and state consistency
 */
export class StateGuard<
  TState extends IProcessManagerState = IProcessManagerState,
> extends BaseProcessGuard<TState> {
  constructor(
    private readonly config: StateGuardConfiguration,
    name = 'StateGuard',
    priority = 200
  ) {
    super(name, priority, [
      GuardOperation.STATE_TRANSITION,
      GuardOperation.EVENT_HANDLING,
      GuardOperation.COMPLETION,
    ]);
  }

  protected async evaluate(context: ProcessGuardContext<TState>): Promise<GuardResult> {
    this.validateContext(context);

    // Validate state structure
    const structureValidation = this.validateStateStructure(context.currentState);
    if (!structureValidation.valid) {
      return this.createDeniedResult(
        structureValidation.reason!,
        GuardSeverity.ERROR,
        'INVALID_STATE_STRUCTURE',
        { validationErrors: structureValidation.errors }
      );
    }

    // If this is a state transition, validate the transition
    if (context.operation === GuardOperation.STATE_TRANSITION) {
      return this.validateStateTransition(context);
    }

    // If this is completion, validate completion conditions
    if (context.operation === GuardOperation.COMPLETION) {
      return this.validateCompletionConditions(context);
    }

    // For event handling, validate that current state allows event processing
    if (context.operation === GuardOperation.EVENT_HANDLING) {
      return this.validateEventHandlingState(context);
    }

    return this.createAllowedResult('State validation passed');
  }

  /**
   * Validates the structure of the state object
   */
  private validateStateStructure(state: TState): {
    valid: boolean;
    reason?: string;
    errors?: string[];
  } {
    const errors: string[] = [];

    // Check required fields
    if (!state.currentStep || typeof state.currentStep !== 'string') {
      errors.push('currentStep must be a non-empty string');
    }

    if (typeof state.version !== 'number' || state.version < 0) {
      errors.push('version must be a non-negative number');
    }

    if (!state.lastModified || !(state.lastModified instanceof Date)) {
      errors.push('lastModified must be a valid Date');
    }

    if (!state.stepData || typeof state.stepData !== 'object') {
      errors.push('stepData must be an object');
    }

    if (!state.correlationData || typeof state.correlationData !== 'object') {
      errors.push('correlationData must be an object');
    }

    if (errors.length > 0) {
      return {
        valid: false,
        reason: `State structure validation failed: ${errors.join(', ')}`,
        errors,
      };
    }

    return { valid: true };
  }

  /**
   * Validates a state transition
   */
  private validateStateTransition(context: ProcessGuardContext<TState>): GuardResult {
    const currentStep = context.currentState.currentStep;
    const proposedStep = context.proposedState?.currentStep;

    if (!proposedStep) {
      return this.createDeniedResult(
        'Proposed state must include currentStep for state transitions',
        GuardSeverity.ERROR,
        'MISSING_PROPOSED_STEP'
      );
    }

    // Check backward transitions first if not allowed
    if (
      !this.config.allowBackwardTransitions &&
      this.isBackwardTransition(currentStep, proposedStep)
    ) {
      return this.createDeniedResult(
        `Backward transitions are not allowed: '${currentStep}' to '${proposedStep}'`,
        GuardSeverity.ERROR,
        'BACKWARD_TRANSITION_FORBIDDEN',
        { currentStep, proposedStep }
      );
    }

    // Then check if transition is valid according to configuration
    if (!this.isValidStateTransition(currentStep, proposedStep, this.config.validTransitions)) {
      const validNextSteps = this.config.validTransitions[currentStep] || [];
      return this.createDeniedResult(
        `Invalid state transition from '${currentStep}' to '${proposedStep}'`,
        GuardSeverity.ERROR,
        'INVALID_STATE_TRANSITION',
        {
          currentStep,
          proposedStep,
          validNextSteps,
        },
        [`Valid next steps: ${validNextSteps.join(', ')}`]
      );
    }

    // Validate version progression
    const versionValidation = this.validateVersionProgression(
      context.currentState.version,
      context.proposedState?.version
    );
    if (!versionValidation.valid) {
      return this.createDeniedResult(
        versionValidation.reason!,
        GuardSeverity.ERROR,
        'INVALID_VERSION_PROGRESSION',
        {
          currentVersion: context.currentState.version,
          proposedVersion: context.proposedState?.version,
        }
      );
    }

    // Validate conditional step requirements
    if (this.config.conditionalSteps?.[proposedStep]) {
      const conditionValidation = this.validateStepConditions(
        proposedStep,
        context.proposedState as TState
      );
      if (!conditionValidation.valid) {
        return this.createDeniedResult(
          conditionValidation.reason!,
          GuardSeverity.ERROR,
          'STEP_CONDITIONS_NOT_MET',
          { step: proposedStep, missingRequirements: conditionValidation.missing }
        );
      }
    }

    return this.createAllowedResult('State transition is valid', {
      transition: `${currentStep} -> ${proposedStep}`,
    });
  }

  /**
   * Validates completion conditions
   */
  private validateCompletionConditions(context: ProcessGuardContext<TState>): GuardResult {
    const currentStep = context.currentState.currentStep;

    // Check if current step is a valid terminal step
    if (!this.config.terminalSteps.includes(currentStep)) {
      return this.createDeniedResult(
        `Cannot complete process from step '${currentStep}'. Must be in a terminal step.`,
        GuardSeverity.ERROR,
        'NOT_IN_TERMINAL_STEP',
        {
          currentStep,
          terminalSteps: this.config.terminalSteps,
        },
        [`Move to one of these terminal steps first: ${this.config.terminalSteps.join(', ')}`]
      );
    }

    return this.createAllowedResult('Completion conditions met');
  }

  /**
   * Validates that current state allows event handling
   */
  private validateEventHandlingState(context: ProcessGuardContext<TState>): GuardResult {
    const currentStep = context.currentState.currentStep;

    // Check if we're in a terminal step (usually shouldn't handle events)
    if (this.config.terminalSteps.includes(currentStep)) {
      return this.createDeniedResult(
        `Cannot handle events in terminal step '${currentStep}'`,
        GuardSeverity.WARNING,
        'EVENT_HANDLING_IN_TERMINAL_STEP',
        { currentStep }
      );
    }

    return this.createAllowedResult('State allows event handling');
  }

  /**
   * Validates version progression
   */
  private validateVersionProgression(
    currentVersion: number,
    proposedVersion?: number
  ): { valid: boolean; reason?: string } {
    if (proposedVersion === undefined) {
      return { valid: true }; // Version will be auto-incremented
    }

    const expectedVersion = currentVersion + 1;
    const maxAllowedSkip = this.config.maxVersionSkip || 0;

    if (proposedVersion <= currentVersion) {
      return {
        valid: false,
        reason: `Proposed version ${proposedVersion} must be greater than current version ${currentVersion}`,
      };
    }

    if (proposedVersion > expectedVersion + maxAllowedSkip) {
      return {
        valid: false,
        reason: `Proposed version ${proposedVersion} skips too many versions (max skip: ${maxAllowedSkip})`,
      };
    }

    return { valid: true };
  }

  /**
   * Validates conditions for a specific step
   */
  private validateStepConditions(
    step: string,
    proposedState: TState
  ): { valid: boolean; reason?: string; missing?: string[] } {
    const conditions = this.config.conditionalSteps?.[step];
    if (!conditions) {
      return { valid: true };
    }

    const missing: string[] = [];

    // Check required fields
    for (const field of conditions.requiredFields) {
      if (!this.hasNestedProperty(proposedState, field)) {
        missing.push(field);
      }
    }

    // Check forbidden fields
    if (conditions.forbiddenFields) {
      for (const field of conditions.forbiddenFields) {
        if (this.hasNestedProperty(proposedState, field)) {
          return {
            valid: false,
            reason: `Field '${field}' is forbidden in step '${step}'`,
          };
        }
      }
    }

    // Check custom validator
    if (conditions.customValidator && !conditions.customValidator(proposedState)) {
      return {
        valid: false,
        reason: `Custom validation failed for step '${step}'`,
      };
    }

    if (missing.length > 0) {
      return {
        valid: false,
        reason: `Missing required fields for step '${step}': ${missing.join(', ')}`,
        missing,
      };
    }

    return { valid: true };
  }

  /**
   * Determines if a transition is backward based on step ordering
   */
  private isBackwardTransition(fromStep: string, toStep: string): boolean {
    // Simple implementation - could be enhanced with step ordering configuration
    const stepOrder = Object.keys(this.config.validTransitions);
    const fromIndex = stepOrder.indexOf(fromStep);
    const toIndex = stepOrder.indexOf(toStep);

    return fromIndex !== -1 && toIndex !== -1 && toIndex < fromIndex;
  }

  /**
   * Helper to check nested properties in objects
   */
  private hasNestedProperty(obj: any, path: string): boolean {
    const keys = path.split('.');
    let current = obj;

    for (const key of keys) {
      if (current == null || typeof current !== 'object' || !(key in current)) {
        return false;
      }
      current = current[key];
    }

    return current !== undefined && current !== null;
  }
}
