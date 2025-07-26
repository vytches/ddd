#!/usr/bin/env node

/**
 * Export Verification Script for VytchesDDD
 *
 * This script verifies that:
 * 1. Foundation packages build their own code (not just utils)
 * 2. Meta-package (enterprise) properly bundles and re-exports all sub-packages
 * 3. No exports are missing from the main entry point
 * 4. Critical functionality is accessible to end users
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  gray: '\x1b[90m',
};

const log = {
  error: msg => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  success: msg => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  warn: msg => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  info: msg => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  section: msg => console.log(`\n${colors.blue}${msg}${colors.reset}\n${'='.repeat(50)}`),
};

// Configuration
const FOUNDATION_PACKAGES = [
  'contracts',
  'domain-primitives',
  'value-objects',
  'repositories',
  'aggregates',
];

const CRITICAL_EXPORTS = {
  events: [
    'UniversalEventDispatcher',
    'UnifiedEventBus',
    'BaseEventBus',
    'CUSTOM_MIDDLEWARE_SYMBOL',
    'DomainEvent',
    'EventHandler',
    'EventDiscoveryPlugin',
  ],
  contracts: [
    'createDomainEvent',
    'isEventHandler',
    'Capability',
    'CapabilityRegistry',
    'IEventBus',
    'IEventDispatcher',
  ],
  'value-objects': ['EntityId', 'EntityIdFactory', 'BaseValueObject'],
  'domain-primitives': ['BaseError', 'IDomainError', 'MissingValueError', 'InvalidParameterError'],
  utils: ['safeRun', 'Result', 'LibUtils'],
};

let hasErrors = false;

// Helper functions
function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    log.error(`Failed to read ${filePath}: ${err.message}`);
    return null;
  }
}

function extractExportsFromSource(content) {
  const exports = new Set();
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith('export ')) {
      // Handle multi-line exports
      let fullExport = line;
      if (line.includes('{') && !line.includes('}')) {
        let j = i + 1;
        while (j < lines.length && !fullExport.includes('}')) {
          fullExport += ' ' + lines[j].trim();
          j++;
        }
      }

      // Extract names from export statements
      const patterns = [
        /export\s+\{([^}]+)\}/g,
        /export\s+(?:class|interface|enum|const|function|type)\s+(\w+)/g,
        /export\s+type\s+\{([^}]+)\}/g,
      ];

      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(fullExport)) !== null) {
          if (match[1].includes(',')) {
            // Multiple exports
            match[1].split(',').forEach(exp => {
              const name = exp
                .trim()
                .split(/\s+as\s+/)[0]
                .trim();
              // Skip comments and 'from' keywords
              if (name && !name.includes('from') && !name.startsWith('//') && name.match(/^\w+$/)) {
                exports.add(name);
              }
            });
          } else {
            const name = match[1].trim();
            // Skip comments and 'from' keywords
            if (name && !name.includes('from') && !name.startsWith('//') && name.match(/^\w+$/)) {
              exports.add(name);
            }
          }
        }
      }
    }
  }

  return Array.from(exports);
}

// Verification functions
function verifyFoundationPackageBuild(packageName) {
  log.info(`Checking ${packageName} build output...`);

  const distPath = path.join(__dirname, '..', 'packages', packageName, 'dist', 'index.cjs');

  if (!fileExists(distPath)) {
    log.error(`Build output not found: ${distPath}`);
    hasErrors = true;
    return false;
  }

  const content = readFile(distPath);
  if (!content) {
    hasErrors = true;
    return false;
  }

  // Check if the package has its own unique exports (not just LibUtils from utils)
  const hasOwnExports =
    packageName === 'utils'
      ? content.includes('LibUtils') && content.includes('Result')
      : !content.includes('exports.LibUtils') ||
        content.includes(`exports.${packageName.charAt(0).toUpperCase()}`);

  if (!hasOwnExports) {
    log.error(`${packageName} appears to be building utils code instead of its own!`);
    hasErrors = true;
    return false;
  }

  // Check file size to ensure it's not just a re-export
  const stats = fs.statSync(distPath);
  if (stats.size < 1000 && packageName !== 'utils') {
    log.warn(`${packageName} build output suspiciously small: ${stats.size} bytes`);
  }

  log.success(`${packageName} builds its own code correctly`);
  return true;
}

function verifyMetaPackageBundling() {
  log.info('Checking enterprise (meta-package) bundling...');

  const enterprisePath = path.join(__dirname, '..', 'packages', 'enterprise', 'dist', 'index.cjs');

  if (!fileExists(enterprisePath)) {
    log.error('Enterprise build output not found');
    hasErrors = true;
    return false;
  }

  const stats = fs.statSync(enterprisePath);
  const sizeKB = (stats.size / 1024).toFixed(2);

  // Meta-package should be large (bundling all sub-packages)
  if (stats.size < 100000) {
    log.error(`Enterprise bundle too small (${sizeKB}KB) - likely not bundling dependencies`);
    hasErrors = true;
    return false;
  }

  log.success(`Enterprise bundle size: ${sizeKB}KB - properly bundling sub-packages`);

  // Load the module to check exports
  try {
    delete require.cache[require.resolve(enterprisePath)];
    const enterprise = require(enterprisePath);
    const exportCount = Object.keys(enterprise).filter(k => k !== 'default').length;

    if (exportCount < 200) {
      log.warn(`Enterprise has only ${exportCount} exports - might be missing some`);
    } else {
      log.success(`Enterprise exports ${exportCount} items`);
    }

    return enterprise;
  } catch (err) {
    log.error(`Failed to load enterprise module: ${err.message}`);
    hasErrors = true;
    return false;
  }
}

function verifyCriticalExports(enterprise) {
  log.info('Verifying critical exports are available...');

  let missingCount = 0;

  for (const [packageName, exports] of Object.entries(CRITICAL_EXPORTS)) {
    const missing = [];

    for (const exportName of exports) {
      if (!(exportName in enterprise)) {
        missing.push(exportName);
        missingCount++;
      }
    }

    if (missing.length > 0) {
      log.error(`Missing from ${packageName}: ${missing.join(', ')}`);
      hasErrors = true;
    } else {
      log.success(`All critical exports from ${packageName} are available`);
    }
  }

  // Check special cases
  if (!('BaseEntityId' in enterprise)) {
    log.error('Missing BaseEntityId (contracts EntityId exported as BaseEntityId)');
    hasErrors = true;
    missingCount++;
  }

  return missingCount === 0;
}

function verifyNoMissingExports() {
  log.info('Checking for potentially missing exports...');

  const packagesToCheck = ['contracts', 'value-objects', 'events'];
  const enterpriseSrc = path.join(__dirname, '..', 'packages', 'enterprise', 'src', 'index.ts');
  const enterpriseContent = readFile(enterpriseSrc);

  if (!enterpriseContent) {
    hasErrors = true;
    return false;
  }

  for (const packageName of packagesToCheck) {
    const srcPath = path.join(__dirname, '..', 'packages', packageName, 'src', 'index.ts');
    const content = readFile(srcPath);

    if (!content) continue;

    const packageExports = extractExportsFromSource(content);
    const isWildcardExported = enterpriseContent.includes(
      `export * from '@vytches/ddd-${packageName}'`
    );

    if (!isWildcardExported) {
      // Check if all exports are explicitly listed
      const missing = packageExports.filter(exp => {
        // Skip type-only exports that might be listed differently
        if (exp.startsWith('type ')) return false;

        // Check if export is mentioned in enterprise
        return !enterpriseContent.includes(exp);
      });

      if (missing.length > 0) {
        log.warn(`Potentially missing from ${packageName}: ${missing.join(', ')}`);
        log.info(
          `Consider using "export * from '@vytches/ddd-${packageName}'" if no conflicts exist`
        );
      }
    }
  }

  return true;
}

function verifyBuildSystem() {
  log.info('Verifying shared build configuration...');

  const viteConfigPath = path.join(__dirname, '..', 'packages', 'utils', 'vite.config.mts');
  const viteContent = readFile(viteConfigPath);

  if (!viteContent) {
    hasErrors = true;
    return false;
  }

  // Check for createFoundationConfig function
  if (!viteContent.includes('createFoundationConfig')) {
    log.error('createFoundationConfig function not found in utils/vite.config.mts');
    hasErrors = true;
    return false;
  }

  // Check that foundation packages use the shared config
  for (const pkg of FOUNDATION_PACKAGES) {
    if (pkg === 'utils') continue;

    const pkgVitePath = path.join(__dirname, '..', 'packages', pkg, 'vite.config.mts');
    const pkgViteContent = readFile(pkgVitePath);

    if (!pkgViteContent || !pkgViteContent.includes('createFoundationConfig')) {
      log.warn(`${pkg} not using shared createFoundationConfig`);
    }
  }

  log.success('Build system configuration verified');
  return true;
}

// Main verification flow
async function main() {
  console.log('\n🔍 VytchesDDD Export Verification Script\n');

  // 1. Verify foundation packages build correctly
  log.section('1. FOUNDATION PACKAGES BUILD VERIFICATION');
  for (const pkg of FOUNDATION_PACKAGES) {
    verifyFoundationPackageBuild(pkg);
  }

  // 2. Verify meta-package bundling
  log.section('2. META-PACKAGE BUNDLING VERIFICATION');
  const enterprise = verifyMetaPackageBundling();

  if (enterprise) {
    // 3. Verify critical exports
    log.section('3. CRITICAL EXPORTS VERIFICATION');
    verifyCriticalExports(enterprise);

    // 4. Check for missing exports
    log.section('4. MISSING EXPORTS CHECK');
    verifyNoMissingExports();
  }

  // 5. Verify build system
  log.section('5. BUILD SYSTEM VERIFICATION');
  verifyBuildSystem();

  // Summary
  log.section('VERIFICATION SUMMARY');
  if (hasErrors) {
    log.error('Export verification FAILED - issues found!');
    process.exit(1);
  } else {
    log.success('Export verification PASSED - all checks successful!');
    log.info('Run "pnpm verify:exports" to check again');
    process.exit(0);
  }
}

// Run verification
main().catch(err => {
  log.error(`Verification script failed: ${err.message}`);
  process.exit(1);
});
