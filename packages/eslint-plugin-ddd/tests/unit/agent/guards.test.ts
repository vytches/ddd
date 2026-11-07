import { describe, expect, it } from 'vitest';
import {
  isAgentSeverity,
  isLintConfigError,
  isLintOk,
  isLintParseError,
  isLintSkipped,
} from '../../../src/agent/guards';
import type { AgentLintResult } from '../../../src/agent/types';

const ok: AgentLintResult = { status: 'ok', findings: [] };
const skipped: AgentLintResult = { status: 'skipped', reason: 'ignored' };
const parseError: AgentLintResult = { status: 'parse-error', message: 'Unexpected token' };
const configError: AgentLintResult = { status: 'config-error', message: 'no parser' };

describe('isAgentSeverity', () => {
  it('accepts error and warn', () => {
    expect(isAgentSeverity('error')).toBe(true);
    expect(isAgentSeverity('warn')).toBe(true);
  });

  it('rejects other values', () => {
    expect(isAgentSeverity('off')).toBe(false);
    expect(isAgentSeverity(2)).toBe(false);
    expect(isAgentSeverity(undefined)).toBe(false);
  });
});

describe('AgentLintResult guards', () => {
  const cases: ReadonlyArray<readonly [string, AgentLintResult]> = [
    ['ok', ok],
    ['skipped', skipped],
    ['parse-error', parseError],
    ['config-error', configError],
  ];
  const guards: Readonly<Record<string, (r: AgentLintResult) => boolean>> = {
    ok: isLintOk,
    skipped: isLintSkipped,
    'parse-error': isLintParseError,
    'config-error': isLintConfigError,
  };

  for (const [status, result] of cases) {
    it(`only the ${status} guard matches a ${status} result`, () => {
      for (const [name, guard] of Object.entries(guards)) {
        expect(guard(result)).toBe(name === status);
      }
    });
  }

  it('narrows the result so variant fields are accessible', () => {
    const result: AgentLintResult = ok;
    if (!isLintOk(result)) {
      throw new Error('expected ok');
    }
    expect(result.findings).toEqual([]);
  });
});
