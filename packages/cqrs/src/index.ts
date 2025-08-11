// Core interfaces
export type { ICommand, ICommandHandler, IQuery, IQueryHandler } from './interfaces';

// Abstract classes (service tokens)
export { ICommandBus, IQueryBus } from './abstracts';

// Concrete implementations
export { CommandBus, EnhancedCommandBus, EnhancedQueryBus, QueryBus } from './implementations';

// Decorators
export { CommandHandler, QueryHandler } from './decorators';

// Middleware
export { CQRSExecutionContext, LoggingMiddleware } from './middleware';
export type { ExecutionContext, ICQRSMiddleware } from './middleware';

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
