import { describe, expect, it } from 'vitest';
import { createRoleResolver, resolveRole, type AstNode } from '../../../src/resolver';
import { createMemoryFs } from '../helpers/memory-fs';
import { parseProgram } from '../helpers/parse';

const CODE = [
  `import { AggregateRoot } from '@vytches/ddd-aggregates';`,
  `export class Order extends AggregateRoot<string> {}`,
  `export class Plain {}`,
  `export function helper() {}`,
].join('\n');

const FILE = '/proj/src/order.ts';
const resolver = createRoleResolver({ cwd: '/proj', tsconfig: false, fs: createMemoryFs({}) });
const program = parseProgram(CODE, FILE);
const body = program['body'] as AstNode[];
const classNode = (name: string): AstNode =>
  body
    .map(n => (n.type === 'ExportNamedDeclaration' ? (n['declaration'] as AstNode) : n))
    .find(n => n.type === 'ClassDeclaration' && n['id'].name === name) as AstNode;

describe('resolveRole', () => {
  it('returns the roles of the given class node', () => {
    expect(resolveRole({ resolver, program, filename: FILE, node: classNode('Order') })).toEqual([
      'Aggregate',
    ]);
  });

  it('returns an empty array for a class without a role', () => {
    expect(resolveRole({ resolver, program, filename: FILE, node: classNode('Plain') })).toEqual(
      []
    );
  });

  it('returns an empty array for a node that is not a class of the program', () => {
    const fn = body.find(
      n => n.type === 'ExportNamedDeclaration' && n['declaration'].type === 'FunctionDeclaration'
    );
    expect(resolveRole({ resolver, program, filename: FILE, node: fn as AstNode })).toEqual([]);
    expect(
      resolveRole({ resolver, program, filename: FILE, node: { type: 'ClassDeclaration' } })
    ).toEqual([]);
  });

  it('returns a fresh array, so a caller cannot change the resolver cache', () => {
    const first = resolveRole({
      resolver,
      program,
      filename: FILE,
      node: classNode('Order'),
    }) as string[];
    first.push('Tampered');
    expect(resolveRole({ resolver, program, filename: FILE, node: classNode('Order') })).toEqual([
      'Aggregate',
    ]);
  });
});
