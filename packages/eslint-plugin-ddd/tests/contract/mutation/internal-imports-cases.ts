import type { MutationCase } from './types';

const RULE = 'no-internal-imports' as const;

interface Spec {
  readonly id: string;
  readonly code: string;
  readonly files?: Readonly<Record<string, string>>;
  readonly entry?: string;
}

function violation(spec: Spec, expected = 1): MutationCase {
  return {
    id: `${RULE}/violation/${spec.id}`,
    rule: RULE,
    kind: 'violation',
    variant: spec.id,
    files: { ...(spec.files ?? {}), [spec.entry ?? 'entry.ts']: spec.code },
    entry: spec.entry ?? 'entry.ts',
    expected,
  };
}

function valid(spec: Spec): MutationCase {
  return { ...violation(spec, 0), id: `${RULE}/valid/${spec.id}`, kind: 'valid' };
}

const INTERNAL = '@vytches/ddd-cqrs/internal';

// Import-like forms the rule has to see: every way to name a module in TypeScript.
const FORMS: readonly Spec[] = [
  { id: 'import-named', code: `import { x } from '${INTERNAL}';\nvoid x;\n` },
  { id: 'import-default', code: `import x from '${INTERNAL}';\nvoid x;\n` },
  { id: 'import-namespace', code: `import * as x from '${INTERNAL}';\nvoid x;\n` },
  { id: 'import-side-effect', code: `import '${INTERNAL}';\n` },
  {
    id: 'import-type',
    code: `import type { X } from '${INTERNAL}';\nlet v: X | undefined = undefined;\nvoid v;\n`,
  },
  { id: 'export-named-from', code: `export { x } from '${INTERNAL}';\n` },
  { id: 'export-star-from', code: `export * from '${INTERNAL}';\n` },
  { id: 'export-namespace-from', code: `export * as internals from '${INTERNAL}';\n` },
  {
    id: 'dynamic-import',
    code: `export async function load(): Promise<unknown> {\n  return import('${INTERNAL}');\n}\n`,
  },
  {
    id: 'require-call',
    code: `declare const require: (id: string) => unknown;\nconst m = require('${INTERNAL}');\nvoid m;\n`,
  },
  { id: 'import-equals-require', code: `import m = require('${INTERNAL}');\nvoid m;\n` },
  {
    id: 'import-type-query',
    code: `type M = typeof import('${INTERNAL}');\nlet v: M | undefined = undefined;\nvoid v;\n`,
  },
  {
    id: 'import-type-node',
    code: `let v: import('${INTERNAL}').X | undefined = undefined;\nvoid v;\n`,
  },
];

// Library packages x internal / deep paths: any package of the family, any depth.
const TARGETS: readonly Spec[] = [
  { id: 'meta-package-internal', code: `import { x } from '@vytches/ddd/internal';\nvoid x;\n` },
  {
    id: 'contracts-internal',
    code: `import { x } from '@vytches/ddd-contracts/internal';\nvoid x;\n`,
  },
  { id: 'events-internal', code: `import { x } from '@vytches/ddd-events/internal';\nvoid x;\n` },
  { id: 'utils-internal', code: `import { x } from '@vytches/ddd-utils/internal';\nvoid x;\n` },
  {
    id: 'nested-internal',
    code: `import { x } from '@vytches/ddd-contracts/internal/logger';\nvoid x;\n`,
  },
  {
    id: 'deep-dist',
    code: `import { x } from '@vytches/ddd-aggregates/dist/aggregate-root';\nvoid x;\n`,
  },
  { id: 'deep-src', code: `import { x } from '@vytches/ddd-aggregates/src/index';\nvoid x;\n` },
  {
    id: 'deep-lib',
    code: `import { x } from '@vytches/ddd-policies/lib/policy-builder';\nvoid x;\n`,
  },
  { id: 'deep-meta-package', code: `import { x } from '@vytches/ddd/dist/index';\nvoid x;\n` },
  {
    id: 'deep-require',
    code: `declare const require: (id: string) => unknown;\nconst m = require('@vytches/ddd-aggregates/dist/index');\nvoid m;\n`,
  },
  {
    id: 'symbol-internal-logger',
    code: `import { internalLogger } from '@vytches/ddd-utils';\nvoid internalLogger;\n`,
  },
  {
    id: 'symbol-internal-logger-aliased',
    code: `import { internalLogger as log } from '@vytches/ddd-utils';\nvoid log;\n`,
  },
  {
    id: 'symbol-handler-metadata',
    code: `import { EVENT_HANDLER_METADATA } from '@vytches/ddd-events';\nvoid EVENT_HANDLER_METADATA;\n`,
  },
  {
    id: 'symbol-handler-options-reexport',
    code: `export { EVENT_HANDLER_OPTIONS } from '@vytches/ddd-events';\n`,
  },
  {
    id: 'symbol-custom-middleware',
    code: `import { CUSTOM_MIDDLEWARE_SYMBOL } from '@vytches/ddd-cqrs';\nvoid CUSTOM_MIDDLEWARE_SYMBOL;\n`,
  },
  { id: 'facade-file-itself', code: `export * from '${INTERNAL}';\n`, entry: 'facade.ts' },
];

