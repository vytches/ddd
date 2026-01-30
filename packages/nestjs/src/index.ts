/**
 * @vytches/ddd-nestjs
 * NestJS integration for VytchesDDD
 */

export { VytchesDDDModule } from './vytches-ddd.module';
export { VytchesExplorerService } from './services/vytches-explorer.service';

// Container adapter for CQRS buses
export { NestJSContainerAdapter } from './adapters';

// Types and interfaces
export type { HandlerInfo, VytchesDDDModuleOptions } from './types';
