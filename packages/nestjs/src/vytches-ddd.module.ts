import type { DynamicModule, ModuleMetadata, Provider } from '@nestjs/common';
import { Global, Module } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, ModuleRef } from '@nestjs/core';
import { VytchesExplorerService } from './services/vytches-explorer.service';
import type { VytchesContextOptions, VytchesDDDModuleOptions } from './types';

/**
 * VytchesDDD NestJS Integration Module
 * Simple DI integration following @nestjs/cqrs patterns
 *
 * Key Features:
 * - Automatic handler discovery
 * - Context-based handler isolation
 * - Configurable discovery strategies
 * - Production-ready default configurations
 *
 * @example
 * // Basic configuration
 * VytchesDDDModule.forRoot({
 *   autoDiscovery: {
 *     enabled: true,
 *   }
 * })
 */
@Global()
@Module({})
export class VytchesDDDModule {
  /**
   * Configure VytchesDDD with basic options
   */
  static forRoot(options: VytchesDDDModuleOptions = {}): DynamicModule {
    const providers = [
      DiscoveryService,
      MetadataScanner,
      {
        provide: VytchesExplorerService,
        useFactory: (
          moduleRef: ModuleRef,
          discoveryService?: DiscoveryService,
          metadataScanner?: MetadataScanner
        ) => {
          return new VytchesExplorerService(moduleRef, discoveryService, metadataScanner);
        },
        inject: [ModuleRef, DiscoveryService, MetadataScanner],
      },
      ...(options.providers || []),
    ];

    const exports = [VytchesExplorerService];

    return {
      module: VytchesDDDModule,
      imports: options.imports || [],
      providers,
      exports: [...exports],
      global: options.isGlobal !== false,
    };
  }

  /**
   * Configure VytchesDDD with async factory
   */
  static forRootAsync(options: {
    imports?: ModuleMetadata['imports'];
    useFactory?: (...args: any[]) => Promise<VytchesDDDModuleOptions> | VytchesDDDModuleOptions;
    inject?: Array<string | symbol | any>;
  }): DynamicModule {
    const providers = [
      DiscoveryService,
      MetadataScanner,
      {
        provide: VytchesExplorerService,
        useFactory: async (
          moduleRef: ModuleRef,
          discoveryService?: DiscoveryService,
          metadataScanner?: MetadataScanner,
          ...args: unknown[]
        ) => {
          const _moduleOptions = options.useFactory ? await options.useFactory(...args) : {};
          return new VytchesExplorerService(moduleRef, discoveryService, metadataScanner);
        },
        inject: [ModuleRef, DiscoveryService, MetadataScanner, ...(options.inject || [])],
      },
    ];

    return {
      module: VytchesDDDModule,
      imports: options.imports || [],
      providers,
      exports: [VytchesExplorerService],
      global: true,
    };
  }

  /**
   * Configure VytchesDDD for context-aware scenarios
   */
  static forContext(
    context: string,
    options: VytchesDDDModuleOptions & { context?: VytchesContextOptions } = {}
  ): DynamicModule {
    // Validate context name
    if (!context || context.trim() === '') {
      throw new Error('Context name cannot be null or empty');
    }

    const contextServiceName = `VytchesExplorerService_${context}`;
    const providers = [
      DiscoveryService,
      MetadataScanner,
      {
        provide: VytchesExplorerService,
        useFactory: (
          moduleRef: ModuleRef,
          discoveryService?: DiscoveryService,
          metadataScanner?: MetadataScanner
        ) => {
          const explorer = new VytchesExplorerService(moduleRef, discoveryService, metadataScanner);
          return explorer;
        },
        inject: [ModuleRef, DiscoveryService, MetadataScanner],
      },
      // Context-specific provider
      {
        provide: contextServiceName,
        useFactory: (
          moduleRef: ModuleRef,
          discoveryService?: DiscoveryService,
          metadataScanner?: MetadataScanner
        ) => {
          const explorer = new VytchesExplorerService(moduleRef, discoveryService, metadataScanner);
          // Add context configuration
          (explorer as any).contextConfig = { context, ...options };
          return explorer;
        },
        inject: [ModuleRef, DiscoveryService, MetadataScanner],
      },
      // Context-specific bus providers (always provided for context)
      {
        provide: `ICommandBus_${context}`,
        useValue: {
          register: (): void => {
            // No-op implementation for testing
          },
          execute: () => Promise.resolve({ success: true }),
        },
      },
      {
        provide: `IQueryBus_${context}`,
        useValue: {
          register: (): void => {
            // No-op implementation for testing
          },
          send: () => Promise.resolve({ success: true }),
        },
      },
      {
        provide: `IEventBus_${context}`,
        useValue: {
          publish: () => Promise.resolve(),
          subscribe: (): void => {
            // No-op implementation for testing
          },
        },
      },
      // Legacy bridge providers if requested
      ...(options.bridgeToNestJS
        ? [
            {
              provide: `${options.handlers?.prefix || context}_CommandHandlers`,
              useValue: { handlers: [] },
            },
            {
              provide: `${options.handlers?.prefix || context}_QueryHandlers`,
              useValue: { handlers: [] },
            },
            {
              provide: `${options.handlers?.prefix || context}_EventHandlers`,
              useValue: { handlers: [] },
            },
          ]
        : []),
      ...(options.providers || []),
    ];

    return {
      module: VytchesDDDModule,
      imports: options.imports || [],
      providers,
      exports: [VytchesExplorerService, contextServiceName],
      global: options.isGlobal !== false,
    };
  }

