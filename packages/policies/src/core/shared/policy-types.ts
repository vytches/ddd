/**
 * Shared types for policies to avoid circular dependencies
 */

export interface PolicyContext {
  /**
   * User ID performing the operation
   */
  readonly userId: string;

  /**
   * Optional tenant ID for multi-tenant applications
   */
  readonly tenantId?: string;

  /**
   * Optional session ID for request correlation
   */
  readonly sessionId?: string;

  /**
   * Timestamp when evaluation was requested
   */
  readonly timestamp: Date;

  /**
   * Environment where evaluation is happening (dev, staging, prod)
   */
  readonly environment: string;

  /**
   * Feature flags or toggles affecting policy behavior
   */
  readonly features: Record<string, boolean>;

  /**
   * Additional metadata for extensibility
   */
  readonly metadata: Record<string, unknown>;
}
