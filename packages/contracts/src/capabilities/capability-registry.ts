import type { Capability, CapabilityConstructor, CapabilityType } from './capability-base';

/**
 * Type-safe capability registry
 * Provides compile-time type safety for capability operations
 */
export class CapabilityRegistry<
  TCapabilities extends Record<string, Capability> = Record<string, Capability>,
> {
  private readonly capabilities = new Map<string, Capability>();

  /**
   * Register a capability
   */
  register<T extends Capability>(capability: T): this {
    this.capabilities.set(capability.type, capability);
    return this;
  }

  /**
   * Get a capability by its constructor
   */
  get<T extends Capability>(CapabilityClass: CapabilityConstructor<T>): T | undefined {
    // Use static capabilityType getter to avoid temporary instance creation
    const capabilityType = CapabilityClass.capabilityType;
    return this.capabilities.get(capabilityType) as T | undefined;
  }

  /**
   * Get a capability by its type string
   */
  getByType<K extends keyof TCapabilities>(type: K): TCapabilities[K] | undefined {
    return this.capabilities.get(type as string) as TCapabilities[K] | undefined;
  }

  /**
   * Check if a capability exists
   */
  has<T extends Capability>(CapabilityClass: CapabilityConstructor<T>): boolean {
    // Use static capabilityType getter to avoid temporary instance creation
    const capabilityType = CapabilityClass.capabilityType;
    return this.capabilities.has(capabilityType);
  }

  /**
   * Check if a capability exists by type
   */
  hasByType(type: string): boolean {
    return this.capabilities.has(type);
  }

  /**
   * Remove a capability
   */
  remove<T extends Capability>(CapabilityClass: CapabilityConstructor<T>): boolean {
    // Use static capabilityType getter to avoid temporary instance creation
    const capabilityType = CapabilityClass.capabilityType;
    return this.capabilities.delete(capabilityType);
  }

  /**
   * Remove a capability by type
   */
  removeByType(type: string): boolean {
    return this.capabilities.delete(type);
  }

  /**
   * Get all registered capabilities
   */
  getAll(): Capability[] {
    return Array.from(this.capabilities.values());
  }

  /**
   * Get all capability types
   */
  getTypes(): string[] {
    return Array.from(this.capabilities.keys());
  }

  /**
   * Clear all capabilities
   */
  clear(): void {
    this.capabilities.clear();
  }

  /**
   * Get the number of registered capabilities
   */
  get size(): number {
    return this.capabilities.size;
  }
}

/**
 * Create a typed capability registry
 */
export function createCapabilityRegistry<
  T extends Record<string, Capability>,
>(): CapabilityRegistry<T> {
  return new CapabilityRegistry<T>();
}
