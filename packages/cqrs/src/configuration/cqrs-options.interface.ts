/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ICQRSMiddleware } from '../middleware';

/**
 * @llm-summary Contract for c q r s options functionality
 * @llm-domain Architecture
 * @llm-contract Required
 *
 * @description
 * CQRSOptions interface implementing architectural component for c q r s options operations.
 *
 * @example
 * ```typescript
 * // Implementation example
 * class ConcreteCQRSOptions implements CQRSOptions {
 *   // Implementation
 * }
 * ```
 *
 * @since 1.0.0
 * @public
 */
export interface CQRSOptions {
  commandBusType?: 'basic' | 'enhanced';
  queryBusType?: 'basic' | 'enhanced';
  /** @deprecated Use DI container auto-discovery instead */
  autoDiscovery?: boolean;
  middlewares?: ICQRSMiddleware[];
}
