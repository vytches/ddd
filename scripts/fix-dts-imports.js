#!/usr/bin/env node

/**
 * Fix TypeScript declaration files (.d.ts) to use package imports instead of relative paths
 * This script fixes the issue where DTS plugin generates relative imports that break in published packages
 */

const fs = require('fs');
const path = require('path');

function fixDtsImports(packagePath) {
  const packageJson = JSON.parse(fs.readFileSync(path.join(packagePath, 'package.json'), 'utf-8'));
  const packageName = packageJson.name?.split('/')[1] || 'unknown';

  // Skip meta-packages (they use custom templates)
  const isMetaPackage =
    packageName === 'enterprise' ||
    packageName === 'ddd' ||
    (packageJson.dependencies &&
      Object.keys(packageJson.dependencies).filter(dep => dep.startsWith('@vytches/ddd-')).length >=
        5);

  if (isMetaPackage) {
    console.log(`Skipping ${packageName} - meta-package uses custom template`);
    return;
  }

  const distPath = path.join(packagePath, 'dist');
  if (!fs.existsSync(distPath)) {
    console.log(`Skipping ${packageName} - no dist directory`);
    return;
  }

  console.log(`Fixing DTS imports for: ${packageName}`);

  // Find all .d.ts files in dist directory
  const dtsFiles = fs.readdirSync(distPath).filter(file => file.endsWith('.d.ts'));

  let totalFixedFiles = 0;
  let totalFixedImports = 0;

  for (const dtsFile of dtsFiles) {
    const filePath = path.join(distPath, dtsFile);
    const content = fs.readFileSync(filePath, 'utf-8');
    let fixedContent = content;
    let fileImportsFixed = 0;

    // Fix relative imports to contracts
    const contractsRegex = /from\s+['"](\.\.\/)*\.\.\/contracts\/src\/index\.ts['"]/g;
    fixedContent = fixedContent.replace(contractsRegex, "from '@vytches/ddd-contracts'");
    fileImportsFixed += (content.match(contractsRegex) || []).length;

    // Fix relative imports to utils
    const utilsRegex = /from\s+['"](\.\.\/)*\.\.\/utils\/src\/index\.ts['"]/g;
    fixedContent = fixedContent.replace(utilsRegex, "from '@vytches/ddd-utils'");
    fileImportsFixed += (content.match(utilsRegex) || []).length;

    // Fix relative imports to domain-primitives
    const domainPrimitivesRegex =
      /from\s+['"](\.\.\/)*\.\.\/domain-primitives\/src\/index\.ts['"]/g;
    fixedContent = fixedContent.replace(
      domainPrimitivesRegex,
      "from '@vytches/ddd-domain-primitives'"
    );
    fileImportsFixed += (content.match(domainPrimitivesRegex) || []).length;

    // Fix relative imports to value-objects
    const valueObjectsRegex = /from\s+['"](\.\.\/)*\.\.\/value-objects\/src\/index\.ts['"]/g;
    fixedContent = fixedContent.replace(valueObjectsRegex, "from '@vytches/ddd-value-objects'");
    fileImportsFixed += (content.match(valueObjectsRegex) || []).length;

    // Fix relative imports to aggregates
    const aggregatesRegex = /from\s+['"](\.\.\/)*\.\.\/aggregates\/src\/index\.ts['"]/g;
    fixedContent = fixedContent.replace(aggregatesRegex, "from '@vytches/ddd-aggregates'");
    fileImportsFixed += (content.match(aggregatesRegex) || []).length;

    // Fix relative imports to repositories
    const repositoriesRegex = /from\s+['"](\.\.\/)*\.\.\/repositories\/src\/index\.ts['"]/g;
    fixedContent = fixedContent.replace(repositoriesRegex, "from '@vytches/ddd-repositories'");
    fileImportsFixed += (content.match(repositoriesRegex) || []).length;

    // Fix relative imports to logging
    const loggingRegex = /from\s+['"](\.\.\/)*\.\.\/logging\/src\/index\.ts['"]/g;
    fixedContent = fixedContent.replace(loggingRegex, "from '@vytches/ddd-logging'");
    fileImportsFixed += (content.match(loggingRegex) || []).length;

    // Fix relative imports to events
    const eventsRegex = /from\s+['"](\.\.\/)*\.\.\/events\/src\/index\.ts['"]/g;
    fixedContent = fixedContent.replace(eventsRegex, "from '@vytches/ddd-events'");
    fileImportsFixed += (content.match(eventsRegex) || []).length;

    // Fix relative imports to cqrs
    const cqrsRegex = /from\s+['"](\.\.\/)*\.\.\/cqrs\/src\/index\.ts['"]/g;
    fixedContent = fixedContent.replace(cqrsRegex, "from '@vytches/ddd-cqrs'");
    fileImportsFixed += (content.match(cqrsRegex) || []).length;

    // Fix relative imports to di
    const diRegex = /from\s+['"](\.\.\/)*\.\.\/di\/src\/index\.ts['"]/g;
    fixedContent = fixedContent.replace(diRegex, "from '@vytches/ddd-di'");
    fileImportsFixed += (content.match(diRegex) || []).length;

    // Fix relative imports to validation
    const validationRegex = /from\s+['"](\.\.\/)*\.\.\/validation\/src\/index\.ts['"]/g;
    fixedContent = fixedContent.replace(validationRegex, "from '@vytches/ddd-validation'");
    fileImportsFixed += (content.match(validationRegex) || []).length;

    // Fix relative imports to policies
    const policiesRegex = /from\s+['"](\.\.\/)*\.\.\/policies\/src\/index\.ts['"]/g;
    fixedContent = fixedContent.replace(policiesRegex, "from '@vytches/ddd-policies'");
    fileImportsFixed += (content.match(policiesRegex) || []).length;

    // Fix relative imports to core
    const coreRegex = /from\s+['"](\.\.\/)*\.\.\/core\/src\/index\.ts['"]/g;
    fixedContent = fixedContent.replace(coreRegex, "from '@vytches/ddd-core'");
    fileImportsFixed += (content.match(coreRegex) || []).length;

    // Write back if there were changes
    if (fileImportsFixed > 0) {
      fs.writeFileSync(filePath, fixedContent);
      totalFixedFiles++;
      totalFixedImports += fileImportsFixed;
      console.log(`  Fixed ${fileImportsFixed} imports in ${dtsFile}`);
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
const packagesDir = path.join(__dirname, '..', 'packages');
const packageDirs = fs
  .readdirSync(packagesDir)
  .filter(dir => fs.statSync(path.join(packagesDir, dir)).isDirectory());

console.log('🔧 Fixing DTS imports in foundation packages...\n');

for (const packageDir of packageDirs) {
  const packagePath = path.join(packagesDir, packageDir);
  try {
    fixDtsImports(packagePath);
  } catch (error) {
    console.error(`❌ Error processing ${packageDir}:`, error.message);
  }
}

console.log('\n✅ DTS import fixing complete!');
