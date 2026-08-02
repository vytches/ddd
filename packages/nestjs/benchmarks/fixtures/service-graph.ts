/**
 * Service-graph fixture for NestJSContainerAdapter benchmarks (VP-006b / D-4).
 *
 * Builds an adapter with N registered class-token services arranged in
 * constructor-injection CHAINS of realistic depth (3-5 levels by default):
 *
 *   Svc_c_0  ←  Svc_c_1  ←  ...  ←  Svc_c_{d-1}   (chain root)
 *
 * `design:paramtypes` metadata is defined manually (bench files run without
 * decorator transforms emitting metadata), exactly like the adapter's unit
 * tests do. Tokens are the class constructors themselves — reference-keyed
 * per VF-030 D1/ADR-0038.
 *
 * Also provides the shared measurement helpers:
 *   - withNodeEnv:               toggle the dev-only divergence guard on/off
 *   - withReflectMetadataCounter: count Reflect.getMetadata invocations
 *   - heapUsedKB:                GC-hinted heap snapshot (as in di benchmarks)
 *
 * Dev-only bench fixture — never part of the published surface.
 */
import 'reflect-metadata';
import type { ModuleRef } from '@nestjs/core';
import type { Constructor } from '@vytches/ddd-di';
import type { ServiceLifetime } from '@vytches/ddd-di';
import { NestJSContainerAdapter } from '../../src/adapters/nestjs-container.adapter';
import { CountingModuleRef } from './counting-module-ref';

export interface ServiceGraphFixture {
  readonly adapter: NestJSContainerAdapter;
  readonly moduleRef: CountingModuleRef;
  /** Chain heads — resolving each root touches its whole chain. */
  readonly roots: readonly Constructor<unknown>[];
  /** Every registered class, leaf-to-root order per chain. */
  readonly classes: readonly Constructor<unknown>[];
}

export interface ServiceGraphOptions {
  /** Total number of services to register (chains are cut to fit exactly). */
  readonly serviceCount: number;
  readonly lifetime: ServiceLifetime;
  /** Chain depths, cycled per chain. Default: [3, 4, 5]. */
  readonly depths?: readonly number[];
}

const DEFAULT_DEPTHS: readonly number[] = [3, 4, 5];

/**
 * Create one bench service class. Each class takes its single dependency
 * (the previous chain link) via constructor injection; leaves take none.
 */
function makeServiceClass(name: string, dep?: Constructor<unknown>): Constructor<unknown> {
  const cls = class {
    readonly dep: unknown;

    constructor(dep?: unknown) {
      this.dep = dep;
    }
  };
  Object.defineProperty(cls, 'name', { value: name });
  Reflect.defineMetadata('design:paramtypes', dep ? [dep] : [], cls);
  return cls as Constructor<unknown>;
}

/**
 * Build a FRESH adapter + counting ModuleRef with `serviceCount` services.
 * Classes are created fresh on every call, so the module-level lazy
 * paramtypes cache (VP-006b D-1) is guaranteed COLD for this fixture.
 */
export function buildServiceGraph(options: ServiceGraphOptions): ServiceGraphFixture {
  const depths = options.depths ?? DEFAULT_DEPTHS;
  const moduleRef = new CountingModuleRef();
  const adapter = new NestJSContainerAdapter(moduleRef as unknown as ModuleRef);

  const roots: Constructor<unknown>[] = [];
  const classes: Constructor<unknown>[] = [];

  let created = 0;
  let chainIndex = 0;
  while (created < options.serviceCount) {
    const targetDepth = depths[chainIndex % depths.length] ?? DEFAULT_DEPTHS[0]!;
    const depth = Math.min(targetDepth, options.serviceCount - created);

    let previous: Constructor<unknown> | undefined;
    for (let level = 0; level < depth; level++) {
      const cls = makeServiceClass(`BenchSvc_${chainIndex}_${level}`, previous);
      adapter.register(cls, cls as Constructor<unknown>, { lifetime: options.lifetime });
      classes.push(cls);
      previous = cls;
      created += 1;
    }
    // Last link of the chain depends on everything below it → the root.
    roots.push(previous!);
    chainIndex += 1;
  }

  return { adapter, moduleRef, roots, classes };
}

/**
 * Run `fn` with NODE_ENV forced to `value`, restoring the previous value
 * afterwards. Used to toggle the adapter's dev-only dual-registration
 * divergence guard (skipped entirely when NODE_ENV === 'production').
 */
export function withNodeEnv<T>(value: string, fn: () => T): T {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = value;
  try {
    return fn();
  } finally {
    if (previous === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previous;
    }
  }
}

/**
 * Wrap Reflect.getMetadata with an invocation counter for the duration of
 * `fn`; always restores the original. The counter is the PRIMARY metric for
 * the lazy-once reflection cache (VP-006b D-1): cold resolves should read
 * metadata exactly once per constructor, warm resolves exactly zero times.
 */
export function withReflectMetadataCounter<T>(fn: (getCount: () => number) => T): T {
  type ReflectGetMetadata = (metadataKey: unknown, target: object) => unknown;
  const reflect = Reflect as typeof Reflect & { getMetadata: ReflectGetMetadata };
  const original = reflect.getMetadata;
  let count = 0;
  reflect.getMetadata = ((metadataKey: unknown, target: object): unknown => {
    count += 1;
    return original.call(Reflect, metadataKey, target);
  }) as ReflectGetMetadata;
  try {
    return fn(() => count);
  } finally {
    reflect.getMetadata = original;
  }
}

/**
 * GC-hinted heap snapshot in KB (same approach as packages/di/benchmarks):
 * forces a cycle when the runtime exposes gc (--expose-gc), otherwise a
 * best-effort process.memoryUsage() read.
 */
export function heapUsedKB(): number {
  if (typeof globalThis.gc === 'function') {
    globalThis.gc();
  }
  return process.memoryUsage().heapUsed / 1024;
}
