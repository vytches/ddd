import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import {
  OutboxProcessor,
  type IOutboxRepository,
  type OutboxProcessorOptions,
} from '@vytches/ddd-messaging';

/**
 * NestJS-managed {@link OutboxProcessor}. A thin lifecycle wrapper — all
 * dispatch, retry and crash-recovery logic lives in the base class. The
 * processor is started on `onModuleInit` and stopped on `onModuleDestroy`.
 *
 * Instances are created per entry by {@link OutboxProcessorModule.forRootAsync}
 * via a factory (the repository and options come from per-entry DI tokens), so
 * this class is not registered as a class provider directly.
 */
@Injectable()
export class OutboxProcessorService
  extends OutboxProcessor
  implements OnModuleInit, OnModuleDestroy
{
  constructor(repository: IOutboxRepository, options?: OutboxProcessorOptions) {
    super(repository, options);
  }

  onModuleInit(): void {
    this.start();
  }

  onModuleDestroy(): void {
    this.stop();
  }
}
