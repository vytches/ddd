import type { DynamicModule, ModuleMetadata, Provider } from '@nestjs/common';
import { Global, Module } from '@nestjs/common';
import { DiscoveryModule, DiscoveryService, ModuleRef } from '@nestjs/core';
// eslint-disable-next-line @nx/enforce-module-boundaries -- Required for DI tokens in forTesting()
import { ICommandBus, IQueryBus } from '@vytches/ddd-cqrs';
import { VytchesExplorerService } from './services/vytches-explorer.service';
import type { VytchesContextOptions, VytchesDDDModuleOptions } from './types';

/**
 * VytchesDDD NestJS Integration Module
 * Simple DI integration following @nestjs/cqrs patterns
 *
 * Key Features:
 * - Automatic handler discovery using NestJS DiscoveryService
 * - Direct registration with CQRS buses (ICommandBus, IQueryBus)
 * - Context-based handler isolation
 * - Production-ready default configurations
 *
 * @example
 * // Basic configuration - buses auto-injected if provided
 * VytchesDDDModule.forRoot()
 *
 * @example
 * // With CQRS buses in providers
 * @Module({
 *   imports: [VytchesDDDModule.forRoot()],
 *   providers: [
 *     { provide: ICommandBus, useValue: new EnhancedCommandBus(container) },
 *     { provide: IQueryBus, useValue: new EnhancedQueryBus(container) },
 *   ],
 * })
 */
@Global()
@Module({})
export class VytchesDDDModule {
  static forRoot(options: VytchesDDDModuleOptions = {}): DynamicModule {
    const providers: Provider[] = [VytchesExplorerService, ...(options.providers || [])];

    return {
      module: VytchesDDDModule,
      imports: [DiscoveryModule, ...(options.imports || [])],
      providers,
      exports: [VytchesExplorerService],
      global: options.isGlobal !== false,
    };
  }

  static forRootAsync(options: {
    imports?: ModuleMetadata['imports'];
    useFactory?: (...args: unknown[]) => Promise<VytchesDDDModuleOptions> | VytchesDDDModuleOptions;
    inject?: Array<string | symbol | unknown>;
  }): DynamicModule {
    return {
      module: VytchesDDDModule,
      imports: [DiscoveryModule, ...(options.imports || [])],
      providers: [VytchesExplorerService],
      exports: [VytchesExplorerService],
      global: true,
    };
  }

  static forContext(
    context: string,
    options: VytchesDDDModuleOptions & { context?: VytchesContextOptions } = {}
  ): DynamicModule {
    if (!context || context.trim() === '') {
      throw new Error('Context name cannot be null or empty');
    }

    const contextServiceName = `VytchesExplorerService_${context}`;

    const providers: Provider[] = [
      VytchesExplorerService,
      {
        provide: contextServiceName,
        useFactory: (moduleRef: ModuleRef, discoveryService: DiscoveryService) => {
          const explorer = new VytchesExplorerService(moduleRef, discoveryService);
          (explorer as unknown as { contextConfig: unknown }).contextConfig = {
            context,
            ...options,
          };
          return explorer;
        },
        inject: [ModuleRef, DiscoveryService],
      },
      ...(options.providers || []),
    ];

    return {
      module: VytchesDDDModule,
      imports: [DiscoveryModule, ...(options.imports || [])],
      providers,
      exports: [VytchesExplorerService, contextServiceName],
      global: options.isGlobal !== false,
    };
  }

  static forContexts(options: VytchesDDDModuleOptions = {}): DynamicModule {
    if (!options.contexts || typeof options.contexts !== 'object') {
      return VytchesDDDModule.forRoot(options);
    }

    const ctxNames = Array.isArray(options.contexts)
      ? options.contexts
      : Object.keys(options.contexts);

    const contextProviders: Provider[] = [];
    const contextExports: string[] = [];

    for (const contextName of ctxNames) {
      const contextConfig = Array.isArray(options.contexts)
        ? {}
        : options.contexts[contextName] || {};

      const contextServiceName = `VytchesExplorerService_${contextName}`;

      contextProviders.push({
        provide: contextServiceName,
        useFactory: (moduleRef: ModuleRef, discoveryService: DiscoveryService) => {
          const explorer = new VytchesExplorerService(moduleRef, discoveryService);
          (explorer as unknown as { contextConfig: unknown }).contextConfig = {
            context: contextName,
            ...contextConfig,
          };
          return explorer;
        },
        inject: [ModuleRef, DiscoveryService],
      });

      contextExports.push(contextServiceName);
    }

    const providers: Provider[] = [
      VytchesExplorerService,
      ...contextProviders,
      ...(options.providers || []),
    ];

    return {
      module: VytchesDDDModule,
      imports: [DiscoveryModule, ...(options.imports || [])],
      providers,
      exports: [VytchesExplorerService, ...contextExports],
      global: options.isGlobal !== false,
    };
  }

  static forTesting(options: VytchesDDDModuleOptions = {}): DynamicModule {
    const providers: Provider[] = [
      VytchesExplorerService,
      {
        provide: ICommandBus,
        useValue: {
          register: (): void => {
            /* noop */
          },
          registerFactory: (): void => {
            /* noop */
          },
          execute: () => Promise.resolve({ success: true }),
        },
      },
      {
        provide: IQueryBus,
        useValue: {
          register: (): void => {
            /* noop */
          },
          registerFactory: (): void => {
            /* noop */
          },
          send: () => Promise.resolve({ success: true }),
        },
      },
      ...(options.providers || []),
    ];

    return {
      module: VytchesDDDModule,
      imports: [DiscoveryModule, ...(options.imports || [])],
      providers,
      exports: [VytchesExplorerService, ICommandBus, IQueryBus],
      global: false,
    };
  }
}
