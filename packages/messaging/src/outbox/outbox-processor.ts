import type { IEventBus } from '@vytches/ddd-contracts';
import { Logger } from '@vytches/ddd-logging';
import { safeRun } from '@vytches/ddd-utils';
import type { IOutboxMessage, IOutboxMessageHandler, OutboxMiddleware } from './outbox-interfaces';
import { MessagePriority, MessageStatus } from './outbox-interfaces';
import type { IOutboxRepository } from './outbox-repository.interface';

export interface OutboxProcessorOptions {
  /** Maximum number of messages to process in one batch */
  batchSize?: number;
  /** Maximum retry attempts for failed messages */
  maxRetries?: number;
  /** Processing interval in milliseconds */
  processingInterval?: number;
  /** Priority order for message processing */
  priorityOrder?: MessagePriority[];
  /** Timeout for processing a single message */
  messageTimeout?: number;
  /** Enable logging */
  enableLogging?: boolean;
}

export class OutboxProcessor {
  private readonly repository: IOutboxRepository;
  private readonly options: Required<OutboxProcessorOptions>;
  private readonly handlers = new Map<string, IOutboxMessageHandler>();
  private readonly middlewares: OutboxMiddleware[] = [];
  private isRunning = false;
  private processingTimer?: NodeJS.Timeout | undefined;
  private readonly logger = Logger.create('OutboxProcessor');

  constructor(repository: IOutboxRepository, options: OutboxProcessorOptions = {}) {
    this.repository = repository;
    this.options = {
      batchSize: options.batchSize ?? 10,
      maxRetries: options.maxRetries ?? 3,
      processingInterval: options.processingInterval ?? 5000,
      priorityOrder: options.priorityOrder ?? [
        MessagePriority.CRITICAL,
        MessagePriority.HIGH,
        MessagePriority.NORMAL,
        MessagePriority.LOW,
      ],
      messageTimeout: options.messageTimeout ?? 30000,
      enableLogging: options.enableLogging ?? false,
    };
  }

  /**
   * Registers a message handler for a specific message type
   */
  registerHandler(messageType: string, handler: IOutboxMessageHandler): void {
    this.handlers.set(messageType, handler);
    this.logger.debug(`Registered handler for message type: ${messageType}`);
  }

  /**
   * Registers middleware for message processing pipeline
   */
  use(middleware: OutboxMiddleware): void {
    this.middlewares.push(middleware);
    this.logger.debug('Registered middleware');
  }

  /**
   * Starts the processor with automatic interval processing
   */
  start(): void {
    if (this.isRunning) {
      this.logger.warn('Processor is already running');
      return;
    }

    this.isRunning = true;
    this.logger.info('Starting outbox processor');
    this.scheduleProcessing();
  }

  /**
   * Stops the processor
   */
  stop(): void {
    if (!this.isRunning) {
      this.logger.warn('Processor is not running');
      return;
    }

    this.isRunning = false;
    if (this.processingTimer) {
      clearTimeout(this.processingTimer);
      this.processingTimer = undefined;
    }
    this.logger.info('Stopped outbox processor');
  }

  /**
   * Processes a single batch of pending messages
   */
  async processBatch(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    const [result, error] = await safeRun(() =>
      this.repository.getUnprocessedMessages(this.options.batchSize, this.options.priorityOrder)
    );

    if (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error retrieving messages: ${errorMessage}`);
      return;
    }

    const messages = result;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      this.logger.debug('No pending messages to process');
      return;
    }

    this.logger.info(`Processing ${messages.length} messages`);

    // Process messages in parallel within the batch
    const processingPromises = messages.map(message => this.processMessage(message));

    await Promise.allSettled(processingPromises);
    this.logger.info(`Completed processing batch of ${messages.length} messages`);
  }

  /**
   * Processes a single message through the middleware pipeline
   */
  private async processMessage(message: IOutboxMessage): Promise<void> {
    const [error] = await safeRun(async () => {
      // Mark as processing
      await this.repository.updateStatus(message.id, MessageStatus.PROCESSING);

      // Build middleware pipeline
      const pipeline = this.buildPipeline(message);
      await pipeline(message);

      // Mark as processed
      await this.repository.updateStatus(message.id, MessageStatus.PROCESSED);
      this.logger.debug(`Successfully processed message ${message.id}`);
    });

    if (error) {
      await this.handleMessageError(message, error);
    }
  }

  /**
   * Builds the middleware pipeline for message processing
   */
  private buildPipeline(message: IOutboxMessage): (msg: IOutboxMessage) => Promise<void> {
    const handler = this.handlers.get(message.messageType);
    if (!handler) {
      throw new Error(`No handler registered for message type: ${message.messageType}`);
    }

    // Create the final handler function
    const finalHandler = async (msg: IOutboxMessage): Promise<void> => {
      await Promise.race([
        handler.handle(msg),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Message processing timeout')),
            this.options.messageTimeout
          )
        ),
      ]);
    };

    // Build the middleware chain from right to left
    return this.middlewares.reduceRight((next, middleware) => middleware(next), finalHandler);
  }

  /**
   * Handles errors during message processing
   */
  private async handleMessageError(message: IOutboxMessage, error: Error): Promise<void> {
    try {
      const attempts = await this.repository.incrementAttempt(message.id);
      this.logger.warn(`Message ${message.id} failed, attempt ${attempts}: ${error?.message}`);

      if (attempts >= this.options.maxRetries) {
        await this.repository.updateStatus(message.id, MessageStatus.FAILED, error);
        this.logger.error(`Message ${message.id} marked as failed after ${attempts} attempts`);
      } else {
        // Reset to pending for retry
        await this.repository.updateStatus(message.id, MessageStatus.PENDING);
        this.logger.info(`Message ${message.id} scheduled for retry (attempt ${attempts + 1})`);
      }
    } catch (updateError) {
      const errorMessage = updateError instanceof Error ? updateError.message : String(updateError);
      this.logger.error(`Error updating message status: ${errorMessage}`);
    }
  }

  /**
   * Schedules the next processing cycle
   */
  private scheduleProcessing(): void {
    if (!this.isRunning) {
      return;
    }

    this.processingTimer = setTimeout(async () => {
      await this.processBatch();
      this.scheduleProcessing();
    }, this.options.processingInterval);
  }

  /**
   * Logs messages if logging is enabled
   */
  private log(message: string): void {
    if (this.options.enableLogging) {
      this.logger.info(message);
    }
  }

  /**
   * Gets processor statistics
   */
  async getStats(): Promise<{
    isRunning: boolean;
    batchSize: number;
    maxRetries: number;
    processingInterval: number;
    registeredHandlers: string[];
    middlewareCount: number;
  }> {
    return {
      isRunning: this.isRunning,
      batchSize: this.options.batchSize,
      maxRetries: this.options.maxRetries,
      processingInterval: this.options.processingInterval,
      registeredHandlers: Array.from(this.handlers.keys()),
      middlewareCount: this.middlewares.length,
    };
  }
}

export class EventBusOutboxHandler implements IOutboxMessageHandler {
  constructor(private readonly eventBus: IEventBus) {}

  async handle(message: IOutboxMessage): Promise<void> {
    // Extract event name from message type (remove integration_event: prefix if present)
    const eventName = message.messageType.startsWith('integration_event:')
      ? message.messageType.replace('integration_event:', '')
      : message.messageType;

    const eventData = {
      eventName,
      eventId: message.id,
      occurredOn: message.createdAt,
      version: 1,
      ...(message.payload as Record<string, unknown>),
      ...message.metadata,
    };

    await this.eventBus.publish(eventData);
  }
}