const VALID: readonly Spec[] = [
  { id: 'package-entry', code: `import { Result } from '@vytches/ddd-contracts';\nvoid Result;\n` },
  { id: 'meta-package-entry', code: `import { Result } from '@vytches/ddd';\nvoid Result;\n` },
  {
    id: 'package-entry-type',
    code: `import type { Result } from '@vytches/ddd-contracts';\nlet v: Result<number> | undefined = undefined;\nvoid v;\n`,
  },
  {
    id: 'public-llm-context',
    code: `import text from '@vytches/ddd-contracts/llm-context';\nvoid text;\n`,
  },
  {
    id: 'public-llm-context-md',
    code: `import text from '@vytches/ddd-contracts/llm-context.md';\nvoid text;\n`,
  },
  {
    id: 'public-package-json',
    code: `import pkg from '@vytches/ddd-contracts/package.json';\nvoid pkg;\n`,
  },
  {
    id: 'relative-internal-folder',
    code: `import { x } from './internal';\nvoid x;\n`,
    files: { 'internal/index.ts': `export const x = 1;\n` },
  },
  {
    id: 'relative-internal-file',
    code: `import { x } from './internal/logger';\nvoid x;\n`,
    files: { 'internal/logger.ts': `export const x = 1;\n` },
  },
  { id: 'third-party-internal', code: `import { x } from 'lodash/internal';\nvoid x;\n` },
  { id: 'other-scope-internal', code: `import { x } from '@vytches/other/internal';\nvoid x;\n` },
  {
    id: 'other-scope-ddd-lookalike',
    code: `import { x } from '@vytches-labs/ddd-cqrs/internal';\nvoid x;\n`,
  },
  {
    id: 'similar-symbol-name',
    code: `import { internalLoggerFactory } from '@vytches/ddd-utils';\nvoid internalLoggerFactory;\n`,
  },
  {
    id: 'string-in-plain-call',
    code: `declare const log: (text: string) => void;\nlog('${INTERNAL}');\n`,
  },
  { id: 'string-in-variable', code: `export const path = '${INTERNAL}';\n` },
  {
    id: 'dynamic-import-variable',
    code: `export async function load(name: string): Promise<unknown> {\n  return import(name);\n}\n`,
  },
  {
    id: 'consumer-of-facade',
    code: `import { x } from './facade';\nvoid x;\n`,
    files: { 'facade.ts': `export * from '${INTERNAL}';\n` },
  },
  {
    id: 'library-own-package-file',
    code: `import { x } from '${INTERNAL}';\nvoid x;\n`,
    files: { 'package.json': `{ "name": "@vytches/ddd-sibling" }\n` },
  },
  {
    id: 'library-meta-own-package-file',
    code: `import { x } from '@vytches/ddd-contracts/internal';\nvoid x;\n`,
    files: { 'package.json': `{ "name": "@vytches/ddd" }\n` },
  },
];

export function internalImportsCases(): readonly MutationCase[] {
  return [...FORMS.map(s => violation(s)), ...TARGETS.map(s => violation(s)), ...VALID.map(valid)];
}
