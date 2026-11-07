// Role names as a consumer sees them (D4, D6): the public `resolveRole` must hand out exactly
// these names for classes written the way the library's documentation shows. A role removed or
// renamed fails here, and so does a role that stops being recognised through its binding.
import * as tsParser from '@typescript-eslint/parser';
import { describe, expect, it } from 'vitest';
import { createRoleResolver, resolveRole, type LibraryRoleName } from '../../src';
import type { ResolverFs } from '../../src';
// The vocabulary is deliberately not a public export (D6): the only consumer-facing view is
// `resolveRole`. The names-versus-real-exports check below needs the data itself, so it reads it
// from the internal module; every other assertion in this file goes through the public entry.
import { ENTERPRISE_PACKAGE, LIBRARY_ROLES } from '../../src/roles';
import { exportedNamesOfPackage } from './helpers/package-exports';

type AstNode = Parameters<typeof resolveRole>[0]['node'];

const FILE = '/project/src/sample.ts';
const NO_FILES: ResolverFs = { readFile: () => undefined, stat: () => undefined };

/** Every library role with the class forms that must resolve to it. */
const SAMPLES: Readonly<Record<LibraryRoleName, readonly string[]>> = {
  Aggregate: [
    `import { AggregateRoot } from '@vytches/ddd-aggregates';\nclass Sample extends AggregateRoot<string> {}`,
  ],
  Entity: [
    `import { Entity } from '@vytches/ddd-aggregates';\nclass Sample extends Entity<string> {}`,
  ],
  ValueObject: [
    `import { BaseValueObject } from '@vytches/ddd-value-objects';\nclass Sample extends BaseValueObject<{}> {}`,
  ],
  DomainEvent: [
    `import { DomainEvent } from '@vytches/ddd-events';\nclass Sample extends DomainEvent {}`,
  ],
  IntegrationEvent: [
    `import { IntegrationEvent } from '@vytches/ddd-events';\nclass Sample extends IntegrationEvent {}`,
  ],
  Command: [`import { ICommand } from '@vytches/ddd-cqrs';\nclass Sample implements ICommand {}`],
  Query: [`import { IQuery } from '@vytches/ddd-cqrs';\nclass Sample implements IQuery {}`],
  CommandHandler: [
    `import { CommandHandler } from '@vytches/ddd-cqrs';\n@CommandHandler(Cmd)\nclass Sample {}`,
    `import { ICommandHandler } from '@vytches/ddd-cqrs';\nclass Sample implements ICommandHandler<Cmd> {}`,
  ],
  QueryHandler: [
    `import { QueryHandler } from '@vytches/ddd-cqrs';\n@QueryHandler(Qry)\nclass Sample {}`,
    `import { IQueryHandler } from '@vytches/ddd-cqrs';\nclass Sample implements IQueryHandler<Qry> {}`,
  ],
  EventHandler: [
    `import { EventHandler } from '@vytches/ddd-events';\n@EventHandler(Evt)\nclass Sample {}`,
    `import { IEventHandler } from '@vytches/ddd-contracts';\nclass Sample implements IEventHandler<Evt> {}`,
  ],
  DomainService: [
    `import { DomainService } from '@vytches/ddd-domain-services';\n@DomainService()\nclass Sample {}`,
    `import { PlainDomainService } from '@vytches/ddd-domain-services';\nclass Sample extends PlainDomainService {}`,
  ],
  Repository: [
    `import { IBaseRepository } from '@vytches/ddd-repositories';\nclass Sample implements IBaseRepository<Agg, string> {}`,
  ],
  Specification: [
    `import { CompositeSpecification } from '@vytches/ddd-validation';\nclass Sample extends CompositeSpecification<Cand> {}`,
  ],
  Policy: [
    `import { BaseBusinessPolicy } from '@vytches/ddd-policies';\nclass Sample extends BaseBusinessPolicy<Ctx> {}`,
  ],
  ACLAdapter: [
    `import { BaseACLAdapter } from '@vytches/ddd-acl';\nclass Sample extends BaseACLAdapter<A, B> {}`,
  ],
};

