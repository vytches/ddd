#!/usr/bin/env node
// Prints the package directories in publish order, one per line: a package comes after
// every workspace package it depends on at runtime.
//
// Why: `publish-packages.sh` used to walk `packages/*/` alphabetically, so the meta-package
// `@vytches/ddd` (packages/enterprise) reached npm before `events`, `utils`, `value-objects`
// and others. Its exact-version dependencies did not exist yet, and installs failed with 404
// for several minutes (v0.32.0). Only dependencies that consumers install count here
// (dependencies, optionalDependencies, peerDependencies); devDependencies do not.
//
// Usage: node scripts/publish-order.mjs [packagesDir]   (default: packages)
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const RUNTIME_FIELDS = ['dependencies', 'optionalDependencies', 'peerDependencies'];

/**
 * @param {readonly { dir: string, name: string, deps: readonly string[] }[]} packages
 * @returns {string[]} directories, dependencies first; ties and cycles keep alphabetical order
 */
export function orderPackages(packages) {
  const byName = new Map(packages.map(p => [p.name, p]));
  const done = new Set();
  const visiting = new Set();
  const ordered = [];

  const visit = pkg => {
    if (done.has(pkg.name) || visiting.has(pkg.name)) return;
    visiting.add(pkg.name);
    for (const dep of [...pkg.deps].sort()) {
      const target = byName.get(dep);
      if (target) visit(target);
    }
    visiting.delete(pkg.name);
    done.add(pkg.name);
    ordered.push(pkg.dir);
  };

  for (const pkg of [...packages].sort((a, b) => a.dir.localeCompare(b.dir))) visit(pkg);
  return ordered;
}

export function readPackages(packagesDir) {
  return readdirSync(packagesDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => join(packagesDir, entry.name))
    .filter(dir => existsSync(join(dir, 'package.json')))
    .map(dir => {
      const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
      const deps = RUNTIME_FIELDS.flatMap(field => Object.keys(manifest[field] ?? {}));
      return { dir, name: manifest.name, deps };
    });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dirs = orderPackages(readPackages(process.argv[2] ?? 'packages'));
  process.stdout.write(`${dirs.join('\n')}\n`);
}
