/**
 * @vytches/ddd-nestjs
 * NestJS integration for VytchesDDD
 */

export { VytchesDDDModule } from './vytches-ddd.module';
export { VytchesDDDFeatureModule } from './feature/vytches-ddd-feature.module';
export { VytchesExplorerService } from './services/vytches-explorer.service';

// Container adapter for CQRS buses
export { NestJSContainerAdapter } from './adapters';

// ACL auto-discovery
export { ACLAdapterFor } from './decorators/acl-adapter.decorator';
export type { ACLAdapterMetadata } from './decorators/acl-adapter.decorator';
export { ACL_REGISTRY, LOCAL_EVENT_BUS, GLOBAL_QUERY_BUS, GLOBAL_COMMAND_BUS } from './constants';

// Re-exported from @vytches/ddd-cqrs so that wiring a NestJS app never requires
// a direct dependency on the CQRS package. These are the tokens
// VytchesExplorerService injects; anyone hand-wiring buses outside
// VytchesDDDModule needs them to alias their own ICommandBus / IQueryBus.
// eslint-disable-next-line @nx/enforce-module-boundaries -- deliberate token re-export for consumer ergonomics
export { COMMAND_BUS_TOKEN, QUERY_BUS_TOKEN } from '@vytches/ddd-cqrs';

// Per-context event routing dispatcher (use with forFeature())
export { ContextAwareEventDispatcher } from './dispatchers/context-aware-event-dispatcher';

// Types and interfaces
export type { HandlerInfo, VytchesDDDModuleOptions } from './types';

// Outbox processor module (multi-processor lifecycle wrapper)
export { OutboxProcessorModule, OutboxProcessorService } from './outbox';
export type { OutboxProcessorEntry, OutboxProcessorModuleAsyncOptions } from './outbox';
