import type { ModuleMetadata, Provider } from '@nestjs/common';
import type { HandlerInfo } from '@vytches/ddd-di';

export type { HandlerInfo };

/**
 * Configuration options for VytchesDDD module
 *
 * Simple interface supporting custom provider configuration
 * like IEventBus => UnifiedEventBus mapping
 *
 * @example
 * ```typescript
 * // VytchesExplorerService automatically injects ICommandBus and IQueryBus
 * // if they are provided in the module:
 * @Module({
 *   providers: [
 *     { provide: ICommandBus, useValue: new EnhancedCommandBus(container) },
 *     { provide: IQueryBus, useValue: new EnhancedQueryBus(container) },
 *   ]
 * })
 * ```
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
   * Additional module imports
   */
  imports?: ModuleMetadata['imports'];

  /**
   * Additional module exports
   */
  exports?: ModuleMetadata['exports'];

  /**
   * Enable auto-discovery of command and query handlers
   *
   * @default true
   * @example
   * ```typescript
   * {
   *   autoDiscovery: {
   *     enabled: true,
   *   }
   * }
   * ```
   */
  autoDiscovery?: {
    enabled?: boolean;
  };

  /**
   * Context-specific configuration for DDD bounded contexts
   *
   * @example
   * ```typescript
   * {
   *   context: {
   *     name: 'Orders',
   *     providers: [OrderService, OrderRepository]
   *   }
   * }
   * ```
   */
  context?: VytchesContextOptions;

  /**
   * Global module configuration
   *
   * @default false
   */
  isGlobal?: boolean;

  /**
   * Bridge to NestJS DI container
   * @deprecated Legacy option from VP-012, kept for test compatibility
   */
  bridgeToNestJS?: boolean;

  /**
   * Performance configuration
   * @deprecated Legacy option from VP-012, kept for test compatibility
   */
  performance?: {
    performanceTarget?: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  };

  /**
   * Handler configuration
   * @deprecated Legacy option from VP-012, kept for test compatibility
   */
  handlers?: {
    include?: string[];
    exclude?: string[];
    prefix?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  };

  /**
   * Contexts configuration for multi-context scenarios
   * @deprecated Legacy option from VP-012, kept for test compatibility
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contexts?: string[] | Record<string, any>;

  /**
   * Monitoring configuration
   * @deprecated Legacy option from VP-012, kept for test compatibility
   */
  monitoring?: {
    enabled?: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  };

  /**
   * Global bridge to NestJS configuration (used in forContexts)
   * @deprecated Legacy option from VP-012, kept for test compatibility
   */
  globalBridgeToNestJS?: boolean;

  /**
   * Enable contexts flag
   * @deprecated Legacy option from VP-012, kept for test compatibility
   */
  enableContexts?: boolean;
}

/**
 * Enterprise-specific VytchesDDD module options
 * Extends base options with enterprise-grade requirements
 */
export interface VytchesEnterpriseModuleOptions extends VytchesDDDModuleOptions {
  /**
   * Enterprise-grade auto-discovery configuration
   */
  autoDiscovery?: {
    enabled?: boolean;
    /**
     * Enterprise performance targets
     */
    targets?: {
      maxHandlers?: number;
      discoveryTime?: number;
    };
  };
}

/**
 * Context-specific configuration options
 * Supports per-context handler registration and DI bridging
 */
export interface VytchesContextOptions {
  /**
   * Context name for bounded context isolation
   */
  name: string;

  /**
   * Context-specific providers
   */
  providers?: Provider[];

  /**
   * Context-specific module configuration
   */
  module?: {
    /**
     * Additional imports for this context
     */
    imports?: ModuleMetadata['imports'];

    /**
     * Context-specific exports
     */
    exports?: ModuleMetadata['exports'];
  };
}

/**
 * Handler registration configuration
 */
export interface VytchesHandlerOptions {
  /**
   * Handler class
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: new (...args: any[]) => any;

  /**
   * Handler metadata
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;

  /**
   * Context name for bounded context
   */
  context?: string;
}

/**
 * Module metadata for VytchesDDD configuration
 */
export interface VytchesModuleMetadata {
  /**
   * Module providers
   */
  providers: Provider[];

  /**
   * Module imports
   */
  imports: ModuleMetadata['imports'];

  /**
   * Module exports
   */
  exports: ModuleMetadata['exports'];

  /**
   * Discovered handlers
   */
  handlers: HandlerInfo[];
}
