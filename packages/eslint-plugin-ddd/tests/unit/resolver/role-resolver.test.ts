import { describe, expect, it } from 'vitest';
import {
  createRoleResolver,
  type AstNode,
  type ResolverWarning,
  type RoleBinding,
  type RoleResolverOptions,
} from '../../../src/resolver';
import { createMemoryFs } from '../helpers/memory-fs';
import { parseProgram } from '../helpers/parse';

const CWD = '/proj';
const BASE_FILE = '/proj/src/shared/base.aggregate.ts';
const BASE_TEXT = [
  `import { AggregateRoot } from '@vytches/ddd-aggregates';`,
  `export class BaseAggregate extends AggregateRoot<string> {}`,
  '',
].join('\n');
const AUDITED: RoleBinding = {
  role: 'AuditedAggregate',
  extends: { from: 'src/shared/base.aggregate.ts', name: 'BaseAggregate' },
};

type Roles = Record<string, readonly string[]>;

/** Classifies `code` as `filename` and returns the sorted roles of each class by name. */
function classifyRoles(
  options: Partial<RoleResolverOptions> & { files?: Record<string, string> },
  code: string,
  filename = '/proj/src/orders/order.ts'
): Roles {
  const { files = {}, ...rest } = options;
  const resolver = createRoleResolver({
    cwd: CWD,
    tsconfig: false,
    fs: createMemoryFs(files),
    ...rest,
  });
  const out: Record<string, string[]> = {};
  for (const c of resolver.classify(parseProgram(code, filename), filename, code)) {
    out[c.name] = [...c.roles].sort();
  }
  return out;
}

describe('library roles by import source', () => {
  it.each([
    [
      `import { AggregateRoot } from '@vytches/ddd-aggregates'; class X extends AggregateRoot<string> {}`,
      'Aggregate',
    ],
    [
      `import { Entity } from '@vytches/ddd-aggregates'; class X extends Entity<string> {}`,
      'Entity',
    ],
    [
      `import { BaseValueObject } from '@vytches/ddd-value-objects'; class X extends BaseValueObject<string> {}`,
      'ValueObject',
    ],
    [
      `import { DomainEvent } from '@vytches/ddd-events'; class X extends DomainEvent {}`,
      'DomainEvent',
    ],
    [`import { ICommand } from '@vytches/ddd-cqrs'; class X implements ICommand {}`, 'Command'],
    [
      `import { IRepository } from '@vytches/ddd-repositories'; class X implements IRepository<Y> {}`,
      'Repository',
    ],
    [
      `import { CommandHandler } from '@vytches/ddd-cqrs'; @CommandHandler(C) class X {}`,
      'CommandHandler',
    ],
    [
      `import { EventHandler } from '@vytches/ddd-events'; @EventHandler(E) class X {}`,
      'EventHandler',
    ],
  ])('%s -> %s', (code, role) => {
    expect(classifyRoles({}, code)['X']).toEqual([role]);
  });

  it('treats the enterprise meta-package as the home package of a symbol', () => {
    expect(
      classifyRoles(
        {},
        `import { AggregateRoot } from '@vytches/ddd'; class X extends AggregateRoot<string> {}`
      )['X']
    ).toEqual(['Aggregate']);
  });

  it('never decides by class name: same name from another package carries no role', () => {
    const code = `import { AggregateRoot } from 'some-orm'; class X extends AggregateRoot {}`;
    expect(classifyRoles({}, code)['X']).toEqual([]);
  });

  it('gives no role to a class that is not related to any binding', () => {
    expect(classifyRoles({}, `class Plain {} class Other extends Plain {}`)).toEqual({
      Plain: [],
      Other: [],
    });
  });

  it('skips the built-in vocabulary when includeLibraryRoles is false', () => {
    const code = `import { AggregateRoot } from '@vytches/ddd-aggregates'; class X extends AggregateRoot {}`;
    expect(classifyRoles({ includeLibraryRoles: false }, code)['X']).toEqual([]);
  });

  it('returns nothing for a source text without the word "class" (cheap prefilter)', () => {
    const resolver = createRoleResolver({ cwd: CWD, tsconfig: false, fs: createMemoryFs({}) });
    const text = `export const a = 1;`;
    expect(resolver.classify(parseProgram(text), '/proj/src/a.ts', text)).toEqual([]);
  });

  it('classifies anonymous class expressions too', () => {
    const code = `import { AggregateRoot } from '@vytches/ddd-aggregates'; export const X = class extends AggregateRoot {};`;
    expect(classifyRoles({}, code)['<anonymous>']).toEqual(['Aggregate']);
  });
});