function rolesOf(code: string): readonly string[] {
  const { ast } = tsParser.parseForESLint(code, {
    filePath: FILE,
    sourceType: 'module',
    range: true,
    loc: true,
  });
  const program = ast as unknown as Parameters<typeof resolveRole>[0]['program'];
  const body = (program as unknown as { body: AstNode[] }).body;
  const cls = body.find(
    n => n.type === 'ClassDeclaration' || n.type === 'ExportNamedDeclaration'
  ) as AstNode;
  const node = (cls.type === 'ExportNamedDeclaration' ? cls['declaration'] : cls) as AstNode;
  const resolver = createRoleResolver({ cwd: '/project', tsconfig: false, fs: NO_FILES });
  return resolveRole({ resolver, program, filename: FILE, node });
}

describe('library role vocabulary as seen through resolveRole', () => {
  it('knows exactly the documented roles', () => {
    expect(Object.keys(SAMPLES).sort()).toEqual(
      [
        'ACLAdapter',
        'Aggregate',
        'Command',
        'CommandHandler',
        'DomainEvent',
        'DomainService',
        'Entity',
        'EventHandler',
        'IntegrationEvent',
        'Policy',
        'Query',
        'QueryHandler',
        'Repository',
        'Specification',
        'ValueObject',
      ].sort()
    );
  });

  for (const [role, samples] of Object.entries(SAMPLES)) {
    it.each(samples.map((code, i) => [i, code] as const))(
      `${role}: form %i resolves to the role`,
      (_i, code) => {
        expect(rolesOf(code)).toContain(role);
      }
    );
  }

  it('does not hand a role to a class that merely has the same base name from elsewhere', () => {
    expect(
      rolesOf(
        `import { AggregateRoot } from 'some-other-lib';\nclass Sample extends AggregateRoot {}`
      )
    ).toEqual([]);
    expect(rolesOf(`class AggregateRoot {}\nclass Sample extends AggregateRoot {}`)).toEqual([]);
  });

  it('gives a plain class no role', () => {
    expect(rolesOf(`class Sample {}`)).toEqual([]);
  });
});

describe('library role vocabulary against the real packages', () => {
  const targets = LIBRARY_ROLES.flatMap(def => [
    ...def.bases.map(t => ({ role: def.role, via: 'base', ...t })),
    ...def.decorators.map(t => ({ role: def.role, via: 'decorator', ...t })),
  ]);
  const packages = [...new Set(targets.map(t => t.from))].sort();

  it('covers every role of the documented samples', () => {
    expect(LIBRARY_ROLES.map(def => def.role).sort()).toEqual(Object.keys(SAMPLES).sort());
  });

  it.each(packages)(
    '%s exports every vocabulary name bound to it',
    pkg => {
      expect(pkg).not.toBe(ENTERPRISE_PACKAGE);
      const exported = exportedNamesOfPackage(pkg);
      expect(exported.size, `${pkg}: barrel could not be read or exports nothing`).toBeGreaterThan(
        0
      );
      const missing = targets
        .filter(t => t.from === pkg && !exported.has(t.name))
        .map(t => `${t.role} (${t.via}) -> ${t.name}`);
      expect(missing, `${pkg}: vocabulary names that no longer exist in its exports`).toEqual([]);
    },
    60_000
  );

  it('binds every sample import of this file to a pair the vocabulary really holds', () => {
    const known = new Set(targets.map(t => `${t.from}#${t.name}`));
    const importPattern = /import \{ (\w+) \} from '(@vytches\/ddd-[\w-]+)'/;
    for (const [role, samples] of Object.entries(SAMPLES)) {
      for (const code of samples) {
        const match = importPattern.exec(code);
        expect(match, `${role}: sample has no library import`).not.toBeNull();
        expect(
          known.has(`${match![2]}#${match![1]}`),
          `${role}: ${match![1]} from ${match![2]}`
        ).toBe(true);
      }
    }
  });
});
