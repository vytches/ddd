/**
 * Optional capability for buses that hold background resources (timers,
 * open handles) that must be explicitly released on application shutdown.
 *
 * Implemented by {@link EnhancedQueryBus} and {@link EnhancedCommandBus}.
 *
 * Typical call site: `onModuleDestroy` / `afterAll` in tests.
 *
 * @example
 * ```ts
 * if ('dispose' in bus) (bus as IDisposableBus).dispose();
 * ```
 */
export interface IDisposableBus {
  /**
   * Releases all background resources (cache-cleanup intervals, batch timers,
   * etc.) held by this bus instance. After `dispose()` the bus must not be
   * used; create a new instance instead.
   *
   * For handler eviction without full teardown, use {@link IResettableBus.reset}.
   */
  dispose(): void;
}