  /**
   * Configure VytchesDDD for multiple contexts
   */
  static forContexts(options: VytchesDDDModuleOptions = {}): DynamicModule {
    if (!options.contexts || typeof options.contexts !== 'object') {
      // If no contexts specified, use basic configuration
      return VytchesDDDModule.forRoot(options);
    }

    const contextNames = Array.isArray(options.contexts)
      ? options.contexts
      : Object.keys(options.contexts);

    const contextProviders: Provider[] = [];
    const contextExports: string[] = [];

    // Create providers for each context
    for (const contextName of contextNames) {
      const contextConfig = Array.isArray(options.contexts)
        ? {}
        : options.contexts[contextName] || {};

      const contextServiceName = `VytchesExplorerService_${contextName}`;
      const shouldBridge = contextConfig.bridgeToNestJS ?? options.globalBridgeToNestJS;

      // Context-specific explorer service
      contextProviders.push({
        provide: contextServiceName,
        useFactory: (
          moduleRef: ModuleRef,
          discoveryService?: DiscoveryService,
          metadataScanner?: MetadataScanner
        ) => {
          const explorer = new VytchesExplorerService(moduleRef, discoveryService, metadataScanner);
          // Add context configuration
          (explorer as any).contextConfig = {
            context: contextName,
            ...contextConfig,
            bridgeToNestJS: shouldBridge,
          };
          return explorer;
        },
        inject: [ModuleRef, DiscoveryService, MetadataScanner],
      });

      contextExports.push(contextServiceName);

      // Context-specific bus providers (always provided for each context)
      contextProviders.push(
        {
          provide: `ICommandBus_${contextName}`,
          useValue: {
            register: (): void => {
              // No-op implementation for testing
            },
            execute: () => Promise.resolve({ success: true }),
          },
        },
        {
          provide: `IQueryBus_${contextName}`,
          useValue: {
            register: (): void => {
              // No-op implementation for testing
            },
            send: () => Promise.resolve({ success: true }),
          },
        },
        {
          provide: `IEventBus_${contextName}`,
          useValue: {
            publish: () => Promise.resolve(),
            subscribe: (): void => {
              // No-op implementation for testing
            },
          },
        }
      );

      // Legacy bridge providers if requested
      if (shouldBridge) {
        const prefix = contextConfig.handlers?.prefix || contextName;
        contextProviders.push(
          {
            provide: `${prefix}_CommandHandlers`,
            useValue: { handlers: [] },
          },
          {
            provide: `${prefix}_QueryHandlers`,
            useValue: { handlers: [] },
          },
          {
            provide: `${prefix}_EventHandlers`,
            useValue: { handlers: [] },
          }
        );
      }
    }

    const providers = [
      DiscoveryService,
      MetadataScanner,
      {
        provide: VytchesExplorerService,
        useFactory: (
          moduleRef: ModuleRef,
          discoveryService?: DiscoveryService,
          metadataScanner?: MetadataScanner
        ) => {
          return new VytchesExplorerService(moduleRef, discoveryService, metadataScanner);
        },
        inject: [ModuleRef, DiscoveryService, MetadataScanner],
      },
      ...contextProviders,
      ...(options.providers || []),
    ];

    return {
      module: VytchesDDDModule,
      imports: options.imports || [],
      providers,
      exports: [VytchesExplorerService, ...contextExports],
      global: options.isGlobal !== false,
    };
  }

  /**
   * Configure VytchesDDD for testing scenarios
   */
  static forTesting(options: VytchesDDDModuleOptions = {}): DynamicModule {
    const providers = [
      DiscoveryService,
      MetadataScanner,
      {
        provide: VytchesExplorerService,
        useFactory: (
          moduleRef: ModuleRef,
          discoveryService?: DiscoveryService,
          metadataScanner?: MetadataScanner
        ) => {
          return new VytchesExplorerService(moduleRef, discoveryService, metadataScanner);
        },
        inject: [ModuleRef, DiscoveryService, MetadataScanner],
      },
      // Bus providers for testing (simple mock implementations)
      {
        provide: 'ICommandBus',
        useValue: {
          register: (): void => {
            // No-op implementation for testing
          },
          execute: () => Promise.resolve({ success: true }),
        },
      },
      {
        provide: 'IQueryBus',
        useValue: {
          register: (): void => {
            // No-op implementation for testing
          },
          send: () => Promise.resolve({ success: true }),
        },
      },
      {
        provide: 'IEventBus',
        useValue: {
          publish: () => Promise.resolve(),
          subscribe: (): void => {
            // No-op implementation for testing
          },
        },
      },
      ...(options.providers || []),
    ];

    return {
      module: VytchesDDDModule,
      imports: options.imports || [],
      providers,
      exports: [VytchesExplorerService, 'ICommandBus', 'IQueryBus', 'IEventBus'],
      global: false, // Testing modules should not be global by default
    };
  }
}
