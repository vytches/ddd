/**
 * @llm-summary Contract for cqrs validatable functionality
 * @llm-domain Architecture
 * @llm-contract Required
 *
 * @description
 * CqrsValidatable interface implementing architectural component for cqrs validatable operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteCqrsValidatable implements ICqrsValidatable {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface ICqrsValidatable {
  validate?(): Promise<void> | void;
}
