/**
 * @vytches/ddd-nestjs
 * NestJS integration for VytchesDDD
 */

export { VytchesDDDModule } from './vytches-ddd.module';
export { VytchesExplorerService } from './services/vytches-explorer.service';
export { ICommandBus, IQueryBus } from '@vytches/ddd-cqrs';
export { NestJSContainerAdapter } from './adapters';
export type { HandlerInfo, VytchesDDDModuleOptions } from './types';
