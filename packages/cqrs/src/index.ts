// Core interfaces
export type {
  ICommand,
  ICommandHandler,
  IDisposableBus,
  IQuery,
  IQueryHandler,
  IResettableBus,
} from './interfaces';

// Abstract classes (service tokens) + stable Symbol.for DI tokens (dual-package safe)
export { ICommandBus, IQueryBus, COMMAND_BUS_TOKEN, QUERY_BUS_TOKEN } from './abstracts';

// Concrete implementations
export { CommandBus, QueryBus } from './implementations';

// Enhanced implementations (require @vytches/ddd-resilience)
export { EnhancedCommandBus, EnhancedQueryBus } from './implementations/enhanced';

// Retry configuration shared by EnhancedCommandBus/EnhancedQueryBus (D12).
// EnhancedCommandBusOptions/EnhancedQueryBusOptions remain un-exported from
// this top-level entry — a pre-existing gap, intentionally out of scope here.
export type { BusRetryOptions } from './implementations/bus-retry-options';

// Decorators
export { CommandHandler, QueryHandler } from './decorators';

// Middleware
export { CQRSExecutionContext, LoggingMiddleware } from './middleware';
export type { ExecutionContext, ICQRSMiddleware, IMiddlewareLogger } from './middleware';

// Registry removed - now using pure metadata approach with DI container auto-discovery

// Validation
export { CqrsValidationError } from './validation';
export type { ICqrsValidatable } from './validation';

// Errors
export {
  CommandExecutionError,
  CQRSConfigurationError,
  HandlerNotFoundError,
  QueryExecutionError,
} from './errors';

// Configuration
export { CQRSConfiguration, CQRSModule } from './configuration';
export type { CQRSOptions } from './configuration';

// DI Integration (optional)
export { CQRSDiscoveryPlugin } from './di-integration';
