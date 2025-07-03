// Most commonly used - prioritized exports
export {
  captureState
} from './capture-state.decorator';

export {
  AuditEventProcessor
} from './audit-processor';

// Types commonly used
export type {
  IAuditEvent,
  AuditActionType,
  AuditStatus,
  IAuditEventMetadata
} from './audit-event.interface';

export type {
  IAuditable
} from './audible.interface';

// For advanced usage - full exports
export * from './audit-event.interface';
export * from './audible.interface';
export * from './capture-state.decorator';
export * from './audit-processor';
