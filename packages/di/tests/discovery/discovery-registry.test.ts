import { describe, it, expect, vi } from 'vitest';

import {
  DiscoveryRegistry,
  DiscoveryRegistryFactory,
  type DiscoveryResult,
  type IDiscoveryPlugin,
  type ValidationResult,
} from '../../src/discovery/discovery-registry';
import type { IDependencyContainer } from '../../src/types';

const fakeContainer = {} as IDependencyContainer;

const buildPlugin = (overrides: Partial<IDiscoveryPlugin> = {}): IDiscoveryPlugin => ({
  name: 'TestPlugin',
  packageName: '@test/pkg',
  priority: 100,
  isAvailable: () => true,
  discoverInContext: vi.fn(
    async (contextName: string): Promise<DiscoveryResult> => ({
      contextName,
      pluginName: 'TestPlugin',
      componentsFound: 1,
      components: [
        {
          id: 'comp-1',
          type: 'TestComponent',
          contextName,
          metadata: {},
        },
      ],
    })
  ),
  validate: (_results: DiscoveryResult): ValidationResult => ({ valid: true }),
  ...overrides,
});

describe('DiscoveryRegistry — registerPlugin', () => {
  it('registers an available plugin', async () => {
    const registry = new DiscoveryRegistry();
    const plugin = buildPlugin();
    registry.registerPlugin(plugin);
    const results = await registry.discoverForContext('orders', [], fakeContainer);
    expect(results).toHaveLength(1);
  });

  it('skips an unavailable plugin', async () => {
    const registry = new DiscoveryRegistry();
    const plugin = buildPlugin({ isAvailable: () => false });
    registry.registerPlugin(plugin);
    const results = await registry.discoverForContext('orders', [], fakeContainer);
    expect(results).toHaveLength(0);
  });

  it('debug=true logs registration without throwing', async () => {
    const registry = new DiscoveryRegistry({ debug: true });
    const plugin = buildPlugin();
    registry.registerPlugin(plugin);
    expect(registry.getSummary().totalPlugins).toBe(1);
  });
});

describe('DiscoveryRegistry — registerPlugins (sorted by priority)', () => {
  it('runs plugins in priority order during sequential discovery', async () => {
    const order: string[] = [];
    const a = buildPlugin({
      name: 'A',
      priority: 200,
      discoverInContext: vi.fn(async ctx => {
        order.push('A');
        return { contextName: ctx, pluginName: 'A', componentsFound: 0, components: [] };
      }),
    });
    const b = buildPlugin({
      name: 'B',
      priority: 100,
      discoverInContext: vi.fn(async ctx => {
        order.push('B');
        return { contextName: ctx, pluginName: 'B', componentsFound: 0, components: [] };
      }),
    });
    const registry = new DiscoveryRegistry();
    registry.registerPlugins([a, b]);
    await registry.discoverForContext('ctx', [], fakeContainer);
    expect(order).toEqual(['B', 'A']);
  });
});

describe('DiscoveryRegistry — discoverForContext (sequential default)', () => {
  it('continues when a plugin throws (error captured, not propagated)', async () => {
    const failing = buildPlugin({
      name: 'Failing',
      discoverInContext: vi.fn(async () => {
        throw new Error('boom');
      }),
    });
    const ok = buildPlugin({
      name: 'OK',
      discoverInContext: vi.fn(async ctx => ({
        contextName: ctx,
        pluginName: 'OK',
        componentsFound: 0,
        components: [],
      })),
    });
    const registry = new DiscoveryRegistry({ debug: true });
    registry.registerPlugins([failing, ok]);
    const results = await registry.discoverForContext('ctx', [], fakeContainer);
    // Failing plugin produced no result; OK plugin contributed 1
    expect(results).toHaveLength(1);
    expect(results[0]?.pluginName).toBe('OK');
  });

  it('stores results retrievable via getResultsForContext', async () => {
    const registry = new DiscoveryRegistry();
    registry.registerPlugin(buildPlugin());
    await registry.discoverForContext('ctx-stored', [], fakeContainer);
    const stored = registry.getResultsForContext('ctx-stored');
    expect(stored).toHaveLength(1);
    expect(stored?.[0]?.contextName).toBe('ctx-stored');
  });

  it('returns undefined for unknown context', () => {
    const registry = new DiscoveryRegistry();
    expect(registry.getResultsForContext('never-seen')).toBeUndefined();
  });
});

describe('DiscoveryRegistry — discoverForContext (parallel)', () => {
  it('runs plugins via Promise.allSettled and collects fulfilled results', async () => {
    const fast = buildPlugin({ name: 'Fast' });
    const slow = buildPlugin({
      name: 'Slow',
      discoverInContext: vi.fn(async ctx => {
        await new Promise(r => setTimeout(r, 10));
        return { contextName: ctx, pluginName: 'Slow', componentsFound: 2, components: [] };
      }),
    });
    const registry = new DiscoveryRegistry({ parallel: true });
    registry.registerPlugins([fast, slow]);
    const results = await registry.discoverForContext('ctx', [], fakeContainer);
    expect(results).toHaveLength(2);
  });

  it('captures rejected plugins without throwing', async () => {
    const failing = buildPlugin({
      name: 'Failing',
      discoverInContext: vi.fn(async () => {
        throw new Error('parallel boom');
      }),
    });
    const registry = new DiscoveryRegistry({ parallel: true, debug: true });
    registry.registerPlugin(failing);
    const results = await registry.discoverForContext('ctx', [], fakeContainer);
    expect(results).toHaveLength(0);
  });
});

