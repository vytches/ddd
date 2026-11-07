import { policyBuilderRequiredCalls } from '../../../src/rules/policy-builder-required-calls';
import { createRuleTester, msg, VIRTUAL_FILE } from '../helpers/rule-tester';

const IMPORT = `import { PolicyBuilder } from '@vytches/ddd-policies';`;

createRuleTester().run('policy-builder-required-calls', policyBuilderRequiredCalls, {
  valid: [
    {
      code: `${IMPORT} const p = PolicyBuilder.create({}).withId('a').withName('n').withDomain('d').build();`,
      filename: VIRTUAL_FILE,
    },
    // defaultDomain in the config replaces withDomain
    {
      code: `${IMPORT} const p = PolicyBuilder.create({ defaultDomain: 'orders' }).withId('a').withName('n').build();`,
      filename: VIRTUAL_FILE,
    },
    {
      code: `${IMPORT} const p = PolicyBuilder.create({ 'defaultDomain': 'orders' }).withId('a').withName('n').build();`,
      filename: VIRTUAL_FILE,
    },
    // a config that cannot be read statically may carry defaultDomain
    {
      code: `${IMPORT} const p = PolicyBuilder.create(config).withId('a').withName('n').build();`,
      filename: VIRTUAL_FILE,
    },
    {
      code: `${IMPORT} const p = PolicyBuilder.create({ ...base }).withId('a').withName('n').build();`,
      filename: VIRTUAL_FILE,
    },
    // forDomain supplies the domain
    {
      code: `${IMPORT} const p = PolicyBuilder.forDomain('orders').withId('a').withName('n').build();`,
      filename: VIRTUAL_FILE,
    },
    // the order of the calls is irrelevant
    {
      code: `${IMPORT} const p = PolicyBuilder.forDomain('orders').withName('n').withRule(r).withId('a').build();`,
      filename: VIRTUAL_FILE,
    },
    // a chain split across variables is not followed: silence, never a false alarm
    {
      code: `${IMPORT} const b = PolicyBuilder.create({}); const p = b.withId('a').build();`,
      filename: VIRTUAL_FILE,
    },
    // other builders
    {
      code: `import { PolicyBuilder } from './my-builder'; PolicyBuilder.create({}).build();`,
      filename: VIRTUAL_FILE,
    },
    { code: `${IMPORT} const x = builder.withId('a').build();`, filename: VIRTUAL_FILE },
    { code: `${IMPORT} const x = new Thing().build();`, filename: VIRTUAL_FILE },
    // other PolicyBuilder statics
    { code: `${IMPORT} PolicyBuilder.other().build();`, filename: VIRTUAL_FILE },
  ],
  invalid: [
    {
      code: `${IMPORT} const p = PolicyBuilder.create({}).build();`,
      filename: VIRTUAL_FILE,
      errors: [
        {
          messageId: 'missingCalls',
          data: msg('policy-builder-required-calls', 'missingCalls', {
            missing: '`withId`, `withName`, `withDomain`',
            calls: '`.withId()`, `.withName()`, `.withDomain()`',
          }),
        },
      ],
    },
    {
      code: `${IMPORT} const p = PolicyBuilder.create({}).withId('a').withName('n').build();`,
      filename: VIRTUAL_FILE,
      errors: [
        {
          messageId: 'missingCalls',
          data: msg('policy-builder-required-calls', 'missingCalls', {
            missing: '`withDomain`',
            calls: '`.withDomain()`',
          }),
        },
      ],
    },
    // no config at all counts as no defaultDomain
    {
      code: `${IMPORT} const p = PolicyBuilder.create().withId('a').withName('n').build();`,
      filename: VIRTUAL_FILE,
      errors: [
        {
          messageId: 'missingCalls',
          data: msg('policy-builder-required-calls', 'missingCalls', {
            missing: '`withDomain`',
            calls: '`.withDomain()`',
          }),
        },
      ],
    },
    // a config object without defaultDomain
    {
      code: `${IMPORT} const p = PolicyBuilder.create({ other: 1 }).withId('a').withName('n').build();`,
      filename: VIRTUAL_FILE,
      errors: [{ messageId: 'missingCalls' }],
    },
    {
      code: `${IMPORT} const p = PolicyBuilder.forDomain('orders').build();`,
      filename: VIRTUAL_FILE,
      errors: [
        {
          messageId: 'missingCalls',
          data: msg('policy-builder-required-calls', 'missingCalls', {
            missing: '`withId`, `withName`',
            calls: '`.withId()`, `.withName()`',
          }),
        },
      ],
    },
    {
      code: `${IMPORT} const p = PolicyBuilder.forDomain('orders').withId('a').build();`,
      filename: VIRTUAL_FILE,
      errors: [
        {
          messageId: 'missingCalls',
          data: msg('policy-builder-required-calls', 'missingCalls', {
            missing: '`withName`',
            calls: '`.withName()`',
          }),
        },
      ],
    },
    // aliased and namespace imports
    {
      code: `import { PolicyBuilder as PB } from '@vytches/ddd-policies'; PB.forDomain('d').build();`,
      filename: VIRTUAL_FILE,
      errors: [{ messageId: 'missingCalls' }],
    },
    {
      code: `import * as policies from '@vytches/ddd-policies'; policies.PolicyBuilder.forDomain('d').build();`,
      filename: VIRTUAL_FILE,
      errors: [{ messageId: 'missingCalls' }],
    },
  ],
});
