/* eslint-disable @typescript-eslint/no-empty-object-type -- `{}` is the subject of these assertions: it checks which inputs are optional */
// Compile-time contract of the public surface (LT3): the assertions are checked by `tsc`
// (`type-check` target); at runtime they are no-ops, so each test also checks a runtime fact.
import type { Linter, Rule } from 'eslint';
import { describe, expect, expectTypeOf, it } from 'vitest';
import * as agentEntry from '../../src/agent';
import * as root from '../../src';
import {
  configs,
  createRoleResolver,
  createSettingsResolver,
  DddConfigError,
  meta,
  parseSettings,
  plugin,
  resolveRole,
  resolverFromSettings,
  roleScoped,
  rules,
  SETTINGS_KEY,
  validateRoleConfig,
} from '../../src';
import type {
  BindingProblem,
  BindingProblemCode,
  BindingTarget,
  ConfigIssue,
  ConfigProblem,
  DddConfigs,
  DddPlugin,
  DddPluginMeta,
  DddSettings,
  LibraryRoleName,
  ResolveRoleInput,
  ResolverFs,
  ResolverSource,
  ResolverWarning,
  RoleBinding,
  RoleName,
  RoleResolver,
  RoleResolverOptions,
  RoleScope,
  RoleScopedOptions,
  RuleName,
  SettingsContext,
  SettingsResolver,
  ValidateRoleConfigOptions,
  ValidateRoleConfigResult,
} from '../../src';
import {
  createAgentLinter,
  isAgentSeverity,
  isLintConfigError,
  isLintOk,
  isLintParseError,
  isLintSkipped,
  newFindings,
} from '../../src/agent';
import type {
  AgentFinding,
  AgentLintConfigError,
  AgentLinter,
  AgentLinterOptions,
  AgentLintOk,
  AgentLintParseError,
  AgentLintResult,
  AgentLintSkipped,
  AgentSeverity,
  Resettable,
} from '../../src/agent';

describe('plugin object and presets', () => {
  it('has the flat-config shape { meta, rules, configs }', () => {
    expectTypeOf(plugin).toEqualTypeOf<DddPlugin>();
    expectTypeOf(plugin.meta).toEqualTypeOf<DddPluginMeta>();
    expectTypeOf(plugin.configs).toEqualTypeOf<DddConfigs>();
    expectTypeOf(configs).toEqualTypeOf<DddConfigs>();
    expectTypeOf(configs.recommended).toEqualTypeOf<Linter.Config>();
    expectTypeOf(meta).toEqualTypeOf<DddPluginMeta>();
    expectTypeOf<DddPluginMeta>().toEqualTypeOf<{
      readonly name: string;
      readonly version: string;
      readonly namespace: string;
    }>();
    expect(Object.keys(plugin).sort()).toEqual(['configs', 'meta', 'rules']);
  });

  it('keys rules by the closed set of rule names', () => {
    expectTypeOf<RuleName>().toEqualTypeOf<
      | 'no-instanceof-result'
      | 'no-new-entity-id'
      | 'no-deprecated-entity-id-factories'
      | 'event-handler-requires-handle'
      | 'no-internal-imports'
      | 'policy-builder-required-calls'
    >();
    expectTypeOf(rules).toEqualTypeOf<Readonly<Record<RuleName, Rule.RuleModule>>>();
    expect(Object.keys(rules).sort()).toEqual(Object.keys(plugin.rules).sort());
  });

  it('exports names only: no default export, and the agent lane stays on its subpath', () => {
    expectTypeOf(root).not.toHaveProperty('default');
    expectTypeOf(root).not.toHaveProperty('createAgentLinter');
    expectTypeOf(root).not.toHaveProperty('LIBRARY_ROLES');
    expect(Object.keys(root)).not.toContain('default');
    expect(Object.keys(root)).not.toContain('createAgentLinter');
    expect(Object.keys(root)).not.toContain('LIBRARY_ROLES');
  });
});

