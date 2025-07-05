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
  type: string | DefaultActorType;
  source: string;
  id?: string;
  metadata?: Record<string, unknown>;
}
