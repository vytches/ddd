// Public API contract of @vytches/eslint-plugin-ddd (VF-043 D4, D14; LT1, LT2, LT3).
//
// Pins what a consumer depends on: the runtime exports of both entry points, the rule names,
// the severities of `configs.recommended`, the keys of `settings.ddd`, the role names, the
// `exports` map of package.json and the type signatures of every exported symbol. Any change
// here is a public API change: update the expectation on purpose, never to make a build pass.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as agent from '../src/agent';
import * as root from '../src';
import { describePublicApi } from './contract/helpers/public-signatures';

const { configs, DddConfigError, meta, parseSettings, plugin, rules, SETTINGS_KEY } = root;

const PACKAGE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const EXPECTED_DIR = resolve(PACKAGE_DIR, 'tests', 'contract', 'expected');

/**
 * Compares rendered declarations with the committed expectation, line by line. After an
 * intentional public API change a human regenerates it with `DDD_UPDATE_API_SURFACE=1` and
 * reviews the diff; the test never rewrites it on its own (and agents must not).
 */
function expectSurface(name: 'root' | 'agent', lines: readonly string[]): void {
  const file = resolve(EXPECTED_DIR, `${name}.api.txt`);
  if (process.env['DDD_UPDATE_API_SURFACE'] === '1') writeFileSync(file, `${lines.join('\n')}\n`);
  expect(lines).toEqual(readFileSync(file, 'utf8').trimEnd().split('\n'));
}

const pkg = JSON.parse(readFileSync(resolve(PACKAGE_DIR, 'package.json'), 'utf8')) as {
  name: string;
  version: string;
  private?: boolean;
  exports: Record<string, unknown>;
  dependencies: Record<string, string>;
  peerDependencies: Record<string, string>;
  peerDependenciesMeta: Record<string, { optional?: boolean }>;
};

describe('@vytches/eslint-plugin-ddd public API surface', () => {
  it('exports the documented runtime symbols of the root entry', () => {
    expect(Object.keys(root).sort()).toEqual(
      [
        'DddConfigError',
        'SETTINGS_KEY',
        'configs',
        'createRoleResolver',
        'createSettingsResolver',
        'meta',
        'parseSettings',
        'plugin',
        'resolveRole',
        'resolverFromSettings',
        'roleScoped',
        'roleConfigFromSettings',
        'rules',
        'validateRoleConfig',
      ].sort()
    );
  });

  it('exports the documented runtime symbols of the /agent entry', () => {
    expect(Object.keys(agent).sort()).toEqual([
      'createAgentLinter',
      'isAgentSeverity',
      'isLintConfigError',
      'isLintOk',
      'isLintParseError',
      'isLintSkipped',
      'newFindings',
    ]);
  });

  it('has no default export and keeps lintText out of the root entry', () => {
    expect('default' in root).toBe(false);
    expect('default' in agent).toBe(false);
    expect('createAgentLinter' in root).toBe(false);
  });

  it('exposes every export as the type its documentation promises', () => {
    for (const name of [
      'createRoleResolver',
      'createSettingsResolver',
      'parseSettings',
      'resolveRole',
      'roleConfigFromSettings',
      'roleScoped',
      'validateRoleConfig',
    ]) {
      expect(typeof (root as Record<string, unknown>)[name], name).toBe('function');
    }
    expect(typeof DddConfigError).toBe('function');
    expect(SETTINGS_KEY).toBe('ddd');
    expect(typeof root.resolverFromSettings.reset).toBe('function');
  });
});

