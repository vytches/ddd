// Priority exports for better tree-shaking
export { ProjectionEngine } from './projection-engine';

export { BaseProjection } from './projection-base';

export { ProjectionBuilder } from './projection.builder';

export {
  ProjectionRebuilder,
  createProjectionRebuilder,
  type IProjectionRebuilder,
  type IProjectionRebuildConfig,
} from './projection-rebuilder';

export type {
  IProjection,
  IProjectionStore,
  IProjectionCapability,
  ICapabilityContext,
  IProjectionEngine,
  ErrorProjectionState,
} from './projection-interfaces';

export { ProjectionError } from './projection-errors';

export {
  BaseIntervalCapability,
  SnapshotProjectionCapability,
  CheckpointCapability,
  CircuitBreakerCapability,
  DeadLetterCapability,
} from './capabilities';

// For advanced usage - full exports removed for better tree-shaking
// Import specific exports from subpaths when needed