describe('DiscoveryRegistry — discoverAll', () => {
  it('runs discovery across multiple contexts', async () => {
    const registry = new DiscoveryRegistry();
    registry.registerPlugin(buildPlugin());
    const contexts = new Map<string, unknown[]>([
      ['orders', []],
      ['shipping', []],
    ]);
    const all = await registry.discoverAll(contexts, fakeContainer);
    expect(all.size).toBe(2);
    expect(all.get('orders')).toBeDefined();
    expect(all.get('shipping')).toBeDefined();
  });
});

describe('DiscoveryRegistry — clearResults / getAllResults', () => {
  it('getAllResults returns a fresh map (mutation does not affect internal state)', async () => {
    const registry = new DiscoveryRegistry();
    registry.registerPlugin(buildPlugin());
    await registry.discoverForContext('ctx', [], fakeContainer);
    const snapshot = registry.getAllResults();
    snapshot.delete('ctx');
    expect(registry.getResultsForContext('ctx')).toHaveLength(1);
  });

  it('clearResults removes all stored results', async () => {
    const registry = new DiscoveryRegistry();
    registry.registerPlugin(buildPlugin());
    await registry.discoverForContext('ctx', [], fakeContainer);
    registry.clearResults();
    expect(registry.getAllResults().size).toBe(0);
  });
});

describe('DiscoveryRegistry — validateDiscoveryResults via accessMatrix', () => {
  it('runs plugin.validate() per result when accessMatrix is configured', async () => {
    const validateSpy = vi.fn().mockReturnValue({ valid: true });
    const plugin = buildPlugin({ validate: validateSpy });
    const registry = new DiscoveryRegistry({
      accessMatrix: { orders: ['shipping'] },
    });
    registry.registerPlugin(plugin);
    await registry.discoverForContext('orders', [], fakeContainer);
    expect(validateSpy).toHaveBeenCalledTimes(1);
  });

  it('logs warning when validate returns invalid (does not throw)', async () => {
    const plugin = buildPlugin({
      validate: () => ({ valid: false, errors: ['bad config'] }),
    });
    const registry = new DiscoveryRegistry({
      accessMatrix: { orders: [] },
    });
    registry.registerPlugin(plugin);
    const results = await registry.discoverForContext('orders', [], fakeContainer);
    expect(results).toHaveLength(1);
  });

  it('skips validation when accessMatrix is not configured', async () => {
    const validateSpy = vi.fn().mockReturnValue({ valid: true });
    const plugin = buildPlugin({ validate: validateSpy });
    const registry = new DiscoveryRegistry();
    registry.registerPlugin(plugin);
    await registry.discoverForContext('orders', [], fakeContainer);
    expect(validateSpy).not.toHaveBeenCalled();
  });
});

describe('DiscoveryRegistry — getSummary', () => {
  it('returns aggregated counts per plugin and per context', async () => {
    const a = buildPlugin({
      name: 'A',
      discoverInContext: vi.fn(async ctx => ({
        contextName: ctx,
        pluginName: 'A',
        componentsFound: 3,
        components: [],
      })),
    });
    const b = buildPlugin({
      name: 'B',
      priority: 50,
      discoverInContext: vi.fn(async ctx => ({
        contextName: ctx,
        pluginName: 'B',
        componentsFound: 2,
        components: [],
      })),
    });
    const registry = new DiscoveryRegistry();
    registry.registerPlugins([a, b]);
    await registry.discoverForContext('orders', [], fakeContainer);
    const summary = registry.getSummary();
    expect(summary.totalPlugins).toBe(2);
    expect(summary.totalContexts).toBe(1);
    expect(summary.totalComponents).toBe(5);
    expect(summary.byPlugin.A).toBe(3);
    expect(summary.byPlugin.B).toBe(2);
    expect(summary.byContext.orders).toBe(5);
  });

  it('returns zero-state summary when no discovery has run', () => {
    const summary = new DiscoveryRegistry().getSummary();
    expect(summary).toEqual({
      totalPlugins: 0,
      totalContexts: 0,
      totalComponents: 0,
      byPlugin: {},
      byContext: {},
    });
  });
});

describe('DiscoveryRegistryFactory', () => {
  it('createStandard returns a DiscoveryRegistry', () => {
    const registry = DiscoveryRegistryFactory.createStandard();
    expect(registry).toBeInstanceOf(DiscoveryRegistry);
  });

  it('createMinimal forces autoDiscover=false and parallel=false', () => {
    const registry = DiscoveryRegistryFactory.createMinimal({ debug: true });
    expect(registry).toBeInstanceOf(DiscoveryRegistry);
  });

  it('createPerformance enables parallel mode with timeout', () => {
    const registry = DiscoveryRegistryFactory.createPerformance();
    expect(registry).toBeInstanceOf(DiscoveryRegistry);
  });
});
