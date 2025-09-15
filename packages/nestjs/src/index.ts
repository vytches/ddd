/**
 * @vytches/ddd-nestjs
 * Simple, clean NestJS integration for VytchesDDD Enterprise Domain-Driven Design framework
 *
 * Following @nestjs/cqrs patterns for familiar, proven integration
 */

// Main module
export { VytchesDDDModule } from './vytches-ddd.module';

// Explorer service for auto-discovery
export { VytchesExplorerService } from './services/vytches-explorer.service';

// Types and interfaces
export type {
  HandlerInfo,
  PerformanceMetrics,
  PerformanceMode,
  PerformanceOptimizer,
  VytchesDDDModuleOptions,
  VytchesEnterpriseModuleOptions,
  VytchesMonitoringOptions,
  VytchesPerformanceOptions,
  VytchesPerformanceProfileOptions,
} from './types';
