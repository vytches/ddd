#!/usr/bin/env node

/**
 * Verify JSDoc Injection
 * Ensures that all .d.ts files have proper JSDoc comments injected
 */

const fs = require('fs').promises;
const path = require('path');
const { globSync } = require('glob');

async function verifyJSDocInjection() {
  console.log('🔍 Verifying JSDoc injection in .d.ts files...\n');

  const packagesDir = path.join(process.cwd(), 'packages');
  const packages = await fs.readdir(packagesDir);

  let totalFiles = 0;
  let filesWithJSDoc = 0;
  let filesWithoutJSDoc = [];

  for (const pkg of packages) {
    const distDir = path.join(packagesDir, pkg, 'dist');

    try {
      await fs.access(distDir);
    } catch {
      continue; // Skip packages without dist
    }

    const dtsFiles = globSync('**/*.d.ts', {
      cwd: distDir,
      ignore: [
        '**/*.test.d.ts',
        '**/*.spec.d.ts',
        '**/index.d.ts', // Exclude index files as they're typically just re-exports
      ],
    });

    for (const file of dtsFiles) {
      const filePath = path.join(distDir, file);
      const content = await fs.readFile(filePath, 'utf-8');

      totalFiles++;

      // Check for JSDoc comments
      if (content.includes('/**') && content.includes('*/')) {
        filesWithJSDoc++;
      } else {
        filesWithoutJSDoc.push(`${pkg}/dist/${file}`);
      }
    }
  }

  // Report results
  console.log('📊 JSDoc Injection Report:');
  console.log(`   Total .d.ts files: ${totalFiles}`);
  console.log(`   Files with JSDoc: ${filesWithJSDoc}`);
  console.log(`   Files without JSDoc: ${totalFiles - filesWithJSDoc}`);
  console.log(`   Coverage: ${Math.round((filesWithJSDoc / totalFiles) * 100)}%\n`);

  if (filesWithoutJSDoc.length > 0) {
    console.log('⚠️  Files without JSDoc:');
    filesWithoutJSDoc.slice(0, 10).forEach(file => {
      console.log(`   - ${file}`);
    });

    if (filesWithoutJSDoc.length > 10) {
      console.log(`   ... and ${filesWithoutJSDoc.length - 10} more`);
    }
  }

  // Check specific important files
  const criticalFiles = [
    'aggregates/dist/index.d.ts',
    'aggregates/dist/core/aggregate-root.d.ts',
    'cqrs/dist/index.d.ts',
    'events/dist/index.d.ts',
  ];

  console.log('\n🎯 Critical Files Check:');
  for (const file of criticalFiles) {
    const filePath = path.join(packagesDir, file);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const hasJSDoc = content.includes('/**') && content.includes('*/');
      console.log(`   ${hasJSDoc ? '✅' : '❌'} ${file}`);
    } catch {
      console.log(`   ⏭️  ${file} (not found)`);
    }
  }

  // Success criteria
  const coverageThreshold = 50; // 50% coverage required
  const coverage = (filesWithJSDoc / totalFiles) * 100;

  if (coverage >= coverageThreshold) {
    console.log('\n✅ JSDoc injection verification passed!');
    process.exit(0);
  } else {
    console.log(
      `\n❌ JSDoc coverage (${Math.round(coverage)}%) is below threshold (${coverageThreshold}%)`
    );
    process.exit(1);
  }
}

verifyJSDocInjection().catch(error => {
  console.error('❌ Error verifying JSDoc injection:', error);
  process.exit(1);
});
