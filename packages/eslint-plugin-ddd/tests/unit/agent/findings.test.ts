import type { Linter } from 'eslint';
import { describe, expect, it } from 'vitest';
import { newFindings, toFindings } from '../../../src/agent/findings';
import type { AgentFinding } from '../../../src/agent/types';

const msg = (over: Partial<Linter.LintMessage>): Linter.LintMessage => ({
  ruleId: 'ddd/no-instanceof-result',
  severity: 2,
  message: 'boom',
  line: 1,
  column: 1,
  ...over,
});

const finding = (message: string, line = 1): AgentFinding => ({
  ruleId: 'ddd/x',
  severity: 'error',
  message,
  line,
  column: 1,
});

describe('toFindings', () => {
  it('keeps only prefixed rule ids and drops rule-less and fatal messages', () => {
    const out = toFindings(
      [
        msg({}),
        msg({ ruleId: null, message: 'Unused eslint-disable directive' }),
        msg({ ruleId: 'other/rule' }),
        msg({ fatal: true, ruleId: null }),
      ],
      ['ddd/'],
      'error'
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.ruleId).toBe('ddd/no-instanceof-result');
  });

  it('drops warnings at minSeverity error and keeps them at warn', () => {
    const messages = [msg({ severity: 1 }), msg({ severity: 2 })];
    expect(toFindings(messages, ['ddd/'], 'error').map(f => f.severity)).toEqual(['error']);
    expect(toFindings(messages, ['ddd/'], 'warn').map(f => f.severity)).toEqual(['warn', 'error']);
  });

  it('copies end positions only when ESLint provides them', () => {
    const [plain] = toFindings([msg({})], ['ddd/'], 'error');
    const [ranged] = toFindings([msg({ endLine: 2, endColumn: 5 })], ['ddd/'], 'error');
    expect(plain).not.toHaveProperty('endLine');
    expect(ranged).toMatchObject({ endLine: 2, endColumn: 5 });
  });
});

describe('newFindings', () => {
  it('ignores line shifts: a pre-existing finding that moved is not new', () => {
    expect(newFindings([finding('a', 3)], [finding('a', 9)])).toEqual([]);
  });

  it('counts duplicates: two before and three after leaves one new', () => {
    const fresh = newFindings(
      [finding('a'), finding('a')],
      [finding('a'), finding('a', 4), finding('a', 8)]
    );
    expect(fresh).toEqual([finding('a', 8)]);
  });

  it('returns everything for an empty baseline and does not mutate inputs', () => {
    const after = [finding('a'), finding('b')];
    const before: AgentFinding[] = [];
    expect(newFindings(before, after)).toEqual(after);
    expect(before).toEqual([]);
    expect(after).toHaveLength(2);
  });
});