describe('reference shapes', () => {
  const IMPORT = `import { AggregateRoot } from '@vytches/ddd-aggregates';`;
  it.each([
    [
      'alias import',
      `import { AggregateRoot as Root } from '@vytches/ddd-aggregates'; class X extends Root {}`,
    ],
    [
      'namespace import',
      `import * as agg from '@vytches/ddd-aggregates'; class X extends agg.AggregateRoot {}`,
    ],
    ['const alias', `${IMPORT} const Root = AggregateRoot; class X extends Root {}`],
    ['as expression', `${IMPORT} class X extends (AggregateRoot as typeof AggregateRoot) {}`],
    ['satisfies expression', `${IMPORT} class X extends (AggregateRoot satisfies object) {}`],
    ['generic arguments', `${IMPORT} class X extends AggregateRoot<string, { a: 1 }> {}`],
  ])('resolves %s', (_label, code) => {
    expect(classifyRoles({}, code)['X']).toEqual(['Aggregate']);
  });

  it.each([
    [
      'a parameter',
      `${IMPORT} function make(AggregateRoot: new () => object) { return class X extends AggregateRoot {}; }`,
    ],
    [
      'a local class',
      `${IMPORT} function make() { class AggregateRoot {} return class X extends AggregateRoot {}; }`,
    ],
    [
      'a local constant',
      `${IMPORT} function make() { const AggregateRoot = Base; return class X extends AggregateRoot {}; }`,
    ],
  ])('does not take %s of the same name for the library symbol', (_label, code) => {
    expect(classifyRoles({}, code)['X']).toEqual([]);
  });

  it('stays silent on destructuring and dynamic aliases (documented limit)', () => {
    const code = `${IMPORT} const { AggregateRoot: Root } = lib; class X extends Root {}`;
    expect(classifyRoles({}, code)['X']).toEqual([]);
  });
});

