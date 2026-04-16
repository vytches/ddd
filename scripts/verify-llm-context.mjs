#!/usr/bin/env node

/**
 * LLM Context Verification Script
 *
 * Ensures docs/llm-context.md stays in sync with actual exports from
 * packages/enterprise/src/index.ts.
 *
 * Two tiers:
 *   ERROR (exit 1): Documented symbols that no longer exist in code
 *   WARNING:        Named exports from enterprise barrel not in docs
 *   INFO:           Wildcard-only exports not in docs (expected for internal APIs)
 *
 * Usage:
 *   node scripts/verify-llm-context.mjs           # Standard check
 *   node scripts/verify-llm-context.mjs --strict   # Treat warnings as errors
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), '..');
const strict = process.argv.includes('--strict');

const C = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

// ── Parse named + wildcard exports from enterprise barrel ──────────────

function parseEnterpriseExports(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const named = new Map(); // symbol → source package
  const wildcardSources = [];

  // export { Foo, Bar } from '...'  /  export type { Foo } from '...'
  const namedRe = /export\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g;
  let m;
  while ((m = namedRe.exec(content)) !== null) {
    const source = m[2];
    for (const sym of m[1].split(',')) {
      const t = sym.trim();
      if (!t || t.startsWith('//')) continue;
      const asMatch = t.match(/^(\w+)\s+as\s+(\w+)$/);
      named.set(asMatch ? asMatch[2] : t, source);
    }
  }

  // export * from '...'
  const wildcardRe = /export\s+\*\s+from\s+['"]([^'"]+)['"]/g;
  while ((m = wildcardRe.exec(content)) !== null) {
    wildcardSources.push(m[1]);
  }

  return { named, wildcardSources };
}

// ── Resolve a wildcard package's public exports (best-effort) ──────────

function resolvePackageExports(packageName) {
  const shortName = packageName.replace('@vytches/ddd-', '');
  const indexPath = resolve(ROOT, 'packages', shortName, 'src', 'index.ts');
  const exports = new Set();

  try {
    collectExportsFromFile(indexPath, exports, shortName, new Set());
  } catch {
    // package not found locally — skip
  }

  return exports;
}

function collectExportsFromFile(filePath, exports, shortName, visited) {
  if (visited.has(filePath)) return;
  visited.add(filePath);

  let content;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return;
  }

  // export { Foo, Bar } / export type { Foo }
  const namedRe = /export\s+(?:type\s+)?\{([^}]+)\}/g;
  let m;
  while ((m = namedRe.exec(content)) !== null) {
    for (const sym of m[1].split(',')) {
      const t = sym.trim();
      if (!t || t.startsWith('//')) continue;
      const asMatch = t.match(/^(\w+)\s+as\s+(\w+)$/);
      exports.add(asMatch ? asMatch[2] : t);
    }
  }

  // export class/function/const/enum/interface/type Foo
  const declRe = /^export\s+(?:abstract\s+)?(?:class|function|const|let|enum|interface|type)\s+(\w+)/gm;
  while ((m = declRe.exec(content)) !== null) {
    exports.add(m[1]);
  }

  // Recurse into export * from './...'
  const wildcardRe = /export\s+\*\s+from\s+['"](\.[^'"]+)['"]/g;
  while ((m = wildcardRe.exec(content)) !== null) {
    const rel = m[1];
    const base = resolve(dirname(filePath), rel);
    const candidates = [`${base}.ts`, `${base}/index.ts`];
    for (const candidate of candidates) {
      try {
        readFileSync(candidate); // existence check
        collectExportsFromFile(candidate, exports, shortName, visited);
        break;
      } catch {
        // try next
      }
    }
  }
}

// ── Parse documented symbols from llm-context.md ───────────────────────

function parseDocumentedSymbols(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const symbols = new Set();

  // Import Map table: first column has backtick-wrapped symbol names
  const importMapMatch = content.match(/## Import Map[\s\S]*?(?=### |## |$)/);
  if (importMapMatch) {
    extractSymbolsFromTable(importMapMatch[0], symbols);
  }

  // API Reference tables: first column of each package table
  const apiRefMatch = content.match(/## Package-by-Package API Reference[\s\S]*?(?=## Critical|## Import|$)/);
  if (apiRefMatch) {
    extractSymbolsFromTable(apiRefMatch[0], symbols);
  }

  return symbols;
}

function extractSymbolsFromTable(section, symbols) {
  // Match table rows: | content | content |
  const rowRe = /^\|([^|]+)\|/gm;
  let m;
  while ((m = rowRe.exec(section)) !== null) {
    const cell = m[1];
    // Skip header separator rows (| --- |)
    if (/^\s*-+\s*$/.test(cell)) continue;

    // Extract backtick-wrapped identifiers
    const backtickRe = /`([^`]+)`/g;
    let sym;
    while ((sym = backtickRe.exec(cell)) !== null) {
      let name = sym[1]
        .replace(/\([^)]*\)/g, '')   // Remove (deprecated), (payload)
        .replace(/<[^>]+>/g, '')     // Remove <T> generics
        .replace(/\.\w+.*$/, '')      // Remove .method() suffixes
        .trim();

      // Only keep valid identifier-like names
      if (name && /^[A-Za-z_]\w*$/.test(name) && !name.startsWith('@')) {
        symbols.add(name);
      }
    }
  }
}

// ── Main ───────────────────────────────────────────────────────────────

const indexPath = resolve(ROOT, 'packages/enterprise/src/index.ts');
const docsPath = resolve(ROOT, 'docs/llm-context.md');

console.log(`\n${C.cyan}LLM Context Verification${C.reset}\n${'='.repeat(40)}\n`);

// 1. Parse
const { named, wildcardSources } = parseEnterpriseExports(indexPath);
const documented = parseDocumentedSymbols(docsPath);

// 2. Resolve wildcards
const wildcardExports = new Map(); // symbol → package
for (const pkg of wildcardSources) {
  const exports = resolvePackageExports(pkg);
  for (const exp of exports) {
    if (!named.has(exp)) { // named take precedence
      wildcardExports.set(exp, pkg);
    }
  }
}

const allExports = new Set([...named.keys(), ...wildcardExports.keys()]);

console.log(`${C.dim}Named exports:${C.reset}    ${named.size}`);
console.log(`${C.dim}Wildcard exports:${C.reset} ${wildcardExports.size} (from ${wildcardSources.length} packages)`);
console.log(`${C.dim}Total exports:${C.reset}    ${allExports.size}`);
console.log(`${C.dim}Documented:${C.reset}       ${documented.size}\n`);

// 3. Check: documented symbols that don't exist (ERRORS)
const stale = [];
for (const sym of documented) {
  if (!allExports.has(sym)) {
    stale.push(sym);
  }
}

// 4. Check: named exports not documented (WARNINGS — these are explicitly chosen for the public API)
const undocumentedNamed = [];
for (const [sym] of named) {
  if (!documented.has(sym)) {
    undocumentedNamed.push(sym);
  }
}

// 5. Check: wildcard exports not documented (INFO — many are internal)
const undocumentedWildcard = [];
for (const [sym] of wildcardExports) {
  if (!documented.has(sym)) {
    undocumentedWildcard.push(sym);
  }
}

// 6. Report
let hasErrors = false;

if (stale.length > 0) {
  hasErrors = true;
  console.log(`${C.red}ERROR: Documented but NOT exported (${stale.length}):${C.reset}`);
  for (const sym of stale.sort()) {
    console.log(`  ${C.red}-${C.reset} ${sym}`);
  }
  console.log();
}

if (undocumentedNamed.length > 0) {
  if (strict) hasErrors = true;
  console.log(`${C.yellow}WARNING: Named exports not in docs (${undocumentedNamed.length}):${C.reset}`);
  for (const sym of undocumentedNamed.sort()) {
    console.log(`  ${C.yellow}+${C.reset} ${sym} ${C.dim}(from ${named.get(sym)})${C.reset}`);
  }
  console.log();
}

if (undocumentedWildcard.length > 0) {
  console.log(`${C.dim}INFO: Wildcard exports not in docs (${undocumentedWildcard.length} — typically internal):${C.reset}`);
  // Group by package for readability
  const byPkg = new Map();
  for (const sym of undocumentedWildcard) {
    const pkg = wildcardExports.get(sym);
    if (!byPkg.has(pkg)) byPkg.set(pkg, []);
    byPkg.get(pkg).push(sym);
  }
  for (const [pkg, syms] of [...byPkg.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`  ${C.dim}${pkg} (${syms.length}): ${syms.sort().join(', ')}${C.reset}`);
  }
  console.log();
}

// 7. Summary
const docCoverage = ((documented.size / named.size) * 100).toFixed(0);

if (hasErrors) {
  console.log(`${C.red}FAIL${C.reset} — Documentation has stale references or missing critical symbols.`);
  console.log(`${C.dim}  Stale: ${stale.length} | Undocumented named: ${undocumentedNamed.length} | Named coverage: ${docCoverage}%${C.reset}\n`);
  process.exit(1);
} else if (undocumentedNamed.length > 0) {
  console.log(`${C.yellow}WARN${C.reset} — All documented symbols exist, but ${undocumentedNamed.length} named exports lack documentation.`);
  console.log(`${C.dim}  Named coverage: ${docCoverage}% | Run with --strict to fail on warnings.${C.reset}\n`);
  process.exit(0);
} else {
  console.log(`${C.green}PASS${C.reset} — All named exports documented, all documented symbols exist.`);
  console.log(`${C.dim}  ${named.size} named exports verified. ${wildcardExports.size} wildcard exports informational.${C.reset}\n`);
  process.exit(0);
}
