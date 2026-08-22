/**
 * Counting stub ModuleRef (VP-006b / D-4).
 *
 * Bench-only stand-in for `@nestjs/core` ModuleRef that records every
 * `get()` invocation and every not-found throw, so benchmarks can report
 * COUNT-based primary metrics: how many times the adapter touched the
 * NestJS container (and how many of those touches ended in the throwing
 * miss path) per resolve scenario.
 *
 * Mirrors the observable contract of the real ModuleRef.get used by
 * NestJSContainerAdapter: returns the provider when known, THROWS when the
 * token is not resolvable (ModuleRef has no non-throwing get variant).
 *
 * NOT exported from the package barrel — dev-only bench fixture, excluded
 * from the published surface (package.json "files").
 */

export interface ModuleRefCallCounts {
  /** Total ModuleRef.get invocations observed. */
  readonly get: number;
  /** Subset of invocations that ended in the throwing not-found path. */
  readonly throws: number;
}

export class CountingModuleRef {
  private readonly nestProviders = new Map<unknown, unknown>();
  private getCallCount = 0;
  private throwCount = 0;

  /** Seed a provider on the "NestJS side" of the bridge. */
  addProvider(token: unknown, instance: unknown): void {
    this.nestProviders.set(token, instance);
  }

  /** Same call shape the adapter uses: moduleRef.get(token, { strict: false }). */
  get<T = unknown>(token: unknown, _options?: { strict?: boolean }): T {
    this.getCallCount += 1;
    if (this.nestProviders.has(token)) {
      return this.nestProviders.get(token) as T;
    }
    this.throwCount += 1;
    throw new Error(
      `CountingModuleRef: no provider for token ${String(
        typeof token === 'function' ? (token as { name?: string }).name : token
      )}`
    );
  }

  /** Immutable snapshot of the counters. */
  get counts(): ModuleRefCallCounts {
    return { get: this.getCallCount, throws: this.throwCount };
  }

  reset(): void {
    this.getCallCount = 0;
    this.throwCount = 0;
  }
}
