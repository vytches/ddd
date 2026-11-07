import * as tsParser from '@typescript-eslint/parser';
import { describe, expect, it } from 'vitest';
import { validateRoleConfig, type AstNode, type RoleBinding } from '../../../src/resolver';
import { createMemoryFs } from '../helpers/memory-fs';

const BASE_FILE = '/proj/src/shared/base.aggregate.ts';
const AUDITED: RoleBinding = {
  role: 'AuditedAggregate',
  extends: { from: 'src/shared/base.aggregate.ts', name: 'BaseAggregate' },
};
const FILES: Record<string, string> = {
  [BASE_FILE]: `import { AggregateRoot } from '@vytches/ddd-aggregates';\nexport class BaseAggregate extends AggregateRoot<string> {}\n`,
  '/proj/src/orders/order.ts': `import { BaseAggregate } from '../shared/base.aggregate';\nexport class Order extends BaseAggregate {}\n`,
  '/proj/src/orders/plain.ts': `export class Plain {}\n`,
  '/proj/src/orders/no-classes.ts': `export const a = 1;\n`,
};
const ALL = Object.keys(FILES).map(path => path.replace('/proj/', ''));

const parse = (text: string, filename: string): AstNode =>
  tsParser.parseForESLint(text, {
    filePath: filename,
    sourceType: 'module',
    range: true,
    loc: true,
  }).ast as unknown as AstNode;

const run = (
  bindings: RoleBinding[],
  extra: Partial<Parameters<typeof validateRoleConfig>[0]> = {}
) =>
  validateRoleConfig({
    cwd: '/proj',
    tsconfig: false,
    bindings,
    files: ALL,
    fs: createMemoryFs(FILES),
    parse,
    ...extra,
  });

describe('validateRoleConfig (validation level ii)', () => {
  it('is ok when every declared role matches a class', async () => {
    const result = await run([AUDITED]);
    expect(result).toMatchObject({ ok: true, problems: [] });
    expect(result.unparsedFiles).toBe(0);
  });

  it('reports a declared role that matches no class, with the number of scanned files', async () => {
    const result = await run([{ role: 'Unused', extends: { from: 'some-pkg', name: 'Nothing' } }]);
    expect(result.ok).toBe(false);
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0]).toMatchObject({ code: 'role-matches-nothing', role: 'Unused' });
    expect(result.problems[0]?.message).toContain('Unused');
    // the file without the word "class" is not scanned
    expect(result.scannedFiles).toBe(3);
  });

  it('reports a binding that cannot be resolved (level i) alongside the unmatched role', async () => {
    const result = await run([
      { role: 'Ghost', extends: { from: 'src/missing.ts', name: 'Ghost' } },
    ]);
    expect(result.problems.map(p => p.code).sort()).toEqual([
      'file-not-found',
      'role-matches-nothing',
    ]);
  });

  it('stops scanning as soon as every declared role was matched', async () => {
    const result = await run([AUDITED]);
    expect(result.scannedFiles).toBeLessThan(3);
  });

  it('never reports the built-in vocabulary and scans nothing without project roles', async () => {
    const result = await run([]);
    expect(result).toEqual({ ok: true, problems: [], scannedFiles: 0, unparsedFiles: 0 });
  });

  it('counts files the parser rejects instead of failing the run', async () => {
    const result = await run([{ role: 'Unused', extends: { from: 'some-pkg', name: 'Nothing' } }], {
      parse: () => {
        throw new Error('syntax error');
      },
    });
    expect(result.unparsedFiles).toBe(3);
    expect(result.problems.map(p => p.code)).toEqual(['role-matches-nothing']);
  });

  it('skips unreadable files', async () => {
    const result = await run([AUDITED], { files: ['src/does-not-exist.ts'] });
    expect(result.scannedFiles).toBe(0);
    expect(result.problems.map(p => p.code)).toEqual(['role-matches-nothing']);
  });

  it('is deterministic: two runs over the same input give the same result', async () => {
    const bindings = [AUDITED, { role: 'Unused', extends: { from: 'some-pkg', name: 'Nothing' } }];
    expect(await run(bindings)).toEqual(await run(bindings));
  });
});
