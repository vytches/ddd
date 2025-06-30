/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ICQRSMiddleware } from '../middleware';

export interface CQRSOptions {
  commandBusType?: 'basic' | 'enhanced';
  queryBusType?: 'basic' | 'enhanced';
  handlerResolver?: (handlerClass: any) => any;
  autoDiscovery?: boolean;
  middlewares?: ICQRSMiddleware[];
}
