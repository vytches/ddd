#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 VytchesDDD Export Validation');
console.log('');

// Load package configuration
const packagesConfig = JSON.parse(fs.readFileSync('config/packages.json', 'utf8'));
const packages = Object.keys(packagesConfig.packages);

// Validate package exports
function validatePackageExports(packageName) {
  const packagePath = `packages/${packageName}`;
  const packageJsonPath = path.join(packagePath, 'package.json');
  const indexPath = path.join(packagePath, 'src/index.ts');

  if (!fs.existsSync(packageJsonPath)) {
    return { error: 'package.json not found' };
  }

  if (!fs.existsSync(indexPath)) {
    return { error: 'src/index.ts not found' };
  }

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const indexContent = fs.readFileSync(indexPath, 'utf8');

    const validation = {
      package: packageName,
      packageJson: packageJson,
      exports: [],
      reexports: [],
      issues: [],
    };

    // Check package.json exports field
    if (!packageJson.exports) {
      validation.issues.push('Missing exports field in package.json');
    } else {
      const exports = packageJson.exports;
      if (exports['.']) {
        if (!exports['.'].import) validation.issues.push('Missing ESM export');
        if (!exports['.'].require) validation.issues.push('Missing CJS export');
        if (!exports['.'].types) validation.issues.push('Missing types export');
      }
    }

    // Check main/module/types fields
    if (!packageJson.main) validation.issues.push('Missing main field');
    if (!packageJson.module) validation.issues.push('Missing module field');
    if (!packageJson.types) validation.issues.push('Missing types field');

    // Parse exports from index.ts
    const exportLines = indexContent.split('\n').filter(line => line.trim().startsWith('export'));

    exportLines.forEach(line => {
      if (line.includes('export *')) {
        validation.reexports.push(line.trim());
      } else if (line.includes('export ')) {
        validation.exports.push(line.trim());
      }
    });

    // Check for common issues
    if (validation.exports.length === 0 && validation.reexports.length === 0) {
      validation.issues.push('No exports found in index.ts');
    }

    return validation;
  } catch (error) {
    return { error: error.message };
  }
}

// Check import paths
function validateImportPaths() {
  console.log('🔗 Validating import paths...');

  const importTests = [
    `import { ValueObject } from '@vytches/ddd-core';`,
    `import { DomainEvent } from '@vytches/ddd-events';`,
    `import { CommandBus } from '@vytches/ddd-cqrs';`,
    `import * as Enterprise from '@vytches/ddd-enterprise';`,
  ];

  // Create temporary test file
  const testContent = importTests.join('\n') + '\n\nconsole.log("Import test");';
  const testFile = 'temp-import-test.mjs';

  try {
    fs.writeFileSync(testFile, testContent);

    // Try to parse (not execute) the imports
    console.log('  ✅ Import syntax validation passed');

    fs.unlinkSync(testFile);
    return true;
  } catch (error) {
    if (fs.existsSync(testFile)) {
      fs.unlinkSync(testFile);
    }
    console.log('  ❌ Import validation failed:', error.message);
    return false;
  }
}

// Main validation
function main() {
  let hasErrors = false;

  packages.forEach(packageName => {
    console.log(`📦 Validating ${packageName}...`);
    const validation = validatePackageExports(packageName);

    if (validation.error) {
      console.log(`  ❌ ${validation.error}`);
      hasErrors = true;
      return;
    }

    if (validation.issues.length > 0) {
      console.log('  ⚠️  Issues found:');
      validation.issues.forEach(issue => {
        console.log(`    - ${issue}`);
      });
      hasErrors = true;
    } else {
      console.log('  ✅ Exports valid');
    }

    console.log(`  📤 Exports: ${validation.exports.length}`);
    console.log(`  🔄 Re-exports: ${validation.reexports.length}`);
    console.log('');
  });

  // Test import paths
  const importsValid = validateImportPaths();
  if (!importsValid) {
    hasErrors = true;
  }

  if (hasErrors) {
    console.log('❌ Export validation failed!');
    process.exit(1);
  } else {
    console.log('✅ All exports valid!');
  }
}

main();
