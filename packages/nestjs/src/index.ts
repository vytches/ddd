/**
 * @vytches/ddd-nestjs
 * NestJS integration for VytchesDDD
 */

export { VytchesDDDModule } from './vytches-ddd.module';
export { VytchesExplorerService } from './services/vytches-explorer.service';

// Container adapter for CQRS buses
export { NestJSContainerAdapter } from './adapters';

// ACL auto-discovery
export { ACLAdapterFor } from './decorators/acl-adapter.decorator';
export type { ACLAdapterMetadata } from './decorators/acl-adapter.decorator';
export { ACL_REGISTRY } from './constants';

// Types and interfaces
export type { HandlerInfo, VytchesDDDModuleOptions } from './types';

// Outbox processor module (multi-processor lifecycle wrapper)
export { OutboxProcessorModule, OutboxProcessorService } from './outbox';
export type { OutboxProcessorEntry, OutboxProcessorModuleAsyncOptions } from './outbox';
