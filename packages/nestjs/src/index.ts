/**
 * @vytches/ddd-nestjs
 * NestJS adapter for VytchesDDD Enterprise Domain-Driven Design framework
 */

// Main module
export { VytchesDDDModule } from './vytches-ddd.module';

// Container adapter
export { NestJSContainerAdapter } from './adapters/nestjs-container.adapter';

// Types and interfaces
export * from './types';

// Configuration
export * from './configuration';

// Discovery
export * from './discovery';

// Utilities
export * from './utils';
