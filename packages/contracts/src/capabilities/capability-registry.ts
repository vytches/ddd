import type { Capability, CapabilityConstructor, CapabilityType } from './capability-base';

/**
 * @llm-summary CapabilityRegistry class for capability registry operations
 * @llm-domain Core
 * @llm-complexity Simple
 *
 * @description
 * CapabilityRegistry class implementing core domain functionality for capability registry operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new CapabilityRegistry();
 * ```
 * *
 * @since 1.0.0
 * @public
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
 * @llm-summary create capability registry function
 * @llm-domain Core
 * @llm-pure false
 *
 * @description
 * createCapabilityRegistry function implementing core domain functionality for create capability registry operations.
 *
 * @returns {CapabilityRegistry<T>} Returns CapabilityRegistry<T>
 * @throws {Error} When validation fails
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = createCapabilityRegistry();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export function createCapabilityRegistry<
  T extends Record<string, Capability>,
>(): CapabilityRegistry<T> {
  return new CapabilityRegistry<T>();
}
