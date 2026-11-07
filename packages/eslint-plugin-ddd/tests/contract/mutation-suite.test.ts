// Mutation corpus (LT1/LT2, D5): for every rule, violations injected in every way project code
// can reach the library symbol, and valid variants that must stay silent. 100% detection and no
// false alarm are required; the companion test (mutation-suite.broken-resolver.test.ts) proves
// this suite goes red when resolution is degraded.
import { describe, expect, it } from 'vitest';
import { rules } from '../../src';
import { buildMutationCases, runMutationSuite } from './mutation';

const cases = buildMutationCases();
const ruleNames = Object.keys(rules).sort();

// Shapes of access every symbol-based rule is mutated with (D5: direct import, alias, namespace,
// facade, const-alias, cast).
const REQUIRED_VARIANT_PREFIXES = [
  'direct',
  'alias',
  'namespace',
  'facade-',
  'const-alias',
  'cast-',
];

describe('mutation corpus', () => {
  it('has violations and valid variants for every rule of the plugin', () => {
    for (const rule of ruleNames) {
      const own = cases.filter(c => c.rule === rule);
      expect(
        own.filter(c => c.kind === 'violation').length,
        `${rule}: violations`
      ).toBeGreaterThanOrEqual(10);
      expect(
        own.filter(c => c.kind === 'valid').length,
        `${rule}: valid variants`
      ).toBeGreaterThanOrEqual(10);
    }
    expect(new Set(cases.map(c => c.rule))).toEqual(new Set(ruleNames));
  });

  it('mutates each symbol-based rule in every required shape of access', () => {
    const symbolRules = ruleNames.filter(r => r !== 'no-internal-imports');
    for (const rule of symbolRules) {
      const variants = cases
        .filter(c => c.rule === rule && c.kind === 'violation')
        .map(c => c.variant);
      for (const prefix of REQUIRED_VARIANT_PREFIXES) {
        expect(
          variants.some(v => v.startsWith(prefix)),
          `${rule}: no violation variant starting with "${prefix}"`
        ).toBe(true);
      }
    }
  });

  it('uses unique case ids', () => {
    expect(new Set(cases.map(c => c.id)).size).toBe(cases.length);
  });
});

describe('plugin rules against the mutation corpus', () => {
  const report = runMutationSuite(cases);

  it('parses every case (a broken case would prove nothing)', () => {
    expect(report.parseErrors).toEqual([]);
  });

  it('reports 100% of the injected violations', () => {
    expect(report.missed).toEqual([]);
    expect(report.violations).toBeGreaterThan(0);
  });

  it('raises no false alarm on valid variants', () => {
    expect(report.falseAlarms).toEqual([]);
    expect(report.valid).toBeGreaterThan(0);
  });
});
