import { RuleTester } from 'eslint';
import * as tsParser from '@typescript-eslint/parser';
import { describe, it } from 'vitest';
import { RULE_MESSAGES } from '../../../src/messages';
import { messageData, type MessageSpec } from '../../../src/messages/format';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

/** A virtual project file: nothing is read from disk for it, so only import sources matter. */
export const VIRTUAL_FILE = '/virtual/src/domain/file.ts';

/** RuleTester over TypeScript sources with tsconfig lookup switched off (no disk access). */
export function createRuleTester(): RuleTester {
  return new RuleTester({
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    settings: { ddd: { tsconfig: false } },
  });
}

/**
 * `data` for a RuleTester error: RuleTester interpolates it into the rendered template, which
 * still holds the `{{tag}}`, `{{fix}}` and `{{see}}` slots, so those come from the same
 * `messageData` the rules use while the message-specific values stay explicit in the test.
 */
export function msg<R extends keyof typeof RULE_MESSAGES>(
  rule: R,
  id: keyof (typeof RULE_MESSAGES)[R] & string,
  data: Readonly<Record<string, string>> = {}
): Record<string, string> {
  const spec = (RULE_MESSAGES[rule] as unknown as Record<string, MessageSpec>)[id] as MessageSpec;
  return messageData(spec, undefined, data);
}