describe('plugin object', () => {
  it('is { meta, rules, configs } as flat config expects', () => {
    expect(Object.keys(plugin).sort()).toEqual(['configs', 'meta', 'rules']);
    expect(plugin.rules).toBe(rules);
    expect(plugin.configs).toBe(configs);
    expect(plugin.meta).toBe(meta);
  });

  it('describes itself with the published name, a semver version and the ddd namespace', () => {
    expect(meta).toEqual({ name: pkg.name, version: pkg.version, namespace: 'ddd' });
    expect(pkg.name).toBe('@vytches/eslint-plugin-ddd');
    expect(meta.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('ships exactly the documented rules, each with docs and a message contract', () => {
    expect(Object.keys(rules).sort()).toEqual([
      'event-handler-requires-handle',
      'no-deprecated-entity-id-factories',
      'no-instanceof-result',
      'no-internal-imports',
      'no-new-entity-id',
      'policy-builder-required-calls',
    ]);
    for (const [name, rule] of Object.entries(rules)) {
      expect(rule.meta?.docs?.url, `${name}: docs url`).toContain(name);
      expect(rule.meta?.messages, `${name}: messages`).toBeTypeOf('object');
      expect(rule.meta?.schema, `${name}: schema`).toBeDefined();
    }
  });

  it('is immutable, so a consumer cannot change the shared preset', () => {
    expect(Object.isFrozen(plugin)).toBe(true);
    expect(Object.isFrozen(rules)).toBe(true);
    expect(Object.isFrozen(configs)).toBe(true);
    expect(Object.isFrozen(configs.recommended)).toBe(true);
    expect(Object.isFrozen(configs.recommended.rules)).toBe(true);
  });
});

describe('configs.recommended', () => {
  it('enables the documented rules at the documented severity', () => {
    expect(configs.recommended.rules).toEqual({
      'ddd/event-handler-requires-handle': 'error',
      'ddd/no-deprecated-entity-id-factories': 'warn',
      'ddd/no-instanceof-result': 'error',
      'ddd/no-internal-imports': 'error',
    });
  });

  it('keeps opt-in rules out of the preset', () => {
    expect(configs.recommended.rules).not.toHaveProperty('ddd/no-new-entity-id');
    expect(configs.recommended.rules).not.toHaveProperty('ddd/policy-builder-required-calls');
  });

  it('refers to the named plugin export and sets nothing of the project own setup', () => {
    expect(configs.recommended.plugins?.['ddd']).toBe(plugin);
    expect(Object.keys(configs.recommended).sort()).toEqual(['name', 'plugins', 'rules']);
    expect(configs.recommended.name).toBe('ddd/recommended');
  });

  it('only enables rules that exist', () => {
    for (const id of Object.keys(configs.recommended.rules ?? {})) {
      expect(Object.keys(rules), id).toContain(id.replace(/^ddd\//, ''));
    }
  });
});

describe('settings.ddd', () => {
  it('accepts exactly these keys', () => {
    const all = { bindings: [], tsconfig: 'tsconfig.json', includeLibraryRoles: true, maxDepth: 6 };
    expect(parseSettings(all)).toEqual(all);
    expect(parseSettings({ tsconfig: false })).toEqual({ tsconfig: false });
    expect(parseSettings(undefined)).toEqual({});
  });

  it('rejects an unknown key and names the allowed ones', () => {
    let thrown: unknown;
    try {
      parseSettings({ bindings: [], sneaky: true });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(DddConfigError);
    expect((thrown as Error).message).toContain(
      'Allowed: bindings, tsconfig, includeLibraryRoles, maxDepth.'
    );
  });

  it('accepts exactly these binding keys', () => {
    let thrown: unknown;
    try {
      parseSettings({ bindings: [{ role: 'Aggregate', sneaky: true }] });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(DddConfigError);
    expect((thrown as Error).message).toContain(
      'Allowed: role, extends, implements, decorator, files, implies.'
    );
  });
});

describe('package manifest', () => {
  it('declares the exports map: root and /agent, ESM and CJS, types first', () => {
    expect(pkg.exports).toEqual({
      '.': { types: './dist/index.d.ts', import: './dist/index.js', require: './dist/index.cjs' },
      './agent': {
        types: './dist/agent/index.d.ts',
        import: './dist/agent.js',
        require: './dist/agent.cjs',
      },
      './package.json': './package.json',
    });
    for (const key of ['.', './agent']) {
      expect(Object.keys(pkg.exports[key] as object)[0], `${key}: types must come first`).toBe(
        'types'
      );
    }
  });

  it('has no runtime dependencies and the documented peers', () => {
    expect(pkg.dependencies).toEqual({});
    expect(pkg.peerDependencies).toEqual({
      '@typescript-eslint/parser': '^8.0.0',
      eslint: '^9.39.0 || ^10.0.0',
    });
    expect(pkg.peerDependenciesMeta).toEqual({ '@typescript-eslint/parser': { optional: true } });
  });

  it('is publishable to the public npm registry with the /agent types reachable on node10', () => {
    expect(pkg.private).toBeUndefined();
    expect(pkg.publishConfig).toEqual({ registry: 'https://registry.npmjs.org', access: 'public' });
    expect(pkg.typesVersions).toEqual({ '*': { agent: ['./dist/agent/index.d.ts'] } });
  });
});

describe('type surface', () => {
  const rootApi = describePublicApi(resolve(PACKAGE_DIR, 'src/index.ts'));
  const agentApi = describePublicApi(resolve(PACKAGE_DIR, 'src/agent/index.ts'));

  it('marks every exported symbol @beta with @since', () => {
    expect(rootApi.untagged).toEqual([]);
    expect(agentApi.untagged).toEqual([]);
  });

  it('keeps the signatures of the root entry', () => {
    expectSurface('root', rootApi.lines);
  });

  it('keeps the signatures of the /agent entry', () => {
    expectSurface('agent', agentApi.lines);
  });

  it('names the same symbols at runtime and in the type surface', () => {
    const typeNames = (lines: readonly string[]): string[] =>
      lines.map(l => l.split(/[ :]/)[1] as string);
    const runtimeRoot = Object.keys(root);
    for (const name of runtimeRoot) {
      expect(typeNames(rootApi.lines), `type surface lacks ${name}`).toContain(name);
    }
    for (const name of Object.keys(agent)) {
      expect(typeNames(agentApi.lines), `type surface lacks ${name}`).toContain(name);
    }
  });
});
