import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll } from 'vitest';
import { noInternalImports } from '../../../src/rules/no-internal-imports';
import { resetOwnPackageCache } from '../../../src/rules/shared/own-package';
import { createRuleTester, msg, VIRTUAL_FILE } from '../helpers/rule-tester';

// A real directory is needed only for the "file of the library itself" case, where the nearest
// package.json decides.
const root = mkdtempSync(join(tmpdir(), 'ddd-internal-imports-'));
const libraryDir = join(root, 'library-pkg', 'src');
const consumerDir = join(root, 'consumer-pkg', 'src');
mkdirSync(libraryDir, { recursive: true });
mkdirSync(consumerDir, { recursive: true });
writeFileSync(
  join(root, 'library-pkg', 'package.json'),
  JSON.stringify({ name: '@vytches/ddd-fake' })
);
writeFileSync(join(root, 'consumer-pkg', 'package.json'), JSON.stringify({ name: 'my-app' }));
resetOwnPackageCache();
afterAll(() => {
  resetOwnPackageCache();
  rmSync(root, { recursive: true, force: true });
});

const INTERNAL = `@vytches/ddd-contracts/internal`;

createRuleTester().run('no-internal-imports', noInternalImports, {
  valid: [
    { code: `import { Result } from '@vytches/ddd-utils';`, filename: VIRTUAL_FILE },
    { code: `import { x } from '@vytches/ddd';`, filename: VIRTUAL_FILE },
    // documented public subpaths
    { code: `import ctx from '@vytches/ddd-utils/llm-context';`, filename: VIRTUAL_FILE },
    { code: `import ctx from '@vytches/ddd-utils/package.json';`, filename: VIRTUAL_FILE },
    // not the library
    { code: `import x from 'lodash/internal';`, filename: VIRTUAL_FILE },
    { code: `import x from '@vytches/other/internal';`, filename: VIRTUAL_FILE },
    // a non-static specifier cannot be judged
    { code: `const m = await import(name);`, filename: VIRTUAL_FILE },
    { code: `const m = require(name);`, filename: VIRTUAL_FILE },
    // an unrelated call
    { code: `load('${INTERNAL}');`, filename: VIRTUAL_FILE },
    // the library's own packages reach each other through internal subpaths on purpose
    {
      code: `import { internalLogger } from '${INTERNAL}';`,
      filename: join(libraryDir, 'index.ts'),
    },
  ],
  invalid: [
    {
      code: `import { x } from '${INTERNAL}';`,
      filename: VIRTUAL_FILE,
      errors: [
        {
          messageId: 'internalSubpath',
          data: msg('no-internal-imports', 'internalSubpath', {
            source: INTERNAL,
            package: '@vytches/ddd-contracts',
          }),
        },
      ],
    },
    {
      code: `import { x } from '${INTERNAL}/logger';`,
      filename: VIRTUAL_FILE,
      errors: [{ messageId: 'internalSubpath' }],
    },
    {
      code: `export * from '${INTERNAL}';`,
      filename: VIRTUAL_FILE,
      errors: [{ messageId: 'internalSubpath' }],
    },
    {
      code: `export { x } from '${INTERNAL}';`,
      filename: VIRTUAL_FILE,
      errors: [{ messageId: 'internalSubpath' }],
    },
    {
      code: `const m = await import('${INTERNAL}');`,
      filename: VIRTUAL_FILE,
      errors: [{ messageId: 'internalSubpath' }],
    },
    {
      code: `const m = require('${INTERNAL}');`,
      filename: VIRTUAL_FILE,
      errors: [{ messageId: 'internalSubpath' }],
    },
    {
      code: `import m = require('${INTERNAL}');`,
      filename: VIRTUAL_FILE,
      errors: [{ messageId: 'internalSubpath' }],
    },
    {
      code: `type T = import('${INTERNAL}').Thing;`,
      filename: VIRTUAL_FILE,
      errors: [{ messageId: 'internalSubpath' }],
    },
    // a consumer package is checked even though it sits next to a library package
    {
      code: `import { x } from '${INTERNAL}';`,
      filename: join(consumerDir, 'index.ts'),
      errors: [{ messageId: 'internalSubpath' }],
    },
    // deep subpaths behind the package barrel
    {
      code: `import { Thing } from '@vytches/ddd-events/dist/thing';`,
      filename: VIRTUAL_FILE,
      errors: [
        {
          messageId: 'deepSubpath',
          data: msg('no-internal-imports', 'deepSubpath', {
            source: '@vytches/ddd-events/dist/thing',
            package: '@vytches/ddd-events',
          }),
        },
      ],
    },
    {
      code: `import { Thing } from '@vytches/ddd/src/thing';`,
      filename: VIRTUAL_FILE,
      errors: [{ messageId: 'deepSubpath' }],
    },
    // @internal symbols imported from a public entry
    {
      code: `import { internalLogger } from '@vytches/ddd-utils';`,
      filename: VIRTUAL_FILE,
      errors: [
        {
          messageId: 'internalSymbol',
          data: msg('no-internal-imports', 'internalSymbol', {
            name: 'internalLogger',
            source: '@vytches/ddd-utils',
          }),
        },
      ],
    },
    {
      code: `import { EVENT_HANDLER_METADATA as META, ok } from '@vytches/ddd-events';`,
      filename: VIRTUAL_FILE,
      errors: [
        {
          messageId: 'internalSymbol',
          data: msg('no-internal-imports', 'internalSymbol', {
            name: 'EVENT_HANDLER_METADATA',
            source: '@vytches/ddd-events',
          }),
        },
      ],
    },
    {
      code: `export { CUSTOM_MIDDLEWARE_SYMBOL } from '@vytches/ddd-cqrs';`,
      filename: VIRTUAL_FILE,
      errors: [
        {
          messageId: 'internalSymbol',
          data: msg('no-internal-imports', 'internalSymbol', {
            name: 'CUSTOM_MIDDLEWARE_SYMBOL',
            source: '@vytches/ddd-cqrs',
          }),
        },
      ],
    },
    // two internal symbols give two reports
    {
      code: `import { internalLogger, EVENT_HANDLER_OPTIONS } from '@vytches/ddd-events';`,
      filename: VIRTUAL_FILE,
      errors: [{ messageId: 'internalSymbol' }, { messageId: 'internalSymbol' }],
    },
  ],
});