describe('export validation tables (LT2)', () => {
  it('lists every runtime export of the root barrel, so removing or adding one fails here', () => {
    expect(Object.keys(root).sort()).toEqual(
      [
        'configs',
        'createRoleResolver',
        'createSettingsResolver',
        'DddConfigError',
        'meta',
        'parseSettings',
        'plugin',
        'resolveRole',
        'resolverFromSettings',
        'roleConfigFromSettings',
        'roleScoped',
        'rules',
        'SETTINGS_KEY',
        'validateRoleConfig',
      ].sort()
    );
  });

  it('exports each root runtime symbol with the expected runtime type', () => {
    expect(typeof root.configs).toBe('object');
    expect(typeof root.meta).toBe('object');
    expect(typeof root.plugin).toBe('object');
    expect(typeof root.rules).toBe('object');
    expect(typeof root.SETTINGS_KEY).toBe('string');
    expect(typeof root.DddConfigError).toBe('function');
    for (const name of [
      'createRoleResolver',
      'createSettingsResolver',
      'parseSettings',
      'resolveRole',
      'resolverFromSettings',
      'roleConfigFromSettings',
      'roleScoped',
      'validateRoleConfig',
    ] as const) {
      expect(typeof root[name], name).toBe('function');
    }
  });

  it('lists every runtime export of the agent entry', () => {
    expect(Object.keys(agentEntry).sort()).toEqual(
      [
        'createAgentLinter',
        'isAgentSeverity',
        'isLintConfigError',
        'isLintOk',
        'isLintParseError',
        'isLintSkipped',
        'newFindings',
      ].sort()
    );
    for (const value of Object.values(agentEntry)) {
      expect(typeof value).toBe('function');
    }
  });

  it('resolverFromSettings is a ready-made provider taking a settings context', () => {
    expectTypeOf(resolverFromSettings).toEqualTypeOf<SettingsResolver>();
    expectTypeOf(resolverFromSettings).toBeCallableWith({ settings: {} });
    expectTypeOf<SettingsContext>().toHaveProperty('settings');
    expectTypeOf<SettingsContext['cwd']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<{ settings: {}; cwd: string }>().toExtend<SettingsContext>();
    expect(typeof resolverFromSettings).toBe('function');
  });
});

describe('role vocabulary types', () => {
  it('lists the library roles as a closed union that RoleName extends openly', () => {
    expectTypeOf<LibraryRoleName>().toEqualTypeOf<
      | 'Aggregate'
      | 'Entity'
      | 'ValueObject'
      | 'DomainEvent'
      | 'IntegrationEvent'
      | 'Command'
      | 'Query'
      | 'CommandHandler'
      | 'QueryHandler'
      | 'EventHandler'
      | 'DomainService'
      | 'Repository'
      | 'Specification'
      | 'Policy'
      | 'ACLAdapter'
    >();
    expectTypeOf<LibraryRoleName>().toExtend<RoleName>();
    expectTypeOf<'Aggregate'>().toExtend<RoleName>();
    expectTypeOf<string>().toExtend<RoleName>();
    expectTypeOf<RoleName>().toExtend<string>();
    expect(true).toBe(true);
  });

  it('describes a binding target as a read-only { from, name }', () => {
    expectTypeOf<BindingTarget>().toEqualTypeOf<{ readonly from: string; readonly name: string }>();
    expect(true).toBe(true);
  });

  it('needs only a role to declare a binding, so adding optional fields stays compatible', () => {
    expectTypeOf<{ role: 'Custom' }>().toExtend<RoleBinding>();
    expectTypeOf<{ role: 'Custom'; files: string }>().toExtend<RoleBinding>();
    expectTypeOf<{ files: string }>().not.toExtend<RoleBinding>();
    expectTypeOf<RoleBinding['role']>().toEqualTypeOf<RoleName>();
    expect(true).toBe(true);
  });
});

describe('resolver types', () => {
  it('needs only cwd to create a resolver', () => {
    expectTypeOf<{ cwd: string }>().toExtend<RoleResolverOptions>();
    expectTypeOf<{}>().not.toExtend<RoleResolverOptions>();
    expectTypeOf(createRoleResolver).parameters.toEqualTypeOf<[RoleResolverOptions]>();
    expectTypeOf(createRoleResolver).returns.toEqualTypeOf<RoleResolver>();
    expect(typeof createRoleResolver).toBe('function');
  });

  it('exposes the resolver surface consumers call', () => {
    expectTypeOf<RoleResolver['checkBindings']>().returns.toEqualTypeOf<
      readonly BindingProblem[]
    >();
    expectTypeOf<RoleResolver['reset']>().returns.toBeVoid();
    expectTypeOf<RoleResolver['warnings']>().toEqualTypeOf<readonly ResolverWarning[]>();
    expectTypeOf<RoleResolver['classify']>().parameter(1).toBeString();
    expectTypeOf<RoleResolver['classify']>().parameter(2).toEqualTypeOf<string | undefined>();
    expect(true).toBe(true);
  });

  it('keeps the injected file system minimal', () => {
    expectTypeOf<ResolverFs['readFile']>().toEqualTypeOf<(path: string) => string | undefined>();
    expectTypeOf<ResolverFs['stat']>().returns.toEqualTypeOf<
      { readonly isFile: boolean; readonly mtimeMs: number } | undefined
    >();
    expect(true).toBe(true);
  });

  it('closes the binding problem codes and narrows warnings by code', () => {
    expectTypeOf<BindingProblemCode>().toEqualTypeOf<
      'empty-binding' | 'invalid-glob' | 'file-not-found' | 'export-not-found'
    >();
    expectTypeOf<ResolverWarning['code']>().toEqualTypeOf<'max-depth' | 'tsconfig'>();
    expectTypeOf<Extract<ResolverWarning, { code: 'tsconfig' }>['message']>().toBeString();
    expectTypeOf<Extract<ResolverWarning, { code: 'max-depth' }>['name']>().toBeString();
    expect(true).toBe(true);
  });

  it('resolveRole takes one input object and returns a read-only list of role names', () => {
    expectTypeOf(resolveRole).parameters.toEqualTypeOf<[ResolveRoleInput]>();
    expectTypeOf(resolveRole).returns.toEqualTypeOf<readonly RoleName[]>();
    expectTypeOf<ResolveRoleInput['resolver']>().toEqualTypeOf<RoleResolver>();
    expectTypeOf<ResolveRoleInput['filename']>().toBeString();
    expect(typeof resolveRole).toBe('function');
  });
});