describe('project bindings', () => {
  const FILES = { [BASE_FILE]: BASE_TEXT };
  const USE = `import { BaseAggregate } from '../shared/base.aggregate';\nexport class Order extends BaseAggregate {}`;

  it('adds the custom role and the library role inherited through the project base class', () => {
    expect(classifyRoles({ bindings: [AUDITED], files: FILES }, USE)['Order']).toEqual([
      'Aggregate',
      'AuditedAggregate',
    ]);
  });

  it('resolves ./x.js specifiers to the TypeScript source', () => {
    const code = USE.replace('base.aggregate', 'base.aggregate.js');
    expect(classifyRoles({ bindings: [AUDITED], files: FILES }, code)['Order']).toContain(
      'AuditedAggregate'
    );
  });

  it('follows a facade barrel with named, star and namespace re-exports', () => {
    const barrels: Record<string, string> = {
      named: `export { BaseAggregate } from './base.aggregate.js';`,
      star: `export * from './base.aggregate';`,
      renamed: `export { BaseAggregate as Core } from './base.aggregate';`,
      type: `export type { BaseAggregate } from './base.aggregate';`,
    };
    for (const [label, barrel] of Object.entries(barrels)) {
      const name = label === 'renamed' ? 'Core' : 'BaseAggregate';
      const code = `import { ${name} } from '../shared';\nexport class Order extends ${name} {}`;
      const files = { ...FILES, '/proj/src/shared/index.ts': barrel };
      expect(classifyRoles({ bindings: [AUDITED], files }, code)['Order'], label).toContain(
        'AuditedAggregate'
      );
    }
    const ns = {
      ...FILES,
      '/proj/src/shared/index.ts': `export * as base from './base.aggregate';`,
    };
    const code = `import { base } from '../shared';\nexport class Order extends base.BaseAggregate {}`;
    expect(classifyRoles({ bindings: [AUDITED], files: ns }, code)['Order']).toContain(
      'AuditedAggregate'
    );
  });

  it('resolves a namespace import of a project file', () => {
    const code = `import * as base from '../shared/base.aggregate';\nexport class Order extends base.BaseAggregate {}`;
    expect(classifyRoles({ bindings: [AUDITED], files: FILES }, code)['Order']).toContain(
      'AuditedAggregate'
    );
  });

  it('resolves tsconfig paths (JSONC, extends, trailing commas, all targets)', () => {
    const files = {
      [BASE_FILE]: BASE_TEXT,
      '/proj/tsconfig.base.json': `﻿{ // shared\n "compilerOptions": { "baseUrl": ".", "paths": { "@shared/*": ["nope/*", "src/shared/*"], }, }, }`,
      '/proj/tsconfig.json': `{ /* app */ "extends": "./tsconfig.base.json", }`,
    };
    const code = `import { BaseAggregate } from '@shared/base.aggregate';\nexport class Order extends BaseAggregate {}`;
    const options = { bindings: [AUDITED], files, tsconfig: 'tsconfig.json' as const };
    expect(classifyRoles(options, code)['Order']).toContain('AuditedAggregate');
  });

  it('survives a shebang and CRLF line endings in a project file', () => {
    const files = { [BASE_FILE]: `#!/usr/bin/env node\r\n${BASE_TEXT.replace(/\n/g, '\r\n')}` };
    expect(classifyRoles({ bindings: [AUDITED], files }, USE)['Order']).toEqual([
      'Aggregate',
      'AuditedAggregate',
    ]);
  });

  it('matches implements and extends with one binding', () => {
    const files = { '/proj/src/ports.ts': `export interface Clock {}\nexport class Base {}` };
    const bindings: RoleBinding[] = [
      { role: 'Port', implements: { from: 'src/ports.ts', name: 'Clock' } },
      { role: 'Root', extends: { from: 'src/ports.ts', name: 'Base' } },
    ];
    const code = `import { Clock, Base } from '../ports';\nclass A implements Clock {}\nclass B extends Base {}`;
    expect(classifyRoles({ bindings, files }, code)).toEqual({ A: ['Port'], B: ['Root'] });
  });

  it('matches a library decorator by import source, not by the decorator name', () => {
    const code = [
      `import { CommandHandler } from '@vytches/ddd-cqrs';`,
      `import { CommandHandler as Own } from './own-decorators';`,
      `@CommandHandler(C) class A {}`,
      `@Own(C) class B {}`,
    ].join('\n');
    expect(classifyRoles({}, code)).toEqual({ A: ['CommandHandler'], B: [] });
  });

  // Known gap, tracked outside this suite (src/resolver is outside this layer): the text
  // scanner records only classes and interfaces as locals of a project file, so a decorator
  // declared there as `export function Controller()` / `export const Controller = ...` resolves
  // to no origin, and `checkBindings` reports it as `export-not-found`.

  it('gives every class in a file matching a files glob the role, and its implied roles', () => {
    const bindings: RoleBinding[] = [
      { role: 'Controller', files: 'src/**/*.controller.ts', implies: ['Adapter'] },
    ];
    const code = `class A {} class B {}`;
    expect(classifyRoles({ bindings }, code, '/proj/src/users/user.controller.ts')).toEqual({
      A: ['Adapter', 'Controller'],
      B: ['Adapter', 'Controller'],
    });
    expect(classifyRoles({ bindings }, code, '/proj/src/users/user.service.ts')).toEqual({
      A: [],
      B: [],
    });
  });

  it('adds the roles a custom role implies', () => {
    const bindings: RoleBinding[] = [{ ...AUDITED, implies: ['Entity'] }];
    expect(classifyRoles({ bindings, files: FILES }, USE)['Order']).toEqual([
      'Aggregate',
      'AuditedAggregate',
      'Entity',
    ]);
  });

  it('does not match a same-named export of another file', () => {
    const files = {
      ...FILES,
      '/proj/src/other/base.aggregate.ts': `export class BaseAggregate {}`,
    };
    const code = `import { BaseAggregate } from '../other/base.aggregate';\nexport class Order extends BaseAggregate {}`;
    expect(classifyRoles({ bindings: [AUDITED], files }, code)['Order']).toEqual([]);
  });
});

