import { noNewEntityId } from '../../../src/rules/no-new-entity-id';
import { createRuleTester, VIRTUAL_FILE } from '../helpers/rule-tester';

const VO_IMPORT = `import { EntityId } from '@vytches/ddd-value-objects';`;

createRuleTester().run('no-new-entity-id', noNewEntityId, {
  valid: [
    { code: `${VO_IMPORT} const id = EntityId.fromUUID(value);`, filename: VIRTUAL_FILE },
    { code: `${VO_IMPORT} const id = EntityId.create();`, filename: VIRTUAL_FILE },
    // a project class that happens to be called EntityId
    { code: `class EntityId {} const id = new EntityId();`, filename: VIRTUAL_FILE },
    {
      code: `import { EntityId } from './entity-id'; const id = new EntityId('a');`,
      filename: VIRTUAL_FILE,
    },
    { code: `const id = new EntityId('a');`, filename: VIRTUAL_FILE },
    // another library class
    {
      code: `import { Money } from '@vytches/ddd-value-objects'; const m = new Money(1);`,
      filename: VIRTUAL_FILE,
    },
    // shadowed by a parameter
    {
      code: `${VO_IMPORT} function f(EntityId: new (v: string) => object) { return new EntityId('a'); }`,
      filename: VIRTUAL_FILE,
    },
  ],
  invalid: [
    {
      code: `${VO_IMPORT} const id = new EntityId('a');`,
      filename: VIRTUAL_FILE,
      errors: [{ messageId: 'newEntityId' }],
    },
    // the meta-package re-exports contracts' EntityId as ContractsEntityId
    {
      code: `import { ContractsEntityId as BaseEntityId } from '@vytches/ddd'; const id = new BaseEntityId('a');`,
      filename: VIRTUAL_FILE,
      errors: [{ messageId: 'newEntityId' }],
    },
    // the second EntityId class of the library
    {
      code: `import { EntityId } from '@vytches/ddd-contracts'; const id = new EntityId('a');`,
      filename: VIRTUAL_FILE,
      errors: [{ messageId: 'newEntityId' }],
    },
    {
      code: `import { EntityId as Id } from '@vytches/ddd-value-objects'; const id = new Id('a');`,
      filename: VIRTUAL_FILE,
      errors: [{ messageId: 'newEntityId' }],
    },
    {
      code: `import * as vo from '@vytches/ddd-value-objects'; const id = new vo.EntityId('a');`,
      filename: VIRTUAL_FILE,
      errors: [{ messageId: 'newEntityId' }],
    },
    {
      code: `import { EntityId } from '@vytches/ddd'; const id = new EntityId('a');`,
      filename: VIRTUAL_FILE,
      errors: [{ messageId: 'newEntityId' }],
    },
  ],
});
