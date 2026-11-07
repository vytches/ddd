import { describe, expect, it } from 'vitest';
import { RECOMMENDED_RULES, rules } from '../../../src/rules';
import { configs, meta, plugin } from '../../../src/configs/plugin';

describe('plugin object', () => {
  it('exposes meta, rules and configs in the shape flat config expects', () => {
    expect(Object.keys(plugin).sort()).toEqual(['configs', 'meta', 'rules']);
    expect(plugin.rules).toBe(rules);
    expect(plugin.configs).toBe(configs);
    expect(plugin.meta).toBe(meta);
    expect(meta.namespace).toBe('ddd');
    expect(meta.name).toBe('@vytches/eslint-plugin-ddd');
    expect(meta.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('is frozen so consumers cannot mutate the shared preset', () => {
    expect(Object.isFrozen(plugin)).toBe(true);
    expect(Object.isFrozen(configs)).toBe(true);
    expect(Object.isFrozen(configs.recommended)).toBe(true);
    expect(Object.isFrozen(configs.recommended.rules)).toBe(true);
  });
});

describe('configs.recommended', () => {
  it('registers the plugin under the ddd namespace and points at the named plugin export', () => {
    expect(configs.recommended.plugins?.['ddd']).toBe(plugin);
  });

  it('enables exactly the catalog entries marked recommended, prefixed with ddd/', () => {
    const expected = Object.fromEntries(
      Object.entries(RECOMMENDED_RULES).map(([name, severity]) => [`ddd/${name}`, severity])
    );
    expect(configs.recommended.rules).toEqual(expected);
  });

  it('keeps opt-in rules out and every enabled rule exists in the plugin', () => {
    const enabled = Object.keys(configs.recommended.rules ?? {});
    expect(enabled).not.toContain('ddd/policy-builder-required-calls');
    expect(enabled).not.toContain('ddd/no-new-entity-id');
    for (const id of enabled) expect(rules).toHaveProperty(id.replace('ddd/', ''));
  });

  it('sets no parser, files or settings, so it composes with the project config', () => {
    expect(configs.recommended.languageOptions).toBeUndefined();
    expect(configs.recommended.files).toBeUndefined();
    expect(configs.recommended.settings).toBeUndefined();
  });
});
