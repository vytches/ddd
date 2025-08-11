import type { IExtendedDomainEvent } from '@vytches/ddd-contracts';
import type {
  ISagaActionResult,
  ISagaExecutionContext,
  ISagaState,
  ISagaStep,
} from '../interfaces';

export interface SagaStepConfig {
  name: string;
  displayName: string;
  description?: string;
  compensatable: boolean;
  timeout: number | undefined;
  maxRetries?: number;
  triggerEvents: string[];
  completionEvents: string[];
  execute: (
    event: IExtendedDomainEvent,
    state: ISagaState,
    context: ISagaExecutionContext
  ) => Promise<ISagaActionResult>;
  compensate?: (state: ISagaState, context: ISagaExecutionContext) => Promise<ISagaActionResult>;
  canExecute?: (event: IExtendedDomainEvent, state: ISagaState) => boolean;
}

export class ConcreteSagaStep implements ISagaStep {
  readonly name: string;
  readonly displayName: string;
  readonly description?: string;
  readonly compensatable: boolean;
  readonly timeout: number | undefined;
  readonly maxRetries?: number;
  readonly triggerEvents: string[];
  readonly completionEvents: string[];

  private executeImpl: SagaStepConfig['execute'];
  private compensateImpl?: SagaStepConfig['compensate'];
  private canExecuteImpl?: SagaStepConfig['canExecute'];

  constructor(config: SagaStepConfig) {
    this.name = config.name;
    this.displayName = config.displayName;
    if (config.description !== undefined) {
      this.description = config.description;
    }
    this.compensatable = config.compensatable;
    this.timeout = config.timeout;
    if (config.maxRetries !== undefined) {
      this.maxRetries = config.maxRetries;
    }
    this.triggerEvents = config.triggerEvents;
    this.completionEvents = config.completionEvents;
    this.executeImpl = config.execute;
    this.compensateImpl = config.compensate;
    this.canExecuteImpl = config.canExecute;
  }

  async execute(
    event: IExtendedDomainEvent,
    state: ISagaState,
    context: ISagaExecutionContext
  ): Promise<ISagaActionResult> {
    return await this.executeImpl(event, state, context);
  }

  async compensate(state: ISagaState, context: ISagaExecutionContext): Promise<ISagaActionResult> {
    if (!this.compensatable) {
      return { success: true };
    }

    if (this.compensateImpl) {
      return await this.compensateImpl(state, context);
    }

    return { success: true };
  }

  canExecute(event: IExtendedDomainEvent, state: ISagaState): boolean {
    if (this.canExecuteImpl) {
      return this.canExecuteImpl(event, state);
    }
    return true;
  }
}
