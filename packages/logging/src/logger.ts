import type { Logger, LogProvider, LoggerConfiguration, LogLevel, LogContext } from './core';
import { isLogLevelEnabled, DefaultLogContextBuilder, DefaultLogEventBuilder } from './core';
import { ConsoleProvider } from './providers/console-provider';
import { ContextDetector } from './utils/context-detector';
import { DataMasker } from './utils/data-masker';

/**
 * @llm-summary DefaultLogger class for default logger operations
 * @llm-domain Infrastructure
 * @llm-complexity Medium
 *
 * @description
 * DefaultLogger class implementing infrastructure service for default logger operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new DefaultLogger();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export class DefaultLogger implements Logger {
  private static globalConfig: LoggerConfiguration = {
    level: 'info',
    provider: 'console',
    contextDetection: { enabled: true },
    formatting: { colorize: true, prettyPrint: true },
    masking: { enabled: true, patterns: [], replacement: '[MASKED]' },
  };

  private static globalProvider: LogProvider | null = null;
  private static dataMasker: DataMasker | null = null;

  readonly context: LogContext;
  readonly level: LogLevel;
  private readonly provider: LogProvider;
  private readonly masker: DataMasker;

  constructor(context: LogContext, config?: Partial<LoggerConfiguration>) {
    const mergedConfig = { ...DefaultLogger.globalConfig, ...config };

    this.context = context;
    this.level = mergedConfig.level!;
    this.provider = this.resolveProvider(mergedConfig.provider!);
    this.masker = this.resolveMasker(mergedConfig.masking!);
  }

  static configure(config: LoggerConfiguration): void {
    DefaultLogger.globalConfig = { ...DefaultLogger.globalConfig, ...config };
    DefaultLogger.globalProvider = null; // Reset cached provider
    DefaultLogger.dataMasker = null; // Reset cached masker
  }

  static create(contextName?: string): Logger {
    if (contextName) {
      const context = new DefaultLogContextBuilder(contextName).build();
      return new DefaultLogger(context);
    }

    if (DefaultLogger.globalConfig.contextDetection?.enabled) {
      const detected = ContextDetector.detectContext();
      const context = new DefaultLogContextBuilder(detected.contextName)
        .withBoundedContext(detected.boundedContext || '')
        .build();
      return new DefaultLogger(context);
    }

    const context = new DefaultLogContextBuilder('Application').build();
    return new DefaultLogger(context);
  }

  static forContext(contextName?: string): Logger {
    return DefaultLogger.create(contextName);
  }

  trace(message: string, data?: Record<string, unknown>): void {
    this.log('trace', message, data);
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, data);
  }

  error(message: string, error?: Error, data?: Record<string, unknown>): void {
    this.log('error', message, data, error);
  }

  fatal(message: string, error?: Error, data?: Record<string, unknown>): void {
    this.log('fatal', message, data, error);
  }

  log(level: LogLevel, message: string, data?: Record<string, unknown>, error?: Error): void {
    if (!this.isLevelEnabled(level)) {
      return;
    }

    const maskedData = data ? (this.masker.maskData(data) as Record<string, unknown>) : undefined;

    const eventBuilder = new DefaultLogEventBuilder(level, message, this.context);

    if (maskedData) {
      eventBuilder.withData(maskedData);
    }

    if (error) {
      eventBuilder.withError(error);
    }

    const event = eventBuilder.build();

    this.provider.write(event);
  }

  isLevelEnabled(level: LogLevel): boolean {
    return isLogLevelEnabled(level, this.level);
  }

  child(contextName: string): Logger {
    const childContext = new DefaultLogContextBuilder(contextName)
      .withBoundedContext(this.context.boundedContext || '')
      .withCorrelationId(this.context.correlationId || '')
      .withUserId(this.context.userId || '')
      .withTenantId(this.context.tenantId || '')
      .withRequestId(this.context.requestId || '')
      .withSessionId(this.context.sessionId || '')
      .withMetadata(this.context.metadata || {})
      .build();

    return new DefaultLogger(childContext);
  }

  withContext(context: Partial<LogContext>): Logger {
    const newContext = new DefaultLogContextBuilder(this.context.name)
      .withBoundedContext(context.boundedContext || this.context.boundedContext || '')
      .withCorrelationId(context.correlationId || this.context.correlationId || '')
      .withUserId(context.userId || this.context.userId || '')
      .withTenantId(context.tenantId || this.context.tenantId || '')
      .withRequestId(context.requestId || this.context.requestId || '')
      .withSessionId(context.sessionId || this.context.sessionId || '')
      .withMetadata({
        ...this.context.metadata,
        ...context.metadata,
      })
      .build();

    return new DefaultLogger(newContext);
  }

  withCorrelationId(correlationId: string): Logger {
    return this.withContext({ correlationId });
  }

  withUserId(userId: string): Logger {
    return this.withContext({ userId });
  }

  withTenantId(tenantId: string): Logger {
    return this.withContext({ tenantId });
  }

  private resolveProvider(provider: LogProvider | 'console'): LogProvider {
    if (typeof provider === 'string') {
      if (provider === 'console') {
        if (!DefaultLogger.globalProvider) {
          const formattingConfig = DefaultLogger.globalConfig.formatting;
          DefaultLogger.globalProvider = new ConsoleProvider({
            colorize: formattingConfig?.colorize ?? true,
            prettyPrint: formattingConfig?.prettyPrint ?? true,
          });
        }
        return DefaultLogger.globalProvider;
      }
      throw new Error(`Unknown provider: ${provider}`);
    }

    return provider;
  }

  private resolveMasker(maskingConfig: NonNullable<LoggerConfiguration['masking']>): DataMasker {
    if (!DefaultLogger.dataMasker) {
      DefaultLogger.dataMasker = new DataMasker(maskingConfig);
    }
    return DefaultLogger.dataMasker;
  }
}
