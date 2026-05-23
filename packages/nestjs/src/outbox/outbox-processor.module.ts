import {
  Global,
  Module,
  type DynamicModule,
  type InjectionToken,
  type ModuleMetadata,
  type Provider,
} from '@nestjs/common';
import type {
  IOutboxMessageHandler,
  IOutboxRepository,
  OutboxProcessorOptions,
} from '@vytches/ddd-messaging';
import { OutboxProcessorService } from './outbox-processor.service';

/**
 * One processor instance configured against a repository (and optionally a set
 * of handlers) resolved from the DI container.
 */
export interface OutboxProcessorEntry {
  /** DI token resolving to the {@link IOutboxRepository} this processor reads from. */
  repositoryToken: InjectionToken;
  /** Processor configuration (batch size, backoff, crash recovery, hooks, …). */
  options?: OutboxProcessorOptions;
  /**
   * Optional DI token resolving to a `Record<messageType, IOutboxMessageHandler>`.
   * Each entry is registered on the processor before it starts. Use a map (not a
   * single handler) so one processor can serve several message types without the
   * module needing to know any routing rules.
   */
  handlerToken?: InjectionToken;
  /**
   * Optional DI token under which to expose this processor instance, so it can
   * be injected elsewhere (or asserted in tests). Defaults to a unique symbol.
   */
  processorToken?: InjectionToken;
}

export interface OutboxProcessorModuleAsyncOptions {
  imports?: ModuleMetadata['imports'];
  /** One configuration per processor instance to create. */
  processors: OutboxProcessorEntry[];
  /** Register the module globally (default `true`). */
  isGlobal?: boolean;
}

/**
 * Wires one or more {@link OutboxProcessorService} instances into a NestJS app.
 *
 * **Thin wrapper:** the module only resolves DI tokens and manages lifecycle —
 * no dispatch or routing logic lives here. Each entry yields its own processor
 * instance, so you can run a broad processor alongside specialized ones (e.g. a
 * GDPR-only processor filtered via `options.messageTypes`).
 *
 * @example
 * OutboxProcessorModule.forRootAsync({
 *   processors: [
 *     { repositoryToken: OUTBOX_REPOSITORY, options: { batchSize: 200, adaptiveRepoll: true } },
 *     {
 *       repositoryToken: OUTBOX_REPOSITORY,
 *       options: { messageTypes: ['GdprAuditChainAppend'], batchSize: 50 },
 *       handlerToken: GDPR_OUTBOX_HANDLERS,
 *       processorToken: GDPR_OUTBOX_PROCESSOR,
 *     },
 *   ],
 * });
 */
@Global()
@Module({})
export class OutboxProcessorModule {
  static forRootAsync(options: OutboxProcessorModuleAsyncOptions): DynamicModule {
    const providers: Provider[] = [];
    const exports: InjectionToken[] = [];

    options.processors.forEach((entry, index) => {
      const provide = entry.processorToken ?? Symbol(`OutboxProcessor:${index}`);
      const inject = entry.handlerToken
        ? [entry.repositoryToken, entry.handlerToken]
        : [entry.repositoryToken];

      providers.push({
        provide,
        inject,
        useFactory: (
          repository: IOutboxRepository,
          handlers?: Record<string, IOutboxMessageHandler>
        ): OutboxProcessorService => {
          const processor = new OutboxProcessorService(repository, entry.options);
          if (handlers) {
            for (const [messageType, handler] of Object.entries(handlers)) {
              processor.registerHandler(messageType, handler);
            }
          }
          return processor;
        },
      });

      exports.push(provide);
    });

    return {
      module: OutboxProcessorModule,
      imports: options.imports ?? [],
      providers,
      exports,
      global: options.isGlobal !== false,
    };
  }
}
