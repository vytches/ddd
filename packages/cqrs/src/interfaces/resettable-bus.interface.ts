/**
 * Optional capability for buses that can evict all registered handlers and
 * caches, returning the bus to a clean, freshly-constructed state.
 *
 * Implemented by {@link EnhancedQueryBus} and {@link EnhancedCommandBus}.
 *
 * The primary use case is integration/E2E test isolation: when a single bus
 * instance is shared across sequentially-created DI modules (e.g. multiple
 * `Test.createTestingModule()` calls in one Node process), handler factories
 * registered against a now-destroyed DI scope become stale. Calling `reset()`
 * on module teardown evicts those registrations so the next module starts
 * clean.
 *
 * Consumers can duck-type check for support: `if ('reset' in bus) bus.reset()`.
 */
export interface IResettableBus {
  /**
   * Evicts all registered handlers (instances and factories) and any internal
   * caches. Does not stop background timers — use `dispose()` for full teardown.
   */
  reset(): void;
}
