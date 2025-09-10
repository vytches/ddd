// Utility functions for NestJS adapter

/**
 * Create a NestJS provider from a VytchesDDD service
 */
export function createProvider(serviceId: string) {
  return {
    provide: serviceId,
    useFactory: async () => {
      const { VytchesDDD } = await import('@vytches/ddd-di');
      return VytchesDDD.resolve(serviceId);
    },
  };
}

/**
 * Create multiple providers from service IDs
 */
export function createProviders(serviceIds: string[]) {
  return serviceIds.map(createProvider);
}

/**
 * Helper to check if a value is a class constructor
 */
export function isConstructor(value: unknown): boolean {
  return typeof value === 'function' && value.prototype;
}

/**
 * Helper to get metadata from a class
 */
export function getMetadata(key: string | symbol, target: unknown): unknown {
  return Reflect.getMetadata(key, target);
}

/**
 * Helper to set metadata on a class
 */
export function setMetadata(key: string | symbol, value: unknown, target: unknown): void {
  Reflect.defineMetadata(key, value, target);
}
