import type { BindingTarget } from '../roles';
import type { RoleBinding } from '../resolver';
import { DddConfigError, type ConfigIssue } from './errors';
import { suggestKey } from './did-you-mean';

/**
 * Key under which the plugin reads its configuration from `context.settings`.
 *
 * @beta
 * @since 0.32.0
 */
export const SETTINGS_KEY = 'ddd';

/**
 * Shape of `settings.ddd` in a flat config. Everything is optional: the built-in library
 * vocabulary works with no configuration at all.
 *
 * @example
 * ```js
 * export default [{ settings: { ddd: { bindings: [
 *   { role: 'Aggregate', extends: { from: 'src/shared/base.aggregate.ts', name: 'BaseAggregate' } },
 * ] } } }];
 * ```
 *
 * @beta
 * @since 0.32.0
 */
export interface DddSettings {
  /** Project bindings: base classes, decorators or file globs that carry a role. */
  readonly bindings?: readonly RoleBinding[];
  /** tsconfig path relative to the project root (default `tsconfig.json`), or `false`. */
  readonly tsconfig?: string | false;
  /** Set to `false` to skip the built-in library vocabulary (default `true`). */
  readonly includeLibraryRoles?: boolean;
  /** Maximum inheritance depth followed through project classes (default 6). */
  readonly maxDepth?: number;
}

const SETTINGS_KEYS = ['bindings', 'tsconfig', 'includeLibraryRoles', 'maxDepth'] as const;
const BINDING_KEYS = ['role', 'extends', 'implements', 'decorator', 'files', 'implies'] as const;
const TARGET_KEYS = ['from', 'name'] as const;
const TARGET_FIELDS = ['extends', 'implements', 'decorator'] as const;

type Raw = Record<string, unknown>;

const isRecord = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

class IssueSink {
  readonly issues: ConfigIssue[] = [];

  add(path: string, message: string, role?: string): void {
    this.issues.push({
      code: 'invalid-settings',
      path,
      message: `${path}: ${message}`,
      ...(role === undefined ? {} : { role }),
    });
  }

  unknownKeys(value: Raw, allowed: readonly string[], path: string, role?: string): void {
    for (const key of Object.keys(value)) {
      if (allowed.includes(key)) continue;
      const hint = suggestKey(key, allowed);
      this.add(
        path,
        `unknown key "${key}"${hint ? ` (did you mean "${hint}"?)` : ''}. Allowed: ${allowed.join(', ')}.`,
        role
      );
    }
  }
}

function parseTarget(raw: unknown, path: string, role: string | undefined, sink: IssueSink) {
  if (!isRecord(raw)) {
    sink.add(path, 'expected an object { from, name }.', role);
    return undefined;
  }
  sink.unknownKeys(raw, TARGET_KEYS, path, role);
  let ok = true;
  for (const key of TARGET_KEYS) {
    if (!isNonEmptyString(raw[key])) {
      sink.add(`${path}.${key}`, `must be a non-empty string.`, role);
      ok = false;
    }
  }
  return ok ? ({ from: raw['from'], name: raw['name'] } as BindingTarget) : undefined;
}

function parseTargets(
  raw: unknown,
  path: string,
  role: string | undefined,
  sink: IssueSink
): BindingTarget | readonly BindingTarget[] | undefined {
  if (!Array.isArray(raw)) return parseTarget(raw, path, role, sink);
  const targets = raw.map((t, i) => parseTarget(t, `${path}[${i}]`, role, sink));
  return targets.filter((t): t is BindingTarget => t !== undefined);
}

function parseBinding(raw: unknown, path: string, sink: IssueSink): RoleBinding | undefined {
  if (!isRecord(raw)) {
    sink.add(path, 'expected an object { role, extends?, implements?, decorator?, files? }.');
    return undefined;
  }
  const role = isNonEmptyString(raw['role']) ? raw['role'] : undefined;
  if (role === undefined) sink.add(`${path}.role`, 'must be a non-empty string.');
  sink.unknownKeys(raw, BINDING_KEYS, path, role);

  const targets: Partial<
    Record<(typeof TARGET_FIELDS)[number], BindingTarget | readonly BindingTarget[]>
  > = {};
  for (const field of TARGET_FIELDS) {
    if (raw[field] === undefined) continue;
    const parsed = parseTargets(raw[field], `${path}.${field}`, role, sink);
    if (parsed !== undefined) targets[field] = parsed;
  }
  let files: string | undefined;
  if (raw['files'] !== undefined) {
    if (isNonEmptyString(raw['files'])) files = raw['files'];
    else sink.add(`${path}.files`, 'must be a non-empty glob string.', role);
  }
  let implies: readonly string[] | undefined;
  if (raw['implies'] !== undefined) {
    const list = raw['implies'];
    if (Array.isArray(list) && list.every(isNonEmptyString)) implies = [...list];
    else sink.add(`${path}.implies`, 'must be an array of non-empty role names.', role);
  }
  if (role === undefined) return undefined;
  return {
    role,
    ...targets,
    ...(files === undefined ? {} : { files }),
    ...(implies === undefined ? {} : { implies }),
  };
}

function parseScalars(raw: Raw, sink: IssueSink, path: string): Omit<DddSettings, 'bindings'> {
  const out: { tsconfig?: string | false; includeLibraryRoles?: boolean; maxDepth?: number } = {};
  const tsconfig = raw['tsconfig'];
  if (tsconfig !== undefined) {
    if (tsconfig === false || isNonEmptyString(tsconfig)) out.tsconfig = tsconfig;
    else sink.add(`${path}.tsconfig`, 'must be a non-empty path string or false.');
  }
  const include = raw['includeLibraryRoles'];
  if (include !== undefined) {
    if (typeof include === 'boolean') out.includeLibraryRoles = include;
    else sink.add(`${path}.includeLibraryRoles`, 'must be a boolean.');
  }
  const depth = raw['maxDepth'];
  if (depth !== undefined) {
    if (typeof depth === 'number' && Number.isInteger(depth) && depth >= 1) out.maxDepth = depth;
    else sink.add(`${path}.maxDepth`, 'must be an integer >= 1.');
  }
  return out;
}

/**
 * Validation level 0 (shape, no I/O): reads the value of `settings.ddd` and returns a fresh,
 * normalised {@link DddSettings}. `undefined` means "no configuration". Throws
 * {@link DddConfigError} listing every problem at once, with typo suggestions.
 *
 * @beta
 * @since 0.32.0
 */
export function parseSettings(raw: unknown): DddSettings {
  if (raw === undefined) return {};
  const base = `settings.${SETTINGS_KEY}`;
  const sink = new IssueSink();
  if (!isRecord(raw)) {
    sink.add(base, 'expected an object.');
    throw new DddConfigError(sink.issues);
  }
  sink.unknownKeys(raw, SETTINGS_KEYS, base);
  const scalars = parseScalars(raw, sink, base);

  let bindings: RoleBinding[] | undefined;
  if (raw['bindings'] !== undefined) {
    if (Array.isArray(raw['bindings'])) {
      bindings = raw['bindings']
        .map((b, i) => parseBinding(b, `${base}.bindings[${i}]`, sink))
        .filter((b): b is RoleBinding => b !== undefined);
    } else {
      sink.add(`${base}.bindings`, 'must be an array of role bindings.');
    }
  }
  if (sink.issues.length > 0) throw new DddConfigError(sink.issues);
  return { ...scalars, ...(bindings === undefined ? {} : { bindings }) };
}
