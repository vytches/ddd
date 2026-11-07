import { resolve } from 'node:path';
import ts from 'typescript';
import { PACKAGE_DIR } from './built-package';

const SCOPE = '@vytches/ddd-';
const PACKAGES_DIR = resolve(PACKAGE_DIR, '..');

/**
 * Names exported by the workspace package `pkg` (e.g. `@vytches/ddd-cqrs`), types and values
 * alike: most vocabulary entries are interfaces, which have no runtime form to import. Read with
 * the TypeScript checker from the package barrel, so `export *` chains count as the consumer
 * sees them. Returns an empty set when the barrel cannot be read.
 */
export function exportedNamesOfPackage(pkg: string): ReadonlySet<string> {
  if (!pkg.startsWith(SCOPE)) throw new Error(`${pkg} is not a ${SCOPE}* package`);
  const entry = resolve(PACKAGES_DIR, pkg.slice(SCOPE.length), 'src', 'index.ts');
  const program = ts.createProgram([entry], {
    noEmit: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    experimentalDecorators: true,
  });
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(entry);
  const symbol = source ? checker.getSymbolAtLocation(source) : undefined;
  return new Set(symbol ? checker.getExportsOfModule(symbol).map(s => s.name) : []);
}
