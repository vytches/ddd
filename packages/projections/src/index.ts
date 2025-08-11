// Priority exports for better tree-shaking
export { ProjectionEngine } from './projection-engine';

export { BaseProjection } from './projection-base';

export { ProjectionBuilder } from './projection.builder';

export {
  createProjectionRebuilder,
  ProjectionRebuilder,
  type IProjectionRebuildConfig,
  type IProjectionRebuilder,
} from './projection-rebuilder';

export type {
  ErrorProjectionState,
  ICapabilityContext,
  IProjection,
  IProjectionCapability,
  IProjectionEngine,
  IProjectionStore,
} from './projection-interfaces';

export { ProjectionError } from './projection-errors';

export {
  BaseIntervalCapability,
  CheckpointCapability,
  CircuitBreakerCapability,
  DeadLetterCapability,
  SnapshotProjectionCapability,
} from './capabilities';
