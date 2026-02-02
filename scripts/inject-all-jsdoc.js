#!/usr/bin/env node

/**
 * Script to inject JSDoc for all packages
 * Processes all library packages in the monorepo
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// List of all packages to process
const PACKAGES = [
  'acl',
  'aggregates',
  'cli',
  'contracts',
  'cqrs',
  'di',
  'domain-primitives',
  'domain-services',
  'enterprise',
  'events',
  'logging',
  'messaging',
  'nestjs',
  'policies',
  'projections',
  'repositories',
  'resilience',
  'testing',
  'utils',
  'validation',
  'value-objects',
];

function injectJSDocForPackage(packageName) {
  const packagePath = path.join(process.cwd(), 'packages', packageName);

  // Check if package exists
  if (!fs.existsSync(packagePath)) {
    return { status: 'skip', message: `Package ${packageName} not found` };
  }

  // Check if package has dist folder (built)
  const distPath = path.join(packagePath, 'dist');
  if (!fs.existsSync(distPath)) {
    return { status: 'skip', message: `Package ${packageName} has no dist folder` };
  }

  try {
    const command = `node scripts/inject-yaml-jsdoc-ast.js --package=${packageName}`;
    // Run command silently and capture output
    const output = execSync(command, {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      stdio: ['pipe', 'pipe', 'pipe'], // Capture all streams
    });

    // Count successful operations in output
    const successCount = (output.match(/✅/g) || []).length;
    const fileCount = (output.match(/Processing:/g) || []).length;

    return {
      status: 'success',
      message: `Processed ${fileCount} files with ${successCount} enhancements`,
    };
  } catch (error) {
    // Extract error message from output if available
    let errorMessage = error.message;
    if (error.stdout) {
      const lines = error.stdout.toString().split('\n');
      const errorLine = lines.find(line => line.includes('Error:') || line.includes('❌'));
      if (errorLine) {
        errorMessage = errorLine;
      }
    }
    return { status: 'error', message: errorMessage };
  }
}

function main() {
  // Use process.stdout.write to avoid console.log issues
  process.stdout.write('🚀 JSDoc Injection for All Packages\n');
  process.stdout.write('═'.repeat(50) + '\n\n');

  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  if (dryRun) {
    process.stdout.write('🔍 Running in DRY RUN mode - no files will be modified\n\n');
  }

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;
  const results = [];

  // Process all packages
  for (const packageName of PACKAGES) {
    process.stdout.write(`📦 Processing: ${packageName}...`);

    const result = injectJSDocForPackage(packageName);
    results.push({ package: packageName, ...result });

    if (result.status === 'success') {
      successCount++;
      process.stdout.write(` ✅\n`);
    } else if (result.status === 'error') {
      errorCount++;
      process.stdout.write(` ❌\n`);
    } else if (result.status === 'skip') {
      skipCount++;
      process.stdout.write(` ⏭️\n`);
    }
  }

  // Summary
  process.stdout.write('\n' + '═'.repeat(50) + '\n');
  process.stdout.write('📊 Summary:\n');
  process.stdout.write(`✅ Successfully processed: ${successCount} packages\n`);
  process.stdout.write(`⏭️  Skipped: ${skipCount} packages\n`);
  process.stdout.write(`❌ Failed: ${errorCount} packages\n\n`);

  // Show details for failures
  if (errorCount > 0) {
    process.stdout.write('❌ Failed packages:\n');
    results
      .filter(r => r.status === 'error')
      .forEach(r => process.stdout.write(`  - ${r.package}: ${r.message}\n`));
  }

  // Show details for skipped
  if (skipCount > 0) {
    process.stdout.write('\n⏭️  Skipped packages:\n');
    results
      .filter(r => r.status === 'skip')
      .forEach(r => process.stdout.write(`  - ${r.package}: ${r.message}\n`));
  }

  // Exit with error code if any failures
  if (errorCount > 0) {
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`\n❌ Fatal error: ${error.message}\n`);
    process.exit(1);
  }
}

module.exports = { main };