describe('validateRoleConfig types', () => {
  it('is asynchronous and extends the resolver options', () => {
    expectTypeOf(validateRoleConfig).parameters.toEqualTypeOf<[ValidateRoleConfigOptions]>();
    expectTypeOf(validateRoleConfig).returns.toEqualTypeOf<Promise<ValidateRoleConfigResult>>();
    expectTypeOf<ValidateRoleConfigOptions>().toExtend<RoleResolverOptions>();
    expectTypeOf<{ cwd: string }>().toExtend<ValidateRoleConfigOptions>();
    expect(typeof validateRoleConfig).toBe('function');
  });

  it('reports problems as a union discriminated by code', () => {
    expectTypeOf<ConfigProblem['code']>().toEqualTypeOf<
      BindingProblemCode | 'role-matches-nothing'
    >();
    expectTypeOf<ValidateRoleConfigResult['problems']>().toEqualTypeOf<readonly ConfigProblem[]>();
    expectTypeOf<ValidateRoleConfigResult['ok']>().toBeBoolean();
    expectTypeOf<ValidateRoleConfigResult['scannedFiles']>().toBeNumber();
    expectTypeOf<ValidateRoleConfigResult['unparsedFiles']>().toBeNumber();
    expect(true).toBe(true);
  });
});

describe('roleScoped types', () => {
  it('wraps a rule for one role or a list of roles', () => {
    expectTypeOf(roleScoped).parameters.toEqualTypeOf<
      [Rule.RuleModule, RoleName | readonly RoleName[], RoleScopedOptions]
    >();
    expectTypeOf(roleScoped).returns.toEqualTypeOf<Rule.RuleModule>();
    expect(typeof roleScoped).toBe('function');
  });

  it('closes the scope and requires only a resolver', () => {
    expectTypeOf<RoleScope>().toEqualTypeOf<'class' | 'file'>();
    expectTypeOf<{ resolver: RoleResolver }>().toExtend<RoleScopedOptions>();
    expectTypeOf<{ scope: 'file' }>().not.toExtend<RoleScopedOptions>();
    expectTypeOf<{ resolver: RoleResolver; scope: 'neither' }>().not.toExtend<RoleScopedOptions>();
    expectTypeOf<RoleResolver>().toExtend<ResolverSource>();
    expectTypeOf<(context: Rule.RuleContext) => RoleResolver>().toExtend<ResolverSource>();
    expect(true).toBe(true);
  });
});

describe('settings types', () => {
  it('parses unknown input into DddSettings and fails with a typed error', () => {
    expectTypeOf(parseSettings).parameters.toEqualTypeOf<[unknown]>();
    expectTypeOf(parseSettings).returns.toEqualTypeOf<DddSettings>();
    expectTypeOf<DddConfigError>().toExtend<Error>();
    expectTypeOf<DddConfigError['problems']>().toEqualTypeOf<readonly ConfigIssue[]>();
    expectTypeOf(SETTINGS_KEY).toBeString();
    expect(SETTINGS_KEY).toBe('ddd');
    expect(new DddConfigError([])).toBeInstanceOf(Error);
  });

  it('accepts every setting as optional', () => {
    expectTypeOf<{}>().toExtend<DddSettings>();
    expectTypeOf<DddSettings['tsconfig']>().toEqualTypeOf<string | false | undefined>();
    expectTypeOf<DddSettings['maxDepth']>().toEqualTypeOf<number | undefined>();
    expect(true).toBe(true);
  });

  it('builds a settings resolver that can stand in for roleScoped resolver option', () => {
    expectTypeOf(createSettingsResolver).returns.toEqualTypeOf<SettingsResolver>();
    expectTypeOf<SettingsResolver>().toExtend<ResolverSource>();
    expectTypeOf<SettingsResolver>().toBeCallableWith({ settings: {} });
    expectTypeOf<SettingsResolver['reset']>().returns.toBeVoid();
    expect(typeof createSettingsResolver()).toBe('function');
  });
});

