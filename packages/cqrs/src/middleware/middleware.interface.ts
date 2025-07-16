/**
 * @llm-summary Contract for c q r s middleware functionality
 * @llm-domain Architecture
 * @llm-contract Required
 *
 * @description
 * CQRSMiddleware interface implementing architectural component for c q r s middleware operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteCQRSMiddleware implements ICQRSMiddleware {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface ICQRSMiddleware {
  handle(context: ExecutionContext, next: () => Promise<unknown>): Promise<unknown>;
}

/**
 * @llm-summary Contract for execution context functionality
 * @llm-domain Architecture
 * @llm-contract Required
 *
 * @description
 * ExecutionContext interface implementing architectural component for execution context operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteExecutionContext implements ExecutionContext {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface ExecutionContext {
  readonly commandOrQuery: unknown;
  readonly handler: unknown;
  readonly type: 'command' | 'query';
  readonly metadata: Map<string, unknown>;
}
