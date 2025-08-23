import type { DynamicModule, OnModuleInit, Type } from '@nestjs/common';
import { Global, Inject, Module } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { CommandBus, QueryBus } from '@vytches/ddd-cqrs';
// VytchesDDD will be lazy-loaded
import { UnifiedEventBus } from '@vytches/ddd-events';
import { NestJSContainerAdapter } from './adapters/nestjs-container.adapter';
import { VYTCHES_DDD_OPTIONS } from './constants';
import { AutoDiscoveryService } from './discovery/auto-discovery.service';
import { EnhancedDiscoveryService } from './discovery/enhanced-discovery.service';
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

  constructor(
    @Inject(ModuleRef) private readonly moduleRef: ModuleRef,
    @Inject(VYTCHES_DDD_OPTIONS) private readonly options: VytchesDDDOptions
  ) {}

  /**
   * Initialize VytchesDDD on module init
   */
  async onModuleInit(): Promise<void> {
    // Set up the adapter with ModuleRef
    if (VytchesDDDModule.adapter) {
      VytchesDDDModule.adapter.setModuleRef(this.moduleRef);
    } else {
      VytchesDDDModule.adapter = new NestJSContainerAdapter(this.moduleRef);
    }

    // Configure VytchesDDD with our adapter (lazy-loaded)
    const { VytchesDDD } = await import('@vytches/ddd-di');
    await VytchesDDD.configure(VytchesDDDModule.adapter);

    // Set up CQRS if configured (before discovery so buses are available)
    if (this.options.cqrs) {
      await this.setupCQRS();
    }

    // Set up Events if configured (before discovery so bus is available)
    if (this.options.events) {
      await this.setupEvents();
    }

    // Check if this is zero-config mode (no options or empty options)
    const isZeroConfig =
      !this.options ||
      Object.keys(this.options).length === 0 ||
      (Object.keys(this.options).length === 1 && this.options.discovery?.enabled);

    if (isZeroConfig) {
      // Zero-config mode: use enhanced discovery
      const enhancedDiscovery = new EnhancedDiscoveryService(
        VytchesDDDModule.adapter,
        this.moduleRef
      );
      await enhancedDiscovery.discoverAll();
    } else if (this.options.discovery?.enabled) {
      // Plugin-based discovery for advanced configuration
      await this.setupPluginDiscovery();
    } else if (this.options.autoDiscovery) {
      // Legacy auto-discovery (backward compatibility)
      const discoveryService = new AutoDiscoveryService(
        VytchesDDDModule.adapter,
        this.options.autoDiscovery === true ? {} : this.options.autoDiscovery
      );
      await discoveryService.discover();
    }
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
      // Zero-config: enable auto-discovery with all features
      return {
        discovery: {
          enabled: true,
          parallel: true,
          debug: false,
        },
        cqrs: {
          autoRegisterHandlers: true,
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
          enabled: true,
          parallel: true,
        },
      };
    }

    // Handle empty object - same as zero-config
    if (Object.keys(options).length === 0) {
      return {
        discovery: {
          enabled: true,
          parallel: true,
          debug: false,
        },
        cqrs: {
          autoRegisterHandlers: true,
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
          enabled: true,
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

    // Build providers based on features
    const providers = this.buildProviders(normalizedOptions);

    // Detect which features are enabled
    const detectedFeatures = this.detectInstalledPackages();
    const enabledFeatures = normalizedOptions.features || detectedFeatures;

    // Build exports based on what's actually provided
    const exports: any[] = [NestJSContainerAdapter, VYTCHES_DDD_OPTIONS];

    // Only export services that were actually provided
    if (enabledFeatures.includes('cqrs') || normalizedOptions.cqrs) {
      exports.push(CommandBus, QueryBus);
    }
    if (enabledFeatures.includes('events') || normalizedOptions.events) {
      exports.push(UnifiedEventBus);
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
      AutoDiscoveryService,
    ];

    // Detect which packages are installed and add their providers
    const detectedFeatures = this.detectInstalledPackages();
    const enabledFeatures = options.features || detectedFeatures;

    // Add CQRS providers if enabled
    if (enabledFeatures.includes('cqrs') || options.cqrs) {
      providers.push(...this.buildCQRSProviders(options.cqrs));
    }

    // Add Events providers if enabled
    if (enabledFeatures.includes('events') || options.events) {
      providers.push({
        provide: UnifiedEventBus,
        useFactory: () => new UnifiedEventBus(),
      });
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
        provide: 'ICommandBus',
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
        provide: 'IQueryBus',
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
        AutoDiscoveryService,
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
          provide: UnifiedEventBus,
          useFactory: () => new UnifiedEventBus(),
        },
      ],
      exports: [NestJSContainerAdapter, CommandBus, QueryBus, UnifiedEventBus, VYTCHES_DDD_OPTIONS],
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
          provide: UnifiedEventBus,
          useValue: new UnifiedEventBus(),
        },
      ],
      exports: [NestJSContainerAdapter, CommandBus, QueryBus, UnifiedEventBus, VYTCHES_DDD_OPTIONS],
    };
  }

  /**
   * Set up CQRS system
   */
  private async setupCQRS(): Promise<void> {
    if (!this.moduleRef) {
      return;
    }

    const commandBus = this.moduleRef.get(CommandBus, { strict: false });
    const queryBus = this.moduleRef.get(QueryBus, { strict: false });

    // Register buses in VytchesDDD
    VytchesDDDModule.adapter.registerInstance('commandBus', commandBus);
    VytchesDDDModule.adapter.registerInstance('queryBus', queryBus);

    // Auto-register handlers if configured
    if (this.options.cqrs?.autoRegisterHandlers) {
      // This will be handled by auto-discovery service
    }
  }

  /**
   * Set up Event system
   */
  private async setupEvents(): Promise<void> {
    if (!this.moduleRef) {
      return;
    }

    const eventBus = this.moduleRef.get(UnifiedEventBus, { strict: false });

    // Register event bus in VytchesDDD
    VytchesDDDModule.adapter.registerInstance('eventBus', eventBus);
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
