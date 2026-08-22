import type { ModuleMetadata, Provider, Type } from '@nestjs/common';
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
 * // if they are provided in the module. Prefer useFactory/useClass over
 * // useValue so each module owns its bus instance (a useValue bus is a
 * // process-global singleton that leaks stale handlers across modules):
 * @Module({
 *   providers: [
 *     { provide: ICommandBus, useFactory: () => new EnhancedCommandBus(container) },
 *     { provide: IQueryBus, useFactory: () => new EnhancedQueryBus(container) },
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
   * Contexts configuration for multi-context scenarios.
   * Read by forContexts() to derive per-context providers.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contexts?: string[] | Record<string, any>;
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

  /**
   * When true, a failure to register any discovered handler aborts bootstrap
   * (the error is rethrown) instead of being logged and skipped. Use to fail
   * fast on DI misconfiguration rather than discovering it as an opaque runtime
   * 500 — particularly valuable for auth/permission handlers.
   *
   * @default false
   */
  strictHandlerRegistration?: boolean;
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

/**
 * Factory contract for {@link VytchesDDDModule.forRootAsync} `useClass` /
 * `useExisting`.
 *
 * Implement on a provider that can build the module options from injected
 * dependencies (typically a `ConfigService`).
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class VytchesOptionsProvider implements VytchesDDDOptionsFactory {
 *   constructor(private readonly config: ConfigService) {}
 *
 *   createVytchesDDDOptions(): VytchesDDDModuleOptions {
 *     return { autoDiscovery: { enabled: this.config.get('DDD_DISCOVERY') !== 'off' } };
 *   }
 * }
 * ```
 *
 * @public
 * @since 0.31.0
 */
export interface VytchesDDDOptionsFactory {
  createVytchesDDDOptions(): Promise<VytchesDDDModuleOptions> | VytchesDDDModuleOptions;
}

/**
 * Async configuration for {@link VytchesDDDModule.forRootAsync} — the standard
 * NestJS `useFactory` / `useClass` / `useExisting` triad.
 *
 * The factory resolves to the very same {@link VytchesDDDModuleOptions} that
 * the synchronous `forRoot()` accepts, so there is one options vocabulary for
 * the module rather than two.
 *
 * **Which fields are honoured asynchronously.** NestJS needs a `DynamicModule`'s
 * `providers`, `imports`, `exports` and `global` flag *before* the DI container
 * exists, so they cannot come out of a factory that itself depends on DI. They
 * are therefore declared statically on this object ({@link imports},
 * {@link isGlobal}, {@link providers}), while the factory supplies the options
 * that are read at runtime — currently {@link VytchesDDDModuleOptions.autoDiscovery}
 * and {@link VytchesDDDModuleOptions.context}. Returning `providers`/`imports`/
 * `exports`/`isGlobal` from the factory is not an error, but those fields are
 * ignored; declare them here instead.
 *
 * @example ConfigService-driven setup
 * ```typescript
 * @Module({
 *   imports: [
 *     VytchesDDDModule.forRootAsync({
 *       imports: [ConfigModule],
 *       inject: [ConfigService],
 *       useFactory: (config: ConfigService) => ({
 *         autoDiscovery: { enabled: config.get('DDD_DISCOVERY') !== 'off' },
 *       }),
 *     }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 *
 * @example useClass
 * ```typescript
 * VytchesDDDModule.forRootAsync({
 *   imports: [ConfigModule],
 *   useClass: VytchesOptionsProvider,
 * })
 * ```
 *
 * @public
 * @since 0.31.0
 */
export interface VytchesDDDModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  /**
   * Dependencies injected into {@link useFactory}, in parameter order.
   */
  inject?: unknown[];

  /**
   * Builds the module options from injected dependencies.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- variadic
  // factory args cannot be typed without making the signature contravariant
  // and rejecting every real ConfigService factory; this is the same shape
  // @nestjs/typeorm and @nestjs/config use.
  useFactory?: (...args: any[]) => Promise<VytchesDDDModuleOptions> | VytchesDDDModuleOptions;

  /**
   * Class implementing {@link VytchesDDDOptionsFactory}; instantiated by NestJS.
   */
  useClass?: Type<VytchesDDDOptionsFactory>;

  /**
   * Already-registered provider implementing {@link VytchesDDDOptionsFactory}.
   */
  useExisting?: Type<VytchesDDDOptionsFactory>;

  /**
   * Custom providers. Static — NestJS resolves the provider list before the
   * factory runs, so this cannot come from {@link useFactory}.
   */
  providers?: Provider[];

  /**
   * Global module flag. Static, for the same reason as {@link providers}.
   *
   * @default true
   */
  isGlobal?: boolean;
}
