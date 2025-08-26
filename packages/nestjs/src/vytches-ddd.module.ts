import type { DynamicModule, OnModuleInit, Type } from '@nestjs/common';
import { Global, Inject, Module, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { CommandBus, QueryBus } from '@vytches/ddd-cqrs';
import { NestJSContainerAdapter } from './adapters/nestjs-container.adapter';
import { VYTCHES_DDD_OPTIONS } from './constants';
import { VytchesDiscoveryService } from './discovery/vytches-discovery.service';
import type {
  CQRSOptions,
  VytchesDDDAsyncOptions,
  VytchesDDDContextOptions,
  VytchesDDDFeatureOptions,
  VytchesDDDOptions,
  VytchesDDDTestOptions,
} from './types';

/**
 * Main VytchesDDD NestJS Module
 * Provides seamless integration between NestJS and VytchesDDD
 */
@Global()
@Module({})
export class VytchesDDDModule implements OnModuleInit {
  private static adapter: NestJSContainerAdapter;
  private static logger = new Logger('VytchesDDDModule');
  private initTimeout?: NodeJS.Timeout;

  constructor(
    @Inject(ModuleRef) private readonly moduleRef: ModuleRef,
    @Inject(VYTCHES_DDD_OPTIONS) private readonly options: VytchesDDDOptions
  ) {}

  /**
   * Initialize VytchesDDD on module init with timeout and proper error handling
   */
  async onModuleInit(): Promise<void> {
    const startTime = Date.now();
    const timeout = (this.options as any)?.initTimeout ?? 5000;

    try {
      // Run initialization with timeout
      await Promise.race([
        this.initializeModule(),
        new Promise((_, reject) => {
          this.initTimeout = setTimeout(
            () => reject(new Error(`VytchesDDD initialization timeout after ${timeout}ms`)),
            timeout
          );
        }),
      ]);

      VytchesDDDModule.logger.log(
        `✓ VytchesDDD initialized successfully in ${Date.now() - startTime}ms`
      );
    } catch (error) {
      // Always log errors - no silent failures
      VytchesDDDModule.logger.error('Failed to initialize VytchesDDD:', error);
      VytchesDDDModule.logger.warn('VytchesDDD is running with limited functionality');
      // Don't throw - allow app to continue
    } finally {
      if (this.initTimeout) {
        clearTimeout(this.initTimeout);
      }
    }
  }

  /**
   * Internal initialization logic
   */
  private async initializeModule(): Promise<void> {
    // Set up the adapter with ModuleRef
    if (VytchesDDDModule.adapter) {
      VytchesDDDModule.adapter.setModuleRef(this.moduleRef);
    } else {
      VytchesDDDModule.adapter = new NestJSContainerAdapter(this.moduleRef);
    }

    // Try to configure VytchesDDD but don't fail if it doesn't work
    try {
      const { VytchesDDD } = await import('@vytches/ddd-di');
      await VytchesDDD.configure(VytchesDDDModule.adapter);
      VytchesDDDModule.logger.debug('VytchesDDD DI configured successfully');
    } catch (error) {
      VytchesDDDModule.logger.warn('Could not configure VytchesDDD DI:', error);
      // Continue without VytchesDDD - basic functionality still works
    }

    // Set up CQRS if configured
    if (this.options.cqrs) {
      try {
        await this.setupCQRS();
      } catch (error) {
        VytchesDDDModule.logger.error('Failed to setup CQRS:', error);
      }
    }

    // Set up Events if configured
    if (this.options.events) {
      try {
        await this.setupEvents();
      } catch (error) {
        VytchesDDDModule.logger.error('Failed to setup Events:', error);
      }
    }

    // Discovery is DISABLED by default - only run if explicitly enabled
    if (this.options?.discovery?.enabled === true) {
      VytchesDDDModule.logger.log('Discovery explicitly enabled, starting...');
      await this.runDiscovery();
    } else if (this.options?.autoDiscovery === true) {
      // Legacy auto-discovery
      VytchesDDDModule.logger.log('Legacy auto-discovery enabled');
      await this.runLegacyDiscovery();
    }
  }

  /**
   * Run discovery with timeout
   */
  private async runDiscovery(): Promise<void> {
    try {
      const discoveryService = new VytchesDiscoveryService(
        VytchesDDDModule.adapter,
        this.moduleRef!
      );

      // Run with 3 second timeout
      await Promise.race([
        discoveryService.discoverAll(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Discovery timeout')), 3000)),
      ]);

      VytchesDDDModule.logger.log('Discovery completed successfully');
    } catch (error) {
      VytchesDDDModule.logger.error('Discovery failed:', error);
      // Don't throw - continue without discovery
    }
  }

  /**
   * Run legacy discovery (same as regular discovery now)
   */
  private async runLegacyDiscovery(): Promise<void> {
    await this.runDiscovery();
  }

  /**
   * Set up plugin-based discovery system
   */
  private async setupPluginDiscovery(): Promise<void> {
    // Lazy load discovery registry
    const diModule = await import('@vytches/ddd-di');
    const DiscoveryRegistry =
      (diModule as any).DiscoveryRegistry || (diModule as any).default?.DiscoveryRegistry;

    if (!DiscoveryRegistry) {
      console.warn('[VytchesDDD] DiscoveryRegistry not available, skipping plugin discovery');
      return;
    }

    const registry = new DiscoveryRegistry({
      autoDiscover: true,
      parallel: this.options.discovery?.parallel ?? true,
      timeout: this.options.discovery?.timeout ?? 5000,
      debug: this.options.discovery?.debug ?? false,
      accessMatrix: this.options.contexts ? this.extractAccessMatrix() : undefined,
    });

    // Register configured plugins
    if (this.options.discovery?.plugins) {
      for (const plugin of this.options.discovery.plugins) {
        registry.registerPlugin(plugin);
      }
    } else {
      // Auto-register standard plugins
      await this.autoRegisterPlugins(registry);
    }

    // Discover for each configured context
    if (this.options.contexts) {
      for (const [contextName, contextConfig] of Object.entries(this.options.contexts)) {
        const modules = contextConfig.modules || [];
        await registry.discoverForContext(contextName, modules, VytchesDDDModule.adapter);
      }
    }

    // Store registry for later access
    VytchesDDDModule.adapter.registerInstance('discoveryRegistry', registry);
  }

  /**
   * Auto-register standard VytchesDDD plugins
   */
  private async autoRegisterPlugins(registry: any): Promise<void> {
    // Map feature names to plugin packages
    const featureToPlugin: Record<string, { package: string; class: string }> = {
      cqrs: { package: '@vytches/ddd-cqrs', class: 'CQRSDiscoveryPlugin' },
      acl: { package: '@vytches/ddd-acl', class: 'ACLDiscoveryPlugin' },
      events: { package: '@vytches/ddd-events', class: 'EventDiscoveryPlugin' },
      'domain-services': {
        package: '@vytches/ddd-domain-services',
        class: 'DomainServiceDiscoveryPlugin',
      },
      policies: { package: '@vytches/ddd-policies', class: 'PolicyDiscoveryPlugin' },
      messaging: { package: '@vytches/ddd-messaging', class: 'SagaDiscoveryPlugin' },
      sagas: { package: '@vytches/ddd-messaging', class: 'SagaDiscoveryPlugin' },
    };

    // If features are specified, only load those plugins
    const featuresToLoad = this.options.features || Object.keys(featureToPlugin);

    for (const feature of featuresToLoad) {
      const pluginConfig = featureToPlugin[feature];
      if (!pluginConfig) {
        console.warn(`Unknown feature: ${feature}`);
        continue;
      }

      try {
        const module = await import(pluginConfig.package);
        if (module[pluginConfig.class]) {
          const plugin = new module[pluginConfig.class]();
          registry.registerPlugin(plugin);
        }
      } catch {
        // Package not installed, skip silently unless debug mode
        if (this.options.discovery?.debug) {
          console.log(
            `Package ${pluginConfig.package} not installed, skipping ${feature} discovery`
          );
        }
      }
    }
  }

  /**
   * Extract access matrix from context configuration
   */
  private extractAccessMatrix(): Record<string, string[]> {
    const matrix: Record<string, string[]> = {};

    if (this.options.contexts) {
      for (const [contextName, config] of Object.entries(this.options.contexts)) {
        matrix[contextName] = config.accessMatrix || [];
      }
    }

    return matrix;
  }

  /**
   * Normalize options for progressive complexity
   * Handles: empty options, features array, or full configuration
   */
  private static normalizeOptions(options?: VytchesDDDOptions | string[]): VytchesDDDOptions {
    // Handle undefined or null
    if (!options) {
      // Zero-config: DISABLE discovery by default to prevent hanging
      return {
        discovery: {
          enabled: false, // DISABLED by default!
          parallel: true,
          debug: false,
        },
        cqrs: {
          autoRegisterHandlers: false, // DISABLED by default!
        },
        events: {
          eventBus: {
            type: 'unified',
          },
        },
      };
    }

    // Handle features array shorthand
    if (Array.isArray(options)) {
      return {
        features: options,
        discovery: {
          enabled: false, // Still disabled by default
          parallel: true,
        },
      };
    }

    // Handle empty object - same as zero-config
    if (Object.keys(options).length === 0) {
      return {
        discovery: {
          enabled: false, // DISABLED by default!
          parallel: true,
          debug: false,
        },
        cqrs: {
          autoRegisterHandlers: false, // DISABLED by default!
        },
        events: {
          eventBus: {
            type: 'unified',
          },
        },
      };
    }

    // Handle features-only configuration
    if (options.features && !options.discovery && !options.contexts) {
      return {
        ...options,
        discovery: {
          enabled: false, // Disabled by default
          parallel: true,
        },
      };
    }

    // Full configuration - return as-is
    return options;
  }

  /**
   * Configure module for root with progressive complexity
   *
   * @example Zero-config (simplest)
   * ```typescript
   * VytchesDDDModule.forRoot()
   * ```
   *
   * @example Feature selection (intermediate)
   * ```typescript
   * VytchesDDDModule.forRoot({ features: ['acl', 'cqrs', 'events'] })
   * // or shorthand:
   * VytchesDDDModule.forRoot(['acl', 'cqrs', 'events'])
   * ```
   *
   * @example Full control (enterprise)
   * ```typescript
   * VytchesDDDModule.forRoot({
   *   contexts: { ... },
   *   discovery: { ... },
   *   cqrs: { ... }
   * })
   * ```
   */
  static forRoot(options?: VytchesDDDOptions | string[]): DynamicModule {
    // Create adapter instance
    this.adapter = new NestJSContainerAdapter();

    // Normalize options for progressive complexity
    const normalizedOptions = this.normalizeOptions(options);

    // Log configuration for debugging
    this.logger.log('VytchesDDDModule configuration:', {
      discovery: normalizedOptions.discovery?.enabled ? 'enabled' : 'disabled',
      autoDiscovery: normalizedOptions.autoDiscovery ? 'enabled' : 'disabled',
      cqrs: normalizedOptions.cqrs ? 'configured' : 'not configured',
      events: normalizedOptions.events ? 'configured' : 'not configured',
    });

    // Build providers based on features
    const providers = this.buildProviders(normalizedOptions);

    // Detect which features are enabled
    const detectedFeatures = this.detectInstalledPackages();
    const enabledFeatures = normalizedOptions.features || detectedFeatures;

    // Build exports based on what's actually provided
    const exports: any[] = [NestJSContainerAdapter, VYTCHES_DDD_OPTIONS];

    // Only export services that were actually provided
    if (enabledFeatures.includes('cqrs') || normalizedOptions.cqrs) {
      exports.push(CommandBus, QueryBus, 'ICommandBus', 'IQueryBus');
    }

    // Only export events if the package is actually available
    if (enabledFeatures.includes('events') || normalizedOptions.events) {
      try {
        const { UnifiedEventBus, UniversalEventDispatcher } = require('@vytches/ddd-events');
        exports.push(UnifiedEventBus, 'IEventBus');

        // Export dispatcher if enabled
        if (normalizedOptions.events?.dispatcher?.enabled !== false) {
          exports.push(UniversalEventDispatcher, 'IEventDispatcher');
        }
      } catch {
        // Events package not available - don't export
        this.logger.debug('Events package not available, skipping event exports');
      }
    }

    return {
      module: VytchesDDDModule,
      providers,
      exports,
    };
  }

  /**
   * Resolve implementation based on configuration
   */
  private static resolveImplementation(
    implementation: 'simple' | 'enhanced' | Type<any> | (() => any) | undefined,
    simpleClass: Type<any>,
    enhancedClass: Type<any>
  ): Type<any> | (() => any) {
    if (!implementation) {
      // Default to simple for explicit configuration
      return simpleClass;
    }

    if (implementation === 'simple') {
      return simpleClass;
    }

    if (implementation === 'enhanced') {
      return enhancedClass;
    }

    // Custom implementation (class or factory)
    return implementation;
  }

  /**
   * Build providers based on configured features
   */
  private static buildProviders(options: VytchesDDDOptions): any[] {
    const providers: any[] = [
      {
        provide: VYTCHES_DDD_OPTIONS,
        useValue: options,
      },
      {
        provide: NestJSContainerAdapter,
        useValue: this.adapter,
      },
      VytchesDiscoveryService,
    ];

    // Add custom providers if provided (NestJS style)
    if (options.providers && Array.isArray(options.providers)) {
      providers.push(...options.providers);
    }

    // Detect which packages are installed and add their providers
    const detectedFeatures = this.detectInstalledPackages();
    const enabledFeatures = options.features || detectedFeatures;

    // Add CQRS providers if enabled
    if (enabledFeatures.includes('cqrs') || options.cqrs) {
      providers.push(...this.buildCQRSProviders(options.cqrs));
    }

    // Add Events providers if enabled
    if (enabledFeatures.includes('events') || options.events) {
      providers.push(...this.buildEventProviders(options.events));
    }

    // Add ACL providers if enabled
    if (enabledFeatures.includes('acl') || options.acl) {
      providers.push(...this.buildACLProviders(options.acl));
    }

    // Add Domain Services providers if enabled
    if (enabledFeatures.includes('domain-services') || options.domainServices) {
      providers.push(...this.buildDomainServicesProviders(options.domainServices));
    }

    // Add Resilience providers if enabled
    if (enabledFeatures.includes('resilience') || options.resilience) {
      providers.push(...this.buildResilienceProviders(options.resilience));
    }

    // Add Messaging/Sagas providers if enabled
    if (
      enabledFeatures.includes('messaging') ||
      enabledFeatures.includes('sagas') ||
      options.messaging
    ) {
      providers.push(...this.buildMessagingProviders(options.messaging));
    }

    // Add Policies providers if enabled
    if (enabledFeatures.includes('policies') || options.policies) {
      providers.push(...this.buildPoliciesProviders(options.policies));
    }

    return providers;
  }

  /**
   * Detect installed @vytches/ddd-* packages
   */
  private static detectInstalledPackages(): string[] {
    const features: string[] = [];
    const packageToFeature: Record<string, string> = {
      '@vytches/ddd-cqrs': 'cqrs',
      '@vytches/ddd-events': 'events',
      '@vytches/ddd-acl': 'acl',
      '@vytches/ddd-domain-services': 'domain-services',
      '@vytches/ddd-resilience': 'resilience',
      '@vytches/ddd-messaging': 'messaging',
      '@vytches/ddd-policies': 'policies',
    };

    for (const [pkg, feature] of Object.entries(packageToFeature)) {
      try {
        require.resolve(pkg);
        features.push(feature);
      } catch {
        // Package not installed
      }
    }

    return features;
  }

  /**
   * Build CQRS-specific providers with flexible implementation selection
   */
  private static buildCQRSProviders(cqrsConfig?: CQRSOptions): any[] {
    const providers: any[] = [];

    // Import classes (they're already imported at top)
    const { CommandBus: SimpleCommandBus, QueryBus: SimpleQueryBus } = require('@vytches/ddd-cqrs');
    // Use enhanced implementations with all features
    const { EnhancedCommandBus, EnhancedQueryBus } = require('@vytches/ddd-cqrs');

    // Configure Command Bus
    const commandBusConfig = cqrsConfig?.commandBus;
    const commandBusToken = commandBusConfig?.token || CommandBus;
    const commandBusImplementation = this.resolveImplementation(
      commandBusConfig?.implementation,
      SimpleCommandBus,
      EnhancedCommandBus
    );

    providers.push(
      {
        provide: commandBusToken,
        useFactory: (adapter: NestJSContainerAdapter) => {
          let bus: any;

          // Create instance based on implementation type
          if (typeof commandBusImplementation === 'function') {
            // Check if it's a class constructor or factory function
            if (
              commandBusImplementation.prototype &&
              commandBusImplementation.prototype.constructor
            ) {
              // Class constructor
              bus = new (commandBusImplementation as any)(adapter);
            } else {
              // Factory function
              bus = (commandBusImplementation as any)(adapter);
            }
          } else {
            // Fallback to SimpleCommandBus
            bus = new SimpleCommandBus(adapter);
          }

          // Apply middleware (bus-specific or global)
          const middleware = commandBusConfig?.middleware || cqrsConfig?.middleware;
          if (middleware && bus.use) {
            this.applyMiddleware(bus, middleware);
          }

          // Apply additional configuration
          if (commandBusConfig?.timeout && bus.setTimeout) {
            bus.setTimeout(commandBusConfig.timeout);
          }
          if (commandBusConfig?.retries && bus.setRetries) {
            bus.setRetries(commandBusConfig.retries);
          }

          return bus;
        },
        inject: [NestJSContainerAdapter],
      },
      // Provide interface token pointing to implementation
      {
        provide: commandBusConfig?.interfaceToken || 'ICommandBus',
        useExisting: commandBusToken,
      },
      // Also provide the concrete class if different from token
      ...(commandBusToken !== CommandBus
        ? [
            {
              provide: CommandBus,
              useExisting: commandBusToken,
            },
          ]
        : [])
    );

    // Configure Query Bus
    const queryBusConfig = cqrsConfig?.queryBus;
    const queryBusToken = queryBusConfig?.token || QueryBus;
    const queryBusImplementation = this.resolveImplementation(
      queryBusConfig?.implementation,
      SimpleQueryBus,
      EnhancedQueryBus
    );

    providers.push(
      {
        provide: queryBusToken,
        useFactory: (adapter: NestJSContainerAdapter) => {
          let bus: any;

          // Create instance based on implementation type
          if (typeof queryBusImplementation === 'function') {
            // Check if it's a class constructor or factory function
            if (queryBusImplementation.prototype && queryBusImplementation.prototype.constructor) {
              // Class constructor
              bus = new (queryBusImplementation as any)(adapter);
            } else {
              // Factory function
              bus = (queryBusImplementation as any)(adapter);
            }
          } else {
            // Fallback to SimpleQueryBus
            bus = new SimpleQueryBus(adapter);
          }

          // Apply middleware (bus-specific or global)
          const middleware = queryBusConfig?.middleware || cqrsConfig?.middleware;
          if (middleware && bus.use) {
            this.applyMiddleware(bus, middleware);
          }

          // Apply additional configuration
          if (queryBusConfig?.timeout && bus.setTimeout) {
            bus.setTimeout(queryBusConfig.timeout);
          }
          if (queryBusConfig?.cache && bus.enableCache) {
            bus.enableCache();
          }

          return bus;
        },
        inject: [NestJSContainerAdapter],
      },
      // Provide interface token pointing to implementation
      {
        provide: queryBusConfig?.interfaceToken || 'IQueryBus',
        useExisting: queryBusToken,
      },
      // Also provide the concrete class if different from token
      ...(queryBusToken !== QueryBus
        ? [
            {
              provide: QueryBus,
              useExisting: queryBusToken,
            },
          ]
        : [])
    );

    return providers;
  }

  /**
   * Build Event-specific providers with flexible implementation selection
   */
  private static buildEventProviders(eventsConfig?: any): any[] {
    const providers: any[] = [];

    try {
      // Import event classes
      const { UnifiedEventBus, UniversalEventDispatcher } = require('@vytches/ddd-events');

      // Determine implementation and tokens
      const eventBusImplementation = eventsConfig?.eventBus?.implementation;
      const eventBusToken = eventsConfig?.eventBus?.token || UnifiedEventBus;
      const eventBusInterfaceToken = eventsConfig?.eventBus?.interfaceToken || 'IEventBus';
      const dispatcherImplementation = eventsConfig?.dispatcher?.implementation;
      const dispatcherToken = eventsConfig?.dispatcher?.token || UniversalEventDispatcher;
      const dispatcherInterfaceToken =
        eventsConfig?.dispatcher?.interfaceToken || 'IEventDispatcher';

      // Event Bus Provider
      const actualEventBusClass = eventBusImplementation || UnifiedEventBus;

      // Main provider
      providers.push({
        provide: eventBusToken,
        useClass: actualEventBusClass,
      });

      // Interface token (only if different from main token)
      if (eventBusInterfaceToken && eventBusInterfaceToken !== eventBusToken) {
        providers.push({
          provide: eventBusInterfaceToken,
          useExisting: eventBusToken,
        });
      }

      // Backward compatibility - always provide UnifiedEventBus token if it's not the main token
      if (eventBusToken !== UnifiedEventBus) {
        providers.push({
          provide: UnifiedEventBus,
          useExisting: eventBusToken,
        });
      }

      // Event Dispatcher Provider (if needed)
      if (eventsConfig?.dispatcher?.enabled !== false) {
        // Main dispatcher provider
        providers.push({
          provide: dispatcherToken,
          useFactory: (eventBus: any) => {
            // If custom dispatcher implementation
            if (dispatcherImplementation) {
              if (typeof dispatcherImplementation === 'function') {
                // Check if it's a class constructor or factory
                if (dispatcherImplementation.prototype?.constructor) {
                  return new (dispatcherImplementation as any)(eventBus);
                } else {
                  // Factory function
                  return (dispatcherImplementation as any)(eventBus);
                }
              }
              return dispatcherImplementation; // Instance
            }
            // Default dispatcher
            return new UniversalEventDispatcher(eventBus);
          },
          inject: [eventBusToken], // Inject using the configured token
        });

        // Interface token (only if different from main token)
        if (dispatcherInterfaceToken && dispatcherInterfaceToken !== dispatcherToken) {
          providers.push({
            provide: dispatcherInterfaceToken,
            useExisting: dispatcherToken,
          });
        }

        // Backward compatibility - always provide UniversalEventDispatcher token if it's not the main token
        if (dispatcherToken !== UniversalEventDispatcher) {
          providers.push({
            provide: UniversalEventDispatcher,
            useExisting: dispatcherToken,
          });
        }
      }
    } catch (error) {
      // Events package not installed
      this.logger.debug('Events package not available:', error);
    }

    return providers;
  }

  /**
   * Build ACL-specific providers
   */
  private static buildACLProviders(aclConfig?: any): any[] {
    const providers: any[] = [];

    // ACL Registry provider
    providers.push({
      provide: 'ACL_REGISTRY',
      useFactory: async () => {
        try {
          const { ACLRegistry } = await import('@vytches/ddd-acl');
          const registry = (ACLRegistry as any).getInstance
            ? (ACLRegistry as any).getInstance()
            : new ACLRegistry();

          // Apply configuration if provided
          if (aclConfig?.adapters) {
            for (const [key, adapter] of Object.entries(aclConfig.adapters)) {
              registry.register(key, adapter);
            }
          }

          return registry;
        } catch {
          return null; // ACL package not installed
        }
      },
    });

    // ACL Configuration provider
    if (aclConfig) {
      providers.push({
        provide: 'ACL_CONFIG',
        useValue: aclConfig,
      });
    }

    return providers;
  }

  /**
   * Build Domain Services providers
   */
  private static buildDomainServicesProviders(config?: any): any[] {
    const providers: any[] = [];

    if (config?.services) {
      // Register configured domain services
      for (const service of config.services) {
        providers.push(service);
      }
    }

    return providers;
  }

  /**
   * Build Resilience providers
   */
  private static buildResilienceProviders(config?: any): any[] {
    const providers: any[] = [];

    providers.push({
      provide: 'RESILIENCE_CONFIG',
      useValue: config || {
        circuitBreaker: { failureThreshold: 5, resetTimeout: 60000 },
        retry: { maxAttempts: 3, baseDelay: 1000 },
        bulkhead: { maxConcurrent: 10 },
      },
    });

    return providers;
  }

  /**
   * Build Messaging/Sagas providers
   */
  private static buildMessagingProviders(config?: any): any[] {
    const providers: any[] = [];

    providers.push({
      provide: 'SAGA_ORCHESTRATOR',
      useFactory: async () => {
        try {
          const { SagaOrchestrator, InMemorySagaRepository } = await import(
            '@vytches/ddd-messaging'
          );
          const repository = new InMemorySagaRepository();
          return new SagaOrchestrator(repository, config?.orchestrator || {});
        } catch {
          return null; // Messaging package not installed
        }
      },
    });

    return providers;
  }

  /**
   * Build Policies providers
   */
  private static buildPoliciesProviders(config?: any): any[] {
    const providers: any[] = [];

    providers.push({
      provide: 'POLICY_REGISTRY',
      useFactory: async () => {
        try {
          const { PolicyRegistry } = await import('@vytches/ddd-policies');
          const registry = new PolicyRegistry();

          // Register configured policies
          if (config?.policies) {
            for (const policy of config.policies) {
              registry.register(policy);
            }
          }

          return registry;
        } catch {
          return null; // Policies package not installed
        }
      },
    });

    return providers;
  }

  /**
   * Configure module for async root
   */
  static forRootAsync(options: VytchesDDDAsyncOptions): DynamicModule {
    // Create adapter instance
    this.adapter = new NestJSContainerAdapter();

    const providers = this.createAsyncProviders(options);

    return {
      module: VytchesDDDModule,
      imports: options.imports || [],
      providers: [
        ...providers,
        {
          provide: NestJSContainerAdapter,
          useValue: this.adapter,
        },
        VytchesDiscoveryService,
        // Core services with async options
        {
          provide: CommandBus,
          useFactory: (adapter: NestJSContainerAdapter, opts: VytchesDDDOptions) => {
            const bus = new CommandBus(adapter);
            if (opts.cqrs?.middleware) {
              this.applyMiddleware(bus, opts.cqrs.middleware);
            }
            return bus;
          },
          inject: [NestJSContainerAdapter, VYTCHES_DDD_OPTIONS],
        },
        {
          provide: QueryBus,
          useFactory: (adapter: NestJSContainerAdapter, opts: VytchesDDDOptions) => {
            const bus = new QueryBus(adapter);
            if (opts.cqrs?.middleware) {
              this.applyMiddleware(bus, opts.cqrs.middleware);
            }
            return bus;
          },
          inject: [NestJSContainerAdapter, VYTCHES_DDD_OPTIONS],
        },
        {
          provide: 'UnifiedEventBus',
          useFactory: async () => {
            try {
              const { UnifiedEventBus } = await import('@vytches/ddd-events');
              return new UnifiedEventBus();
            } catch {
              return null;
            }
          },
        },
      ],
      exports: [
        NestJSContainerAdapter,
        CommandBus,
        QueryBus,
        'UnifiedEventBus',
        VYTCHES_DDD_OPTIONS,
      ],
    };
  }

  /**
   * Configure module for specific context with overrides
   */
  static forContext(options: VytchesDDDContextOptions): DynamicModule {
    return {
      module: VytchesDDDModule,
      providers: [
        {
          provide: `CONTEXT_OPTIONS_${options.name}`,
          useValue: options,
        },
        {
          provide: `CONTEXT_ADAPTER_${options.name}`,
          useFactory: (globalAdapter: NestJSContainerAdapter) => {
            // Create context-specific adapter if needed
            if (options.isolated) {
              const contextAdapter = new NestJSContainerAdapter();
              // Configure with context-specific settings
              return contextAdapter;
            }
            // Otherwise use global adapter with context metadata
            return globalAdapter;
          },
          inject: [NestJSContainerAdapter],
        },
      ],
    };
  }

  /**
   * Configure module for feature
   */
  static forFeature(options: VytchesDDDFeatureOptions): DynamicModule {
    const providers: any[] = [];

    // Register services
    if (options.services) {
      options.services.forEach(service => {
        if (typeof service === 'string') {
          // String token - assume it's already registered in VytchesDDD
          providers.push({
            provide: service,
            useFactory: async () => {
              const { VytchesDDD } = await import('@vytches/ddd-di');
              return VytchesDDD.resolve(service);
            },
          });
        } else {
          // Class - register as provider
          providers.push(service);
        }
      });
    }

    // Register handlers
    if (options.handlers) {
      providers.push(...options.handlers);
    }

    // Register event handlers
    if (options.eventHandlers) {
      providers.push(...options.eventHandlers);
    }

    return {
      module: VytchesDDDModule,
      providers,
      exports: providers,
    };
  }

  /**
   * Configure module for testing
   */
  static forTest(options: VytchesDDDTestOptions = {}): DynamicModule {
    const testOptions: VytchesDDDOptions = {
      ...options.overrides,
      autoDiscovery: false, // Disable auto-discovery in tests
    };

    // Create test adapter
    this.adapter = new NestJSContainerAdapter();

    // Register mocks if provided
    if (options.mocks) {
      Object.entries(options.mocks).forEach(([token, mock]) => {
        this.adapter.registerInstance(token, mock);
      });
    }

    return {
      module: VytchesDDDModule,
      providers: [
        {
          provide: VYTCHES_DDD_OPTIONS,
          useValue: testOptions,
        },
        {
          provide: NestJSContainerAdapter,
          useValue: this.adapter,
        },
        {
          provide: CommandBus,
          useFactory: (adapter: NestJSContainerAdapter) => new CommandBus(adapter),
          inject: [NestJSContainerAdapter],
        },
        {
          provide: QueryBus,
          useFactory: (adapter: NestJSContainerAdapter) => new QueryBus(adapter),
          inject: [NestJSContainerAdapter],
        },
        {
          provide: 'UnifiedEventBus',
          useFactory: async () => {
            try {
              const { UnifiedEventBus } = await import('@vytches/ddd-events');
              return new UnifiedEventBus();
            } catch {
              return null;
            }
          },
        },
      ],
      exports: [
        NestJSContainerAdapter,
        CommandBus,
        QueryBus,
        'UnifiedEventBus',
        VYTCHES_DDD_OPTIONS,
      ],
    };
  }

  /**
   * Set up CQRS system
   */
  private async setupCQRS(): Promise<void> {
    if (!this.moduleRef) {
      return;
    }

    try {
      const commandBus = this.moduleRef.get(CommandBus, { strict: false });
      const queryBus = this.moduleRef.get(QueryBus, { strict: false });

      // Register buses in VytchesDDD if available
      if (commandBus) {
        VytchesDDDModule.adapter.registerInstance('commandBus', commandBus);
      }
      if (queryBus) {
        VytchesDDDModule.adapter.registerInstance('queryBus', queryBus);
      }

      // Auto-register handlers if configured
      if (this.options.cqrs?.autoRegisterHandlers) {
        // This will be handled by auto-discovery service
      }
    } catch (error) {
      VytchesDDDModule.logger.debug('Could not get CQRS buses:', error);
      // Continue without CQRS buses
    }
  }

  /**
   * Set up Event system
   */
  private async setupEvents(): Promise<void> {
    if (!this.moduleRef) {
      return;
    }

    try {
      // Dynamic import to avoid lazy-loading issues
      const { UnifiedEventBus } = await import('@vytches/ddd-events');
      const eventBus = this.moduleRef.get(UnifiedEventBus, { strict: false });

      if (eventBus) {
        // Register event bus in VytchesDDD
        VytchesDDDModule.adapter.registerInstance('eventBus', eventBus);
      } else {
        VytchesDDDModule.logger.debug('UnifiedEventBus not available in module context');
      }
    } catch (error) {
      VytchesDDDModule.logger.debug('Could not get UnifiedEventBus:', error);
      // Continue without event bus
    }
  }

  /**
   * Apply middleware to a bus
   */
  private static applyMiddleware(bus: any, middleware: any[]): void {
    middleware.forEach(config => {
      if (typeof config === 'function') {
        // Direct middleware class
        bus.use(new config());
      } else if (config.class) {
        // Middleware with options
        bus.use(new config.class(config.options));
      }
    });
  }

  /**
   * Create async providers
   */
  private static createAsyncProviders(options: VytchesDDDAsyncOptions): any[] {
    if (options.useFactory) {
      return [
        {
          provide: VYTCHES_DDD_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
      ];
    }

    if (options.useClass) {
      return [
        {
          provide: options.useClass,
          useClass: options.useClass,
        },
        {
          provide: VYTCHES_DDD_OPTIONS,
          useFactory: (factory: any) => factory.createVytchesDDDOptions(),
          inject: [options.useClass],
        },
      ];
    }

    if (options.useExisting) {
      return [
        {
          provide: VYTCHES_DDD_OPTIONS,
          useFactory: (factory: any) => factory.createVytchesDDDOptions(),
          inject: [options.useExisting],
        },
      ];
    }

    return [];
  }
}
