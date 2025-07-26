import type { Result } from '@vytches/ddd-utils';

/**
 * @llm-summary TypedOperation class for typed operation operations
 * @llm-domain Integration
 * @llm-complexity Medium
 *
 * @description
 * TypedOperation class implementing integration layer component for typed operation operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new TypedOperation();
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const [error, instance] = safeRun(() => new TypedOperation());
 * if (error) {
 *   console.error('Creation failed:', error.message);
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export abstract class TypedOperation<TInput, _TOutput> {
  abstract readonly name: string;
  readonly description?: string;

  validateBusinessRules?(input: TInput): Result<void, Error>;
}

/**
 * @llm-summary Contract for typed operation registry functionality
 * @llm-domain Integration
 * @llm-contract Required
 *
 * @description
 * TypedOperationRegistry interface implementing integration layer component for typed operation registry operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteTypedOperationRegistry implements ITypedOperationRegistry {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface ITypedOperationRegistry {
  register<TInput, TOutput>(operation: TypedOperation<TInput, TOutput>): void;
  get<TInput, TOutput>(operationName: string): TypedOperation<TInput, TOutput> | undefined;
}