describe('agent lane types', () => {
  it('creates a linter from optional options and lints text asynchronously', () => {
    expectTypeOf(createAgentLinter).parameters.toEqualTypeOf<[options?: AgentLinterOptions]>();
    expectTypeOf(createAgentLinter).returns.toEqualTypeOf<AgentLinter>();
    expectTypeOf<AgentLinter['lintText']>().parameters.toEqualTypeOf<[string, string]>();
    expectTypeOf<AgentLinter['lintText']>().returns.toEqualTypeOf<Promise<AgentLintResult>>();
    expectTypeOf<{}>().toExtend<AgentLinterOptions>();
    expectTypeOf<NonNullable<AgentLinterOptions['minSeverity']>>().toEqualTypeOf<AgentSeverity>();
    expectTypeOf<NonNullable<AgentLinterOptions['rulePrefixes']>>().toEqualTypeOf<
      readonly string[]
    >();
    expectTypeOf<NonNullable<AgentLinterOptions['resettables']>>().toEqualTypeOf<
      readonly Resettable[]
    >();
    expect(typeof createAgentLinter).toBe('function');
  });

  it('describes a finding with read-only fields', () => {
    expectTypeOf<AgentFinding>().toEqualTypeOf<{
      readonly ruleId: string;
      readonly severity: AgentSeverity;
      readonly message: string;
      readonly line: number;
      readonly column: number;
      readonly endLine?: number;
      readonly endColumn?: number;
    }>();
    expectTypeOf<AgentSeverity>().toEqualTypeOf<'error' | 'warn'>();
    expect(true).toBe(true);
  });

  it('closes the result on four statuses and each variant carries its own fields', () => {
    expectTypeOf<AgentLintResult['status']>().toEqualTypeOf<
      'ok' | 'skipped' | 'parse-error' | 'config-error'
    >();
    expectTypeOf<AgentLintOk['findings']>().toEqualTypeOf<readonly AgentFinding[]>();
    expectTypeOf<AgentLintSkipped['reason']>().toBeString();
    expectTypeOf<AgentLintParseError['message']>().toBeString();
    expectTypeOf<AgentLintConfigError['issues']>().toEqualTypeOf<
      readonly ConfigIssue[] | undefined
    >();
    expect(true).toBe(true);
  });

  it('can be handled exhaustively, so a new status is a compile-time error here', () => {
    const describeResult = (result: AgentLintResult): string => {
      switch (result.status) {
        case 'ok':
          return `ok:${result.findings.length}`;
        case 'skipped':
          return `skipped:${result.reason}`;
        case 'parse-error':
          return `parse-error:${result.message}`;
        case 'config-error':
          return `config-error:${result.message}`;
        default: {
          const unreachable: never = result;
          return unreachable;
        }
      }
    };
    expect(describeResult({ status: 'ok', findings: [] })).toBe('ok:0');
    expect(describeResult({ status: 'skipped', reason: 'ignored' })).toBe('skipped:ignored');
  });

  it('ships a type guard for every status and for the severity', () => {
    expectTypeOf(isAgentSeverity).guards.toEqualTypeOf<AgentSeverity>();
    expectTypeOf(isLintOk).guards.toEqualTypeOf<AgentLintOk>();
    expectTypeOf(isLintSkipped).guards.toEqualTypeOf<AgentLintSkipped>();
    expectTypeOf(isLintParseError).guards.toEqualTypeOf<AgentLintParseError>();
    expectTypeOf(isLintConfigError).guards.toEqualTypeOf<AgentLintConfigError>();

    const result: AgentLintResult = { status: 'ok', findings: [] };
    if (isLintOk(result)) {
      expectTypeOf(result.findings).toEqualTypeOf<readonly AgentFinding[]>();
    } else {
      expect.unreachable('an ok result must narrow to AgentLintOk');
    }
    expect(isLintSkipped(result)).toBe(false);
  });

  it('computes new findings from two read-only lists', () => {
    expectTypeOf(newFindings).parameters.toEqualTypeOf<
      [readonly AgentFinding[], readonly AgentFinding[]]
    >();
    expectTypeOf(newFindings).returns.toEqualTypeOf<readonly AgentFinding[]>();
    expect(newFindings([], [])).toEqual([]);
  });
});
