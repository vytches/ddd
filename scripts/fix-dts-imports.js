#!/usr/bin/env node

/**
 * Fix TypeScript declaration files (.d.ts) to use package imports instead of
 * monorepo-relative paths (e.g. `from '../../di/src/index.ts'`).
 *
 * F-C1 (VB-002): this used to be TWO independent, out-of-sync fixers —
 * an inline `afterBuild` hook in `packages/utils/build-configs/config-builders.ts`
 * (only ran for "meta" packages, only touched the top-level `dist/index.d.ts`,
 * and only matched exactly `../../`), and this script (explicitly SKIPPED
 * meta-packages, only scanned top-level `dist/*.d.ts`, and hardcoded a regex
 * per package name that silently missed newer packages).
 *
 * This is now the SINGLE consolidated mechanism:
 *   - No meta-package exemption — every package's dist is processed.
 *   - Recurses into `dist/**\/*.d.ts` (nested declaration files too, not just
 *     the top-level barrel).
 *   - The package-name rewrite table is derived DYNAMICALLY from
 *     `packages/*\/package.json` — no hardcoded list to fall out of sync.
 *   - The relative-path regex matches `(\.\.\/)+` (any depth of `../`), not
 *     just exactly two levels.
 *
 * A CI guard (`scripts/smoke-test-publish.sh`, AC1) asserts
 * `grep -r "/src/index.ts" packages/*\/dist` is empty after this runs.
 */

const fs = require('fs');
const path = require('path');

const packagesDir = path.join(__dirname, '..', 'packages');

/**
 * Build a map of package directory name -> published package name, e.g.
 * "domain-primitives" -> "@vytches/ddd-domain-primitives", by reading every
 * packages/*\/package.json. This replaces the old hardcoded per-package
 * regex list, which was missing entries for resilience, messaging,
 * projections, acl, domain-services, testing, nestjs, event-store, etc.
 */
function buildPackageNameMap(dir) {
  const map = new Map();
  const packageDirs = fs.readdirSync(dir).filter(d => {
    const full = path.join(dir, d);
    return fs.statSync(full).isDirectory() && fs.existsSync(path.join(full, 'package.json'));
  });

  for (const packageDir of packageDirs) {
    try {
      const pkgJson = JSON.parse(
        fs.readFileSync(path.join(dir, packageDir, 'package.json'), 'utf-8')
      );
      if (pkgJson.name) {
        map.set(packageDir, pkgJson.name);
      }
    } catch (error) {
      console.warn(`Warning: could not read package.json for ${packageDir}:`, error.message);
    }
  }

  return map;
}

/**
 * Recursively collect every .d.ts file under a directory.
 */
function findDtsFilesRecursive(dir) {
  const results = [];
  if (!fs.existsSync(dir)) {
    return results;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findDtsFilesRecursive(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.d.ts')) {
      results.push(fullPath);
    }
  }

  return results;
}

/**
 * Build one regex+replacement pair per known package directory, matching any
 * depth of `../` (not just exactly `../../`) followed by `<dir>/src/index`
 * (with or without the `.ts` extension, single or double quotes).
 */
function buildRewriteRules(packageNameMap) {
  const rules = [];
  for (const [dirName, packageName] of packageNameMap.entries()) {
    // Escape regex-special characters in the directory name (none expected
    // today, but package dirs are user-controlled over time).
    const escapedDir = dirName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(
      `from\\s+(['"])(?:\\.\\.\\/)+${escapedDir}\\/src\\/index(?:\\.ts)?\\1`,
      'g'
    );
    rules.push({ dirName, packageName, pattern });
  }
  return rules;
}

function fixDtsImports(packagePath, rewriteRules) {
  const packageJson = JSON.parse(fs.readFileSync(path.join(packagePath, 'package.json'), 'utf-8'));
  const packageName = packageJson.name || path.basename(packagePath);

  const distPath = path.join(packagePath, 'dist');
  if (!fs.existsSync(distPath)) {
    console.log(`Skipping ${packageName} - no dist directory`);
    return;
  }

  const dtsFiles = findDtsFilesRecursive(distPath);
  if (dtsFiles.length === 0) {
    console.log(`Skipping ${packageName} - no .d.ts files in dist`);
    return;
  }

  console.log(`Fixing DTS imports for: ${packageName}`);

  let totalFixedFiles = 0;
  let totalFixedImports = 0;

  for (const filePath of dtsFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');
    let fixedContent = content;
    let fileImportsFixed = 0;

    for (const { packageName: targetPackageName, pattern } of rewriteRules) {
      const matches = fixedContent.match(pattern);
      if (matches) {
        fileImportsFixed += matches.length;
      }
      fixedContent = fixedContent.replace(pattern, `from '${targetPackageName}'`);
    }

    if (fileImportsFixed > 0) {
      fs.writeFileSync(filePath, fixedContent);
      totalFixedFiles++;
      totalFixedImports += fileImportsFixed;
      console.log(`  Fixed ${fileImportsFixed} imports in ${path.relative(distPath, filePath)}`);
    }
  }

  if (totalFixedFiles > 0) {
    console.log(
      `✅ Fixed ${totalFixedImports} imports across ${totalFixedFiles} files in ${packageName}`
    );
  } else {
    console.log(`✨ No import fixes needed for ${packageName}`);
  }
}

// Main execution
const packageNameMap = buildPackageNameMap(packagesDir);
const rewriteRules = buildRewriteRules(packageNameMap);

const packageDirs = fs
  .readdirSync(packagesDir)
  .filter(dir => fs.statSync(path.join(packagesDir, dir)).isDirectory());

console.log(`🔧 Fixing DTS imports across ${packageDirs.length} packages...\n`);

for (const packageDir of packageDirs) {
  const packagePath = path.join(packagesDir, packageDir);
  try {
    fixDtsImports(packagePath, rewriteRules);
  } catch (error) {
    console.error(`❌ Error processing ${packageDir}:`, error.message);
  }
}

console.log('\n✅ DTS import fixing complete!');
