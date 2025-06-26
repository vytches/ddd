export enum DefaultActorType {
  USER = 'user',
  SYSTEM = 'system',
  ADMIN = 'admin',
  GUEST = 'guest',
  ORGANIZATION = 'organization',
  TEAM = 'team',
  SERVICE = 'service',
}

export interface IActor {
  type: any;
  source: string;
  id?: string;
  metadata?: Record<string, any>;
}
