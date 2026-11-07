import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { createAgentLinter } from '../../../src/agent/create-agent-linter';

const cwd = mkdtempSync(join(tmpdir(), 'ddd-agent-'));
afterAll(() => rmSync(cwd, { recursive: true, force: true }));

const VIOLATION = `import { Result } from '@vytches/ddd-contracts';
export const isResult = (v: unknown) => v instanceof Result;
`;
const CLEAN = `export const answer = 42;\n`;
const file = (name: string): string => join(cwd, 'src', name);

describe('createAgentLinter', () => {
  it('reports the plugin findings of proposed content for a file that does not exist', async () => {
    const result = await createAgentLinter({ cwd }).lintText(VIOLATION, file('a.ts'));
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.findings.map(f => f.ruleId)).toEqual(['ddd/no-instanceof-result']);
    expect(result.findings[0]?.message).toContain('Fix:');
  });

  it('returns ok with no findings for clean text', async () => {
    const result = await createAgentLinter({ cwd }).lintText(CLEAN, file('b.ts'));
    expect(result).toEqual({ status: 'ok', findings: [] });
  });

  it('ignores eslint-disable comments by default and honours them when asked', async () => {
    const disabled = `/* eslint-disable ddd/no-instanceof-result */\n${VIOLATION}`;
    const strict = await createAgentLinter({ cwd }).lintText(disabled, file('c.ts'));
    const lenient = await createAgentLinter({ cwd, noInlineConfig: false }).lintText(
      disabled,
      file('c.ts')
    );
    expect(strict.status === 'ok' && strict.findings.length).toBe(1);
    expect(lenient.status === 'ok' && lenient.findings.length).toBe(0);
  });

  it('does not report unused disable directives as findings', async () => {
    const text = `/* eslint-disable no-console */\n${CLEAN}`;
    const result = await createAgentLinter({ cwd, noInlineConfig: false }).lintText(
      text,
      file('d.ts')
    );
    expect(result).toEqual({ status: 'ok', findings: [] });
  });

  it('reports a syntax error as parse-error, not as findings', async () => {
    const result = await createAgentLinter({ cwd }).lintText('export const = ;', file('e.ts'));
    expect(result.status).toBe('parse-error');
  });

  it('reports a file the config does not cover as skipped', async () => {
    const result = await createAgentLinter({ cwd }).lintText('# title', file('notes.md'));
    expect(result.status).toBe('skipped');
  });

  it('turns a configuration ESLint cannot load into config-error', async () => {
    const lane = createAgentLinter({
      cwd,
      config: [{ files: ['**/*.ts'], rules: { 'ddd/does-not-exist': 'error' } }],
    });
    const result = await lane.lintText(CLEAN, file('f.ts'));
    expect(result.status).toBe('config-error');
  });

  it('resets the given resolvers before every call', async () => {
    const reset = vi.fn();
    const lane = createAgentLinter({ cwd, resettables: [{ reset }] });
    await lane.lintText(CLEAN, file('g.ts'));
    await lane.lintText(CLEAN, file('g.ts'));
    expect(reset).toHaveBeenCalledTimes(2);
  });

  it('honours custom prefixes by filtering out the plugin findings', async () => {
    const result = await createAgentLinter({ cwd, rulePrefixes: ['other/'] }).lintText(
      VIOLATION,
      file('h.ts')
    );
    expect(result).toEqual({ status: 'ok', findings: [] });
  });
});