describe('inheritance depth and cycles', () => {
  const chain = (length: number): Record<string, string> => {
    const files: Record<string, string> = {
      '/proj/src/c0.ts': `import { AggregateRoot } from '@vytches/ddd-aggregates';\nexport class C0 extends AggregateRoot {}`,
    };
    for (let i = 1; i < length; i++) {
      files[`/proj/src/c${i}.ts`] =
        `import { C${i - 1} } from './c${i - 1}';\nexport class C${i} extends C${i - 1} {}`;
    }
    return files;
  };
  const CODE = `import { C5 } from '../c5';\nexport class X extends C5 {}`;

  it('follows a chain of six project classes by default', () => {
    const warnings: ResolverWarning[] = [];
    const roles = classifyRoles({ files: chain(6), onWarning: w => warnings.push(w) }, CODE);
    expect(roles['X']).toEqual(['Aggregate']);
    expect(warnings).toEqual([]);
  });

  it('stops at maxDepth and warns instead of guessing', () => {
    const warnings: ResolverWarning[] = [];
    const roles = classifyRoles(
      { files: chain(6), maxDepth: 2, onWarning: w => warnings.push(w) },
      CODE
    );
    expect(roles['X']).toEqual([]);
    expect(warnings.map(w => w.code)).toEqual(['max-depth']);
  });

  it('terminates on a cyclic hierarchy', () => {
    const files = {
      '/proj/src/a.ts': `import { B } from './b';\nexport class A extends B {}`,
      '/proj/src/b.ts': `import { A } from './a';\nexport class B extends A {}`,
    };
    const code = `import { A } from '../a';\nexport class X extends A {}`;
    expect(classifyRoles({ files }, code)['X']).toEqual([]);
  });
});

describe('file reads (deterministic counter)', () => {
  const FILES = { [BASE_FILE]: BASE_TEXT };
  const bindings = [AUDITED];
  const useIn = (n: number): string =>
    `import { BaseAggregate } from '../shared/base.aggregate';\nexport class Order${n} extends BaseAggregate {}`;

  function setup() {
    const fs = createMemoryFs(FILES);
    const resolver = createRoleResolver({ cwd: CWD, tsconfig: false, bindings, fs });
    const run = (n: number): Roles => {
      const filename = `/proj/src/orders/order-${n}.ts`;
      const code = useIn(n);
      const out: Record<string, string[]> = {};
      for (const c of resolver.classify(parseProgram(code, filename), filename, code)) {
        out[c.name] = [...c.roles].sort();
      }
      return out;
    };
    return { fs, resolver, run };
  }

  it('reads a project base file once however many files extend it', () => {
    const { fs, run } = setup();
    for (let n = 0; n < 25; n++) expect(run(n)[`Order${n}`]).toContain('AuditedAggregate');
    expect(fs.reads.get(BASE_FILE)).toBe(1);
    expect([...fs.reads.values()].every(count => count === 1)).toBe(true);
    expect(fs.totalReads()).toBe(1);
  });

  it('classifies the same program once', () => {
    const { fs, resolver } = setup();
    const filename = '/proj/src/orders/order-0.ts';
    const program = parseProgram(useIn(0), filename);
    const first = resolver.classify(program, filename);
    const statsBefore = fs.stats.get(BASE_FILE) ?? 0;
    expect(resolver.classify(program, filename)).toBe(first);
    expect(fs.stats.get(BASE_FILE) ?? 0).toBe(statsBefore);
  });

  it('reads again after reset()', () => {
    const { fs, resolver, run } = setup();
    run(0);
    resolver.reset();
    run(1);
    expect(fs.reads.get(BASE_FILE)).toBe(2);
  });

  it('re-reads a file whose modification time changed, so an edit changes the roles', () => {
    const { fs, run } = setup();
    expect(run(0)['Order0']).toEqual(['Aggregate', 'AuditedAggregate']);
    fs.write(BASE_FILE, `export class BaseAggregate {}\n`);
    expect(run(1)['Order1']).toEqual(['AuditedAggregate']);
    expect(fs.reads.get(BASE_FILE)).toBe(2);
  });

  it('keeps a missing file missing until reset(), then sees it (negative cache lifetime)', () => {
    const late = '/proj/src/late-base.ts';
    const fs = createMemoryFs({});
    const resolver = createRoleResolver({ cwd: CWD, tsconfig: false, fs });
    const code = `import { LateBase } from '../late-base';\nexport class Late extends LateBase {}`;
    const filename = '/proj/src/orders/late.ts';
    const rolesNow = (): readonly string[] => [
      ...(resolver.classify(parseProgram(code, filename), filename)[0]?.roles ?? []),
    ];

    expect(rolesNow()).toEqual([]);
    fs.write(
      late,
      `import { AggregateRoot } from '@vytches/ddd-aggregates';\nexport class LateBase extends AggregateRoot {}`
    );
    expect(rolesNow()).toEqual([]);
    resolver.reset();
    expect(rolesNow()).toEqual(['Aggregate']);
  });

  it('reads nothing for a file that only uses library bases', () => {
    const fs = createMemoryFs({});
    const resolver = createRoleResolver({ cwd: CWD, tsconfig: false, fs });
    const code = `import { AggregateRoot } from '@vytches/ddd-aggregates';\nexport class A extends AggregateRoot {}`;
    resolver.classify(parseProgram(code), '/proj/src/a.ts', code);
    expect(fs.totalReads()).toBe(0);
  });
});

