/**
 * @llm-summary Enumeration of default actor type values
 * @llm-domain Core
 * @llm-usage Frequent
 *
 * @description
 * DefaultActorType enum implementing core domain functionality for default actor type operations.
 *
 * @example
 * ```typescript
 * // Usage example
 * const value: DefaultActorType = DefaultActorType.VALUE;
 * ```
 *
 * @since 1.0.0
 * @public
 */
export enum DefaultActorType {
  USER = 'user',
  SYSTEM = 'system',
  ADMIN = 'admin',
  GUEST = 'guest',
  ORGANIZATION = 'organization',
  TEAM = 'team',
  SERVICE = 'service',
}

/**
 * @llm-summary Contract for actor functionality
 * @llm-domain Core
 * @llm-contract Required
 *
 * @description
 * Actor interface implementing core domain functionality for actor operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteActor implements IActor {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface IActor {
  type: string | DefaultActorType;
  source: string;
  id?: string;
  metadata?: Record<string, unknown>;
}
