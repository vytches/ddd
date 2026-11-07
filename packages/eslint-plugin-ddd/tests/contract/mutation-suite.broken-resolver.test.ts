// Proof that the mutation corpus can fail (D5/LT): the origin resolver is replaced by degraded
// versions, and the same corpus must report missed violations or false alarms for each of them.
// A suite that stays green against a broken resolver would be worthless as a gate.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildMutationCases, runMutationSuite } from './mutation';

const broken = vi.hoisted(() => ({
  mode: 'none' as 'none' | 'blind-to-project-files' | 'direct-imports-only',
}));

vi.mock('../../src/resolver/origin', async importOriginal => {
  const actual = await importOriginal<typeof import('../../src/resolver/origin')>();
  return {
    ...actual,
    resolveName: ((host, file, model, root, rest) => {
      if (broken.mode === 'blind-to-project-files') {
        // Regression: project files cannot be read, so no re-export is followed.
        const blind = { model: () => undefined, resolve: () => undefined };
        return actual.resolveName(blind as typeof host, file, model, root, rest);
      }
      if (broken.mode === 'direct-imports-only') {
        // Regression: member access on a name (`lib.Name`, `Name.member`) is not resolved.
        return rest.length > 0 ? [] : actual.resolveName(host, file, model, root, rest);
      }
      return actual.resolveName(host, file, model, root, rest);
    }) as typeof actual.resolveName,
  };
});

const cases = buildMutationCases();

describe('mutation corpus against a deliberately broken resolver', () => {
  afterEach(() => {
    broken.mode = 'none';
  });

  it('is green with the real resolver (control)', () => {
    const report = runMutationSuite(cases);
    expect(report.missed).toEqual([]);
    expect(report.falseAlarms).toEqual([]);
    expect(report.parseErrors).toEqual([]);
  });

  it('goes red when the resolver cannot follow project files (facades)', () => {
    broken.mode = 'blind-to-project-files';
    const report = runMutationSuite(cases);
    expect(report.missed.length).toBeGreaterThan(0);
    expect(report.missed.some(id => id.includes('facade'))).toBe(true);
  });

  it('goes red when the resolver only handles bare names', () => {
    broken.mode = 'direct-imports-only';
    const report = runMutationSuite(cases);
    expect(report.missed.length).toBeGreaterThan(0);
    expect(report.missed.some(id => id.includes('namespace'))).toBe(true);
  });
});