describe('checkBindings (validation level i)', () => {
  const problems = (bindings: RoleBinding[], files: Record<string, string> = {}) =>
    createRoleResolver({ cwd: CWD, tsconfig: false, bindings, fs: createMemoryFs(files) })
      .checkBindings()
      .map(p => `${p.code}:${p.role}`);

  it('accepts bindings whose file and export exist, and package bindings', () => {
    expect(
      problems([AUDITED, { role: 'Ext', extends: { from: 'some-pkg', name: 'Anything' } }], {
        [BASE_FILE]: BASE_TEXT,
      })
    ).toEqual([]);
  });

  it('reports a binding file that does not exist', () => {
    expect(problems([AUDITED])).toEqual(['file-not-found:AuditedAggregate']);
  });

  it('reports a name the file does not export', () => {
    const files = { [BASE_FILE]: `export class Other {}` };
    expect(problems([AUDITED], files)).toEqual(['export-not-found:AuditedAggregate']);
  });

  it('reports a binding that can never match', () => {
    expect(problems([{ role: 'Nothing' }])).toEqual(['empty-binding:Nothing']);
  });

  it('reports an invalid files glob', () => {
    expect(problems([{ role: 'Broken', files: 'src/{a,b' }])).toEqual(['invalid-glob:Broken']);
  });

  it('never reports the built-in vocabulary', () => {
    expect(problems([])).toEqual([]);
  });

  it('follows a facade when checking that an export exists', () => {
    const files = {
      '/proj/src/shared/index.ts': `export { BaseAggregate } from './base.aggregate';`,
      [BASE_FILE]: BASE_TEXT,
    };
    const binding: RoleBinding = {
      role: 'Facade',
      extends: { from: 'src/shared/index.ts', name: 'BaseAggregate' },
    };
    expect(problems([binding], files)).toEqual([]);
  });
});

describe('result shape', () => {
  it('exposes warnings as a live list that reset() clears', () => {
    const resolver = createRoleResolver({
      cwd: CWD,
      tsconfig: false,
      fs: createMemoryFs({}),
      maxDepth: 1,
    });
    expect(resolver.warnings).toEqual([]);
    resolver.reset();
    expect(resolver.warnings).toEqual([]);
  });

  it('returns AST nodes of the classes it classified', () => {
    const code = `import { AggregateRoot } from '@vytches/ddd-aggregates';\nclass A extends AggregateRoot {}`;
    const program = parseProgram(code);
    const resolver = createRoleResolver({ cwd: CWD, tsconfig: false, fs: createMemoryFs({}) });
    const [hit] = resolver.classify(program, '/proj/src/a.ts');
    const declared = (program['body'] as AstNode[]).find(n => n.type === 'ClassDeclaration');
    expect(hit?.node).toBe(declared);
  });
});
