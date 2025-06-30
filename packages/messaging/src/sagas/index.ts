// Saga pattern implementation
// TODO: Implement saga pattern components

export interface ISaga {
  readonly sagaId: string;
  readonly sagaType: string;
  readonly status: SagaStatus;
}

export enum SagaStatus {
  STARTED = 'STARTED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  COMPENSATING = 'COMPENSATING',
  COMPENSATED = 'COMPENSATED',
}

// Placeholder for future saga implementation
export class SagaManager {
  // TODO: Implement saga orchestration
}
