import type { DynamicModule, OnModuleInit } from '@nestjs/common';
import { Global, Inject, Module } from '@nestjs/common';
import type { ModuleRef } from '@nestjs/core';
import { CommandBus, QueryBus } from '@vytches/ddd-cqrs';
// VytchesDDD will be lazy-loaded
import { UnifiedEventBus } from '@vytches/ddd-events';
import { NestJSContainerAdapter } from './adapters/nestjs-container.adapter';
import { VYTCHES_DDD_OPTIONS } from './constants';
import { AutoDiscoveryService } from './discovery/auto-discovery.service';
import type {
  VytchesDDDAsyncOptions,
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
    private readonly moduleRef: ModuleRef,
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

    // Set up CQRS if configured
    if (this.options.cqrs) {
      await this.setupCQRS();
    }

    // Set up Events if configured
    if (this.options.events) {
      await this.setupEvents();
    }

    // Run auto-discovery if enabled
    if (this.options.autoDiscovery) {
      const discoveryService = new AutoDiscoveryService(
        VytchesDDDModule.adapter,
        this.options.autoDiscovery === true ? {} : this.options.autoDiscovery
      );
      await discoveryService.discover();
    }
  }

  /**
   * Configure module for root
   */
  static forRoot(options: VytchesDDDOptions = {}): DynamicModule {
    // Create adapter instance
    this.adapter = new NestJSContainerAdapter();

    return {
      module: VytchesDDDModule,
      providers: [
        {
          provide: VYTCHES_DDD_OPTIONS,
          useValue: options,
        },
        {
          provide: NestJSContainerAdapter,
          useValue: this.adapter,
        },
        AutoDiscoveryService,
        // Register core services
        {
          provide: CommandBus,
          useFactory: (adapter: NestJSContainerAdapter) => {
            const bus = new CommandBus(adapter);
            // Apply middleware if configured
            if (options.cqrs?.middleware) {
              this.applyMiddleware(bus, options.cqrs.middleware);
            }
            return bus;
          },
          inject: [NestJSContainerAdapter],
        },
        {
          provide: QueryBus,
          useFactory: (adapter: NestJSContainerAdapter) => {
            const bus = new QueryBus(adapter);
            // Apply middleware if configured
            if (options.cqrs?.middleware) {
              this.applyMiddleware(bus, options.cqrs.middleware);
            }
            return bus;
          },
          inject: [NestJSContainerAdapter],
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
