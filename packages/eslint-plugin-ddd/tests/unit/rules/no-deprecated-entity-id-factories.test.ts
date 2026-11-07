import {
  DEPRECATED_ENTITY_ID_FACTORIES,
  noDeprecatedEntityIdFactories,
} from '../../../src/rules/no-deprecated-entity-id-factories';
import { createRuleTester, msg, VIRTUAL_FILE } from '../helpers/rule-tester';

const IMPORT = `import { EntityId } from '@vytches/ddd-value-objects';`;

const invalid = [...DEPRECATED_ENTITY_ID_FACTORIES].map(([method, replacement]) => ({
  code: `${IMPORT} const id = EntityId.${method}(value);`,
  filename: VIRTUAL_FILE,
  errors: [
    {
      messageId: 'deprecatedFactory' as const,
      data: msg('no-deprecated-entity-id-factories', 'deprecatedFactory', { method, replacement }),
    },
  ],
}));

createRuleTester().run('no-deprecated-entity-id-factories', noDeprecatedEntityIdFactories, {
  valid: [
    { code: `${IMPORT} const id = EntityId.fromText(value);`, filename: VIRTUAL_FILE },
    { code: `${IMPORT} const id = EntityId.fromUUID(value);`, filename: VIRTUAL_FILE },
    { code: `${IMPORT} const id = EntityId.create();`, filename: VIRTUAL_FILE },
    { code: `${IMPORT} const id = EntityId.tryFromUUID(value);`, filename: VIRTUAL_FILE },
    // computed access is not followed
    { code: `${IMPORT} const id = EntityId['createText'](value);`, filename: VIRTUAL_FILE },
    // project class and other packages
    {
      code: `class EntityId { static createText(v: string) { return v; } } EntityId.createText('a');`,
      filename: VIRTUAL_FILE,
    },
    {
      code: `import { EntityId } from './ids'; EntityId.createText('a');`,
      filename: VIRTUAL_FILE,
    },
    // same method name on another library symbol
    {
      code: `import { Money } from '@vytches/ddd-value-objects'; Money.createText('a');`,
      filename: VIRTUAL_FILE,
    },
  ],
  invalid: [
    ...invalid,
    {
      code: `import { EntityId as Id } from '@vytches/ddd-contracts'; const id = Id.createUuid(v);`,
      filename: VIRTUAL_FILE,
      errors: [
        {
          messageId: 'deprecatedFactory',
          data: msg('no-deprecated-entity-id-factories', 'deprecatedFactory', {
            method: 'createUuid',
            replacement: 'fromUUID',
          }),
        },
      ],
    },
    {
      code: `import * as vo from '@vytches/ddd-value-objects'; const id = vo.EntityId.createText(v);`,
      filename: VIRTUAL_FILE,
      errors: [{ messageId: 'deprecatedFactory' }],
    },
  ],
});
