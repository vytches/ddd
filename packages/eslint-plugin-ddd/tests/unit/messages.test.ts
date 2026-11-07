import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RULE_MESSAGES } from '../../src/messages';
import { REPO_BLOB_URL, ruleDocsUrl } from '../../src/messages/docs-links';
import { messageData, renderTemplate, interpolate } from '../../src/messages/format';
import { rules } from '../../src/rules';

const PACKAGE_ROOT = resolve(__dirname, '..', '..');
const REPO_ROOT = resolve(PACKAGE_ROOT, '..', '..');

/** GitHub heading anchor: lower case, punctuation dropped, spaces to dashes. */
function anchorOf(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

function anchorsIn(markdownPath: string): ReadonlySet<string> {
  const text = readFileSync(markdownPath, 'utf8');
  const out = new Set<string>();
  for (const line of text.split('\n')) {
    const match = /^#{1,6}\s+(.+?)\s*#*$/.exec(line);
    if (match?.[1]) out.add(anchorOf(match[1]));
  }
  return out;
}

const entries = Object.entries(RULE_MESSAGES).flatMap(([rule, messages]) =>
  Object.entries(messages).map(([id, spec]) => ({ rule, id, spec }))
);

describe('AC-MESSAGES: every rule', () => {
  it('has messages and every rule with messages exists in the plugin', () => {
    expect(Object.keys(RULE_MESSAGES).sort()).toEqual(Object.keys(rules).sort());
  });

  describe.each(Object.entries(rules))('%s', (name, rule) => {
    it('points meta.docs.url at an existing docs page', () => {
      const url = rule.meta?.docs?.url;
      expect(url).toBe(ruleDocsUrl(name));
      expect(url?.startsWith(REPO_BLOB_URL)).toBe(true);
      expect(existsSync(resolve(PACKAGE_ROOT, 'docs', 'rules', `${name}.md`))).toBe(true);
    });

    it('declares the message options schema and a rendered message per id', () => {
      expect(rule.meta?.schema).toHaveLength(1);
      expect(Object.keys(rule.meta?.messages ?? {}).sort()).toEqual(
        Object.keys(RULE_MESSAGES[name as keyof typeof RULE_MESSAGES]).sort()
      );
    });

    it('renders every message as an instruction with Fix: and See:', () => {
      for (const template of Object.values(rule.meta?.messages ?? {})) {
        expect(template).toContain(' Fix: ');
        expect(template).toContain(' See: ');
      }
    });
  });
});

describe('AC-MESSAGES: message specs', () => {
  it.each(entries)('$rule/$id has non-empty what, why, fix and see', ({ spec }) => {
    for (const part of [spec.what, spec.why, spec.fix, spec.see]) {
      expect(part.trim().length).toBeGreaterThan(0);
    }
  });

  it.each(entries)('$rule/$id links to a LLMGUIDE heading that exists', ({ spec }) => {
    const match =
      /^https:\/\/github\.com\/vytches\/ddd\/blob\/main\/packages\/([\w-]+)\/LLMGUIDE\.md#([\w-]+)$/.exec(
        spec.see
      );
    expect(match, `unexpected link shape: ${spec.see}`).not.toBeNull();
    const [, pkg, anchor] = match as RegExpExecArray;
    const guide = resolve(REPO_ROOT, 'packages', pkg as string, 'LLMGUIDE.md');
    expect(existsSync(guide), `${guide} does not exist`).toBe(true);
    expect([...anchorsIn(guide)]).toContain(anchor);
  });

  it.each(entries)(
    '$rule/$id keeps placeholders consistent across what, why and fix',
    ({ spec }) => {
      const names = (text: string): string[] =>
        [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map(m => m[1] as string);
      const known = new Set([
        'name',
        'source',
        'package',
        'method',
        'replacement',
        'missing',
        'calls',
      ]);
      for (const placeholder of [...names(spec.what), ...names(spec.why), ...names(spec.fix)]) {
        expect(known.has(placeholder), `unknown placeholder ${placeholder}`).toBe(true);
      }
    }
  );
});

describe('message format', () => {
  const spec = {
    what: 'X is wrong.',
    why: 'because it breaks',
    fix: 'Do {{thing}}',
    see: 'https://e/x',
  };

  it('renders what, why, Fix and See in a fixed order with single periods', () => {
    expect(renderTemplate(spec)).toBe(
      '{{tag}}X is wrong. Because it breaks. Fix: {{fix}} See: {{see}}'
    );
  });

  it('fills placeholders and leaves unknown ones as written', () => {
    expect(interpolate('a {{x}} b {{y}}', { x: '1' })).toBe('a 1 b {{y}}');
  });

  it('applies overrides for tag, fix and see and always ends the fix with one period', () => {
    expect(messageData(spec, undefined, { thing: 'it' })).toMatchObject({
      tag: '',
      fix: 'Do it.',
      see: 'https://e/x',
      thing: 'it',
    });
    expect(messageData(spec, { id: 'PA1', fix: 'Do that...', see: 'https://o/y' })).toMatchObject({
      tag: '[PA1] ',
      fix: 'Do that.',
      see: 'https://o/y',
    });
  });
});
