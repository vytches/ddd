import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { ENTERPRISE_PACKAGE, LIBRARY_ROLE_NAMES, LIBRARY_ROLES } from '../../src/roles';

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGES_DIR = resolve(HERE, '..', '..', '..');
const SCOPE = '@vytches/ddd-';

/** Names exported by a library package, types and values alike (interfaces have no runtime form). */
function exportNames(pkg: string): ReadonlySet<string> {
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

const targets = LIBRARY_ROLES.flatMap(def => [
  ...def.bases.map(t => ({ role: def.role, ...t, via: 'base' })),
  ...def.decorators.map(t => ({ role: def.role, ...t, via: 'decorator' })),
]);
const packages = [...new Set(targets.map(t => t.from))].sort();

describe('library role vocabulary', () => {
  it('names every role once and lists them in LIBRARY_ROLE_NAMES', () => {
    expect(new Set(LIBRARY_ROLE_NAMES).size).toBe(LIBRARY_ROLES.length);
    expect(LIBRARY_ROLE_NAMES).toEqual(LIBRARY_ROLES.map(def => def.role));
  });

  it('gives every role a kind, a library marker and at least one binding', () => {
    for (const def of LIBRARY_ROLES) {
      expect(['tactical', 'cqrs', 'integration']).toContain(def.kind);
      expect(def.marker).toBe('library');
      expect(def.bases.length + def.decorators.length, def.role).toBeGreaterThan(0);
    }
  });

  it('is frozen, so a consumer cannot alter the shared vocabulary', () => {
    expect(Object.isFrozen(LIBRARY_ROLES)).toBe(true);
    expect(Object.isFrozen(LIBRARY_ROLE_NAMES)).toBe(true);
  });

  it('binds only to packages of the library, never to the meta-package', () => {
    for (const t of targets) {
      expect(t.from.startsWith(SCOPE), `${t.role} -> ${t.from}`).toBe(true);
      expect(t.from).not.toBe(ENTERPRISE_PACKAGE);
    }
  });

  it.each(packages)(
    'every name bound in %s exists in the exports of the real package',
    pkg => {
      const exported = exportNames(pkg);
      expect(exported.size, `no exports read for ${pkg}`).toBeGreaterThan(0);
      for (const t of targets.filter(x => x.from === pkg)) {
        expect(exported.has(t.name), `${t.role}: ${pkg} has no export "${t.name}"`).toBe(true);
      }
    },
    120_000
  );
});
