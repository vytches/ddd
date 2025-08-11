/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ICQRSMiddleware } from '../middleware';

export interface CQRSOptions {
  commandBusType?: 'basic' | 'enhanced';
  queryBusType?: 'basic' | 'enhanced';
  /** @deprecated Use DI container auto-discovery instead */
  autoDiscovery?: boolean;
  middlewares?: ICQRSMiddleware[];
}
