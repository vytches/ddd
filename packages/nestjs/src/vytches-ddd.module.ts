import type { DynamicModule } from '@nestjs/common';
import { Global, Module } from '@nestjs/common';
import { DiscoveryService, MetadataScanner } from '@nestjs/core';
import { VytchesExplorerService } from './services/vytches-explorer.service';
import type { VytchesDDDModuleOptions } from './types';

/**
 * VytchesDDD NestJS Integration Module
 * Simple, clean integration following @nestjs/cqrs patterns
 */
@Global()
@Module({})
export class VytchesDDDModule {
  /**
   * Configure VytchesDDD module with custom providers
   *
   * @example
   * ```typescript
   * VytchesDDDModule.forRoot({
   *   providers: [
   *     { provide: ICommandBus, useClass: EnhancedCommandBus },
   *     { provide: IQueryBus, useClass: EnhancedQueryBus },
   *     { provide: IEventBus, useClass: UnifiedEventBus },
   *   ]
   * })
   * ```
   */
  static forRoot(options: VytchesDDDModuleOptions = {}): DynamicModule {
    const providers = [
      // Core NestJS services
      DiscoveryService,
      MetadataScanner,

      // VytchesDDD explorer service (similar to @nestjs/cqrs)
      VytchesExplorerService,

      // User-provided bus implementations
      ...(options.providers || []),
    ];

    const exports = [
      VytchesExplorerService,
      // Export all user-provided tokens
      ...(options.providers?.map(p => ('provide' in p ? p.provide : p)) || []),
    ];

    return {
      module: VytchesDDDModule,
      providers,
      exports,
    };
  }

  /**
   * Simple configuration for testing and basic usage
   */
  static forTesting(): DynamicModule {
    return this.forRoot({
      providers: [
        // Simple implementations for testing
        {
          provide: 'ICommandBus',
          useFactory: async () => {
            const { SimpleContainer } = await import('@vytches/ddd-di');
            const { EnhancedCommandBus } = await import('@vytches/ddd-cqrs');
            const container = new SimpleContainer();
            return new EnhancedCommandBus(container);
          },
        },
        {
          provide: 'IQueryBus',
          useFactory: async () => {
            const { SimpleContainer } = await import('@vytches/ddd-di');
            const { EnhancedQueryBus } = await import('@vytches/ddd-cqrs');
            const container = new SimpleContainer();
            return new EnhancedQueryBus(container);
          },
        },
        {
          provide: 'IEventBus',
          useFactory: async () => {
            const { UnifiedEventBus } = await import('@vytches/ddd-events');
            return new UnifiedEventBus();
          },
        },
      ],
    });
  }
}
