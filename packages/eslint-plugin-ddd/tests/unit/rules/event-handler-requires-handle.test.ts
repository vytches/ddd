import { eventHandlerRequiresHandle } from '../../../src/rules/event-handler-requires-handle';
import { createRuleTester, msg, VIRTUAL_FILE } from '../helpers/rule-tester';

const IMPORT = `import { EventHandler } from '@vytches/ddd-events';`;

createRuleTester().run('event-handler-requires-handle', eventHandlerRequiresHandle, {
  valid: [
    {
      code: `${IMPORT} @EventHandler(UserCreated) class OnUser { async handle(e: UserCreated) {} }`,
      filename: VIRTUAL_FILE,
    },
    // handle as a property or a string key still counts as declared
    {
      code: `${IMPORT} @EventHandler(UserCreated) class OnUser { handle = async () => {}; }`,
      filename: VIRTUAL_FILE,
    },
    {
      code: `${IMPORT} @EventHandler(UserCreated) class OnUser { 'handle'() {} }`,
      filename: VIRTUAL_FILE,
    },
    // a class with extends may inherit handle()
    {
      code: `${IMPORT} @EventHandler(UserCreated) class OnUser extends BaseHandler {}`,
      filename: VIRTUAL_FILE,
    },
    // an abstract class is a base
    {
      code: `${IMPORT} @EventHandler(UserCreated) abstract class OnUser {}`,
      filename: VIRTUAL_FILE,
    },
    // method form of the decorator
    {
      code: `${IMPORT} class Handlers { @EventHandler(UserCreated) onUser(e: UserCreated) {} }`,
      filename: VIRTUAL_FILE,
    },
    // not the library decorator
    {
      code: `import { EventHandler } from './decorators'; @EventHandler(UserCreated) class OnUser {}`,
      filename: VIRTUAL_FILE,
    },
    { code: `@EventHandler(UserCreated) class OnUser {}`, filename: VIRTUAL_FILE },
    // undecorated class
    { code: `class OnUser {}`, filename: VIRTUAL_FILE },
  ],
  invalid: [
    {
      code: `${IMPORT} @EventHandler(UserCreated) class OnUser {}`,
      filename: VIRTUAL_FILE,
      errors: [
        {
          messageId: 'missingHandle',
          data: msg('event-handler-requires-handle', 'missingHandle', { name: 'OnUser' }),
        },
      ],
    },
    // decorator without a call
    {
      code: `${IMPORT} @EventHandler class OnUser { other() {} }`,
      filename: VIRTUAL_FILE,
      errors: [
        {
          messageId: 'missingHandle',
          data: msg('event-handler-requires-handle', 'missingHandle', { name: 'OnUser' }),
        },
      ],
    },
    // aliased import and exported class
    {
      code: `import { EventHandler as Handles } from '@vytches/ddd-events'; @Handles(E) export class OnUser { handleEvent() {} }`,
      filename: VIRTUAL_FILE,
      errors: [
        {
          messageId: 'missingHandle',
          data: msg('event-handler-requires-handle', 'missingHandle', { name: 'OnUser' }),
        },
      ],
    },
    // namespace import
    {
      code: `import * as ev from '@vytches/ddd-events'; @ev.EventHandler(E) class OnUser {}`,
      filename: VIRTUAL_FILE,
      errors: [
        {
          messageId: 'missingHandle',
          data: msg('event-handler-requires-handle', 'missingHandle', { name: 'OnUser' }),
        },
      ],
    },
    // the report lands on the class name
    {
      code: `${IMPORT}\n@EventHandler(E)\nclass OnUser {}`,
      filename: VIRTUAL_FILE,
      errors: [{ messageId: 'missingHandle', line: 3, column: 7 }],
    },
  ],
});
