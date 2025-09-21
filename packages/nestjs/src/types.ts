import type { ModuleMetadata, Provider } from '@nestjs/common';

/**
 * Configuration options for VytchesDDD module
 *
 * Simple interface supporting custom provider configuration
 * like IEventBus => UnifiedEventBus mapping
 */
export interface VytchesDDDModuleOptions {
  /**
   * Custom providers for dependency injection
   *
   * @example
   * ```typescript
   * {
   *   providers: [
   *     { provide: ICommandBus, useClass: EnhancedCommandBus },
   *     { provide: IQueryBus, useClass: EnhancedQueryBus },
   *     { provide: IEventBus, useClass: UnifiedEventBus },
   *   ]
   * }
   * ```
   */
  providers?: Provider[];

  /**
   * Additional imports for the module
   */
  imports?: ModuleMetadata['imports'];

  /**
   * Additional exports beyond the default explorer service
   */
  exports?: ModuleMetadata['exports'];
}

/**
 * Extended module metadata with VytchesDDD-specific options
 */
export interface VytchesDDDDynamicModule extends ModuleMetadata {
  module: typeof import('./vytches-ddd.module').VytchesDDDModule;
}
