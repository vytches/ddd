import { noInstanceofResult } from '../../../src/rules/no-instanceof-result';
import { createRuleTester, VIRTUAL_FILE } from '../helpers/rule-tester';

const IMPORT = `import { Result } from '@vytches/ddd-utils';`;

createRuleTester().run('no-instanceof-result', noInstanceofResult, {
  valid: [
    { code: `${IMPORT} if (r.isSuccess) { run(); }`, filename: VIRTUAL_FILE },
    { code: `${IMPORT} const ok = x instanceof Error;`, filename: VIRTUAL_FILE },
    // Result is not imported: nothing ties it to the library
    { code: `const ok = x instanceof Result;`, filename: VIRTUAL_FILE },
    // same name, other package
    {
      code: `import { Result } from 'neverthrow'; const ok = x instanceof Result;`,
      filename: VIRTUAL_FILE,
    },
    // project class of the same name
    { code: `class Result {} const ok = x instanceof Result;`, filename: VIRTUAL_FILE },
    // a parameter shadows the import
    {
      code: `${IMPORT} function f(Result: new () => object, x: unknown) { return x instanceof Result; }`,
      filename: VIRTUAL_FILE,
    },
    // another member of the library
    {
      code: `import { Result } from '@vytches/ddd-utils'; const ok = x instanceof Result.constructor;`,
      filename: VIRTUAL_FILE,
    },
  ],
  invalid: [
    {
      code: `${IMPORT} const ok = x instanceof Result;`,
      filename: VIRTUAL_FILE,
      errors: [{ messageId: 'instanceofResult' }],
    },
    {
      code: `import { Result as R } from '@vytches/ddd-utils'; const ok = x instanceof R;`,
      filename: VIRTUAL_FILE,
      errors: [{ messageId: 'instanceofResult' }],
    },
    {
      code: `import * as utils from '@vytches/ddd-utils'; const ok = x instanceof utils.Result;`,
      filename: VIRTUAL_FILE,
      errors: [{ messageId: 'instanceofResult' }],
    },
    {
      code: `import { Result } from '@vytches/ddd'; const ok = x instanceof Result;`,
      filename: VIRTUAL_FILE,
      errors: [{ messageId: 'instanceofResult' }],
    },
    {
      code: `${IMPORT} const R = Result; const ok = x instanceof R;`,
      filename: VIRTUAL_FILE,
      errors: [{ messageId: 'instanceofResult' }],
    },
    {
      code: `${IMPORT} const ok = x instanceof (Result as typeof Result);`,
      filename: VIRTUAL_FILE,
      errors: [{ messageId: 'instanceofResult' }],
    },
    // the message options replace Fix and add a tag
    {
      code: `${IMPORT} const ok = x instanceof Result;`,
      filename: VIRTUAL_FILE,
      options: [{ id: 'ERR1', fix: 'Call result.match()' }],
      errors: [
        {
          message:
            '[ERR1] `instanceof Result` is used to test a Result. Result class identity differs across bundles and duplicated package copies, so the check can be false for a genuine Result. Fix: Call result.match(). See: https://github.com/vytches/ddd/blob/main/packages/utils/LLMGUIDE.md#anti-patterns',
        },
      ],
    },
  ],
});
