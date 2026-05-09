import type { Capability, CapabilityConstructor } from './capability-base';

/**
 * Type-safe registry of {@link Capability} instances keyed by their
 * `static capabilityType` discriminator. Used internally by `AggregateRoot`
 * (and projections) to store attached capabilities; rarely instantiated
 * directly by domain code.
 *
 * Two lookup styles:
 *
 * - **By constructor** (`get(CapabilityClass)`) — preferred. Type-safe,
 *   readable, returns the precise capability subclass type.
 * - **By type string** (`getByType('snapshot')`) — useful when the
 *   capability identity is dynamic (e.g. plugin-registered).
 *
 * Optional generic `TCapabilities` provides compile-time type narrowing
 * for `getByType()` when you know the registry's full key→capability
 * shape upfront.
 *
 * @example Using the registry inside an aggregate
 * ```typescript
 * import { CapabilityRegistry } from '@vytches/ddd-contracts';
 * import { SnapshotCapability } from '@vytches/ddd-aggregates';
 *
 * const registry = new CapabilityRegistry();
 * registry.register(new SnapshotCapability());
 * registry.has(SnapshotCapability);   // true
 * registry.get(SnapshotCapability);   // SnapshotCapability instance
 * registry.getTypes();                 // ['snapshot']
 * ```
 *
 * @example Typed access (knows the keys upfront)
 * ```typescript
 * type Caps = {
 *   snapshot: SnapshotCapability;
 *   audit: AuditCapability;
 * };
 * const r = new CapabilityRegistry<Caps>();
 * const snap = r.getByType('snapshot');  // typed as SnapshotCapability | undefined
 * ```
 *
 * @public
 * @stable
 * @since 0.1.0
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

export function createCapabilityRegistry<
  T extends Record<string, Capability>,
>(): CapabilityRegistry<T> {
  return new CapabilityRegistry<T>();
}
