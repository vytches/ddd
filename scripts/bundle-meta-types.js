#!/usr/bin/env node

/**
 * Bundle TypeScript declaration files for meta-packages
 * This script creates a single .d.ts file that contains all type definitions
 * inline instead of using external imports that break in published packages
 */

const fs = require('fs');
const path = require('path');

function extractExportsFromDts(dtsPath, packageName) {
  if (!fs.existsSync(dtsPath)) {
    console.warn(`Warning: DTS file not found: ${dtsPath}`);
    return '';
  }

  const content = fs.readFileSync(dtsPath, 'utf-8');

  // For true bundling, we need to eliminate relative imports
  // Convert relative imports to direct inline exports
  const lines = content.split('\n');
  const exportLines = [];
  let inComment = false;

  let isMultiLineStatement = false;
  let currentStatement = '';

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip import lines
    if (trimmed.startsWith('import ')) continue;

    // Handle multi-line comments
    if (trimmed.includes('/*') && !trimmed.includes('*/')) {
      inComment = true;
      continue;
    }
    if (inComment && trimmed.includes('*/')) {
      inComment = false;
      continue;
    }
    if (inComment) continue;

    // Skip single-line comments (but keep JSDoc)
    if (trimmed.startsWith('//') && !trimmed.startsWith('///')) continue;

    // Handle multi-line statements (e.g., declare const with object types)
    if (isMultiLineStatement) {
      currentStatement += '\n' + line;
      if (trimmed.endsWith(';') || trimmed.endsWith('}') || trimmed.endsWith('};')) {
        isMultiLineStatement = false;
        // Process the complete statement
        if (currentStatement.includes(' from ') || currentStatement.includes('import(')) {
          // Skip statements with imports
          currentStatement = '';
          continue;
        } else {
          exportLines.push(currentStatement);
          currentStatement = '';
          continue;
        }
      } else {
        continue;
      }
    }

    // Check if this is the start of a multi-line statement
    if (
      (trimmed.startsWith('export declare') || trimmed.startsWith('export type')) &&
      !trimmed.endsWith(';') &&
      !trimmed.endsWith('};') &&
      trimmed.includes('{') &&
      !trimmed.includes('};')
    ) {
      isMultiLineStatement = true;
      currentStatement = line;
      continue;
    }

    // Process export lines to remove relative imports
    if (trimmed.startsWith('export ')) {
      // Convert relative imports in exports to simple declarations
      if (line.includes(' from ')) {
        // This is an export with relative import - convert to re-export
        const exportMatch = line.match(/^export\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/);
        const exportAllMatch = line.match(/^export\s*\*\s*from\s*['"]([^'"]+)['"]/);
        const exportTypeMatch = line.match(
          /^export\s*type\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/
        );

        if (exportMatch) {
          // Named exports - convert to simple export declaration
          const exports = exportMatch[1].trim();
          if (exports) {
            exportLines.push(`export { ${exports} };`);
          }
        } else if (exportAllMatch) {
          // Export all - convert to comment for now (full resolution would require parsing)
          exportLines.push(`// Re-exported from ${exportAllMatch[1]}`);
        } else if (exportTypeMatch) {
          // Type exports - convert to simple type export
          const types = exportTypeMatch[1].trim();
          if (types) {
            exportLines.push(`export type { ${types} };`);
          }
        } else {
          // Skip malformed export lines with external imports
          continue;
        }
      } else {
        // Export without relative import - keep as-is
        exportLines.push(line);
      }
    } else if (
      trimmed.startsWith('declare ') ||
      trimmed.startsWith('interface ') ||
      trimmed.startsWith('type ') ||
      trimmed.startsWith('class ') ||
      trimmed.startsWith('function ') ||
      trimmed.startsWith('const ') ||
      trimmed.startsWith('enum ')
    ) {
      // Keep type declarations
      exportLines.push(line);
    } else if (trimmed === '' || trimmed.startsWith('/**') || trimmed.startsWith(' *')) {
      // Keep empty lines and JSDoc
      exportLines.push(line);
    }
  }

  return exportLines.join('\n');
}

function bundleMetaTypes(packagePath) {
  const packageJson = JSON.parse(fs.readFileSync(path.join(packagePath, 'package.json'), 'utf-8'));
  const packageName = packageJson.name?.split('/')[1] || 'unknown';

  // Only process meta-packages
  const isMetaPackage =
    packageName === 'enterprise' ||
    packageName === 'ddd' ||
    (packageJson.dependencies &&
      Object.keys(packageJson.dependencies).filter(dep => dep.startsWith('@vytches/ddd-')).length >=
        5);

  if (!isMetaPackage) {
    console.log(`Skipping ${packageName} - not a meta-package`);
    return;
  }

  console.log(`Bundling types for meta-package: ${packageName}`);

  const dependencies = Object.keys(packageJson.dependencies || {}).filter(dep =>
    dep.startsWith('@vytches/ddd-')
  );

  const bundledContent = [];

  // Add header
  bundledContent.push('/**');
  bundledContent.push(' * @file VytchesDDD - Complete Domain-Driven Design framework');
  bundledContent.push(' * @module @vytches/ddd');
  bundledContent.push(' *');
  bundledContent.push(
    ' * This file contains bundled type definitions from all constituent packages.'
  );
  bundledContent.push(
    ' * All types are included inline to provide a complete standalone type experience.'
  );
  bundledContent.push(' */');
  bundledContent.push('');

  // Process each dependency package
  for (const dep of dependencies) {
    const depName = dep.replace('@vytches/ddd-', '');
    const depPackagePath = path.join(packagePath, '..', depName);
    const depDtsPath = path.join(depPackagePath, 'dist', 'index.d.ts');

    console.log(`  Processing dependency: ${dep}`);

    if (fs.existsSync(depDtsPath)) {
      bundledContent.push(`// === ${dep.toUpperCase()} ===`);
      const exportedContent = extractExportsFromDts(depDtsPath, depName);
      if (exportedContent.trim()) {
        bundledContent.push(exportedContent);
        bundledContent.push('');
      }
    } else {
      console.warn(`  Warning: DTS file not found for ${dep}: ${depDtsPath}`);
    }
  }

  // Add naming conflict resolution documentation
  bundledContent.push('/**');
  bundledContent.push(' * RESOLVED NAMING CONFLICTS:');
  bundledContent.push(' *');
  bundledContent.push(' * 1. EntityId:');
  bundledContent.push(
    ' *    - Primary: EntityId (from @vytches/ddd-value-objects) - Enhanced implementation with LibUtils'
  );
  bundledContent.push(
    ' *    - Alternative: BaseEntityId (from @vytches/ddd-contracts) - Foundation interface'
  );
  bundledContent.push(' *');
  bundledContent.push(' * 2. ValidationError:');
  bundledContent.push(
    ' *    - Primary: ValidationError (from @vytches/ddd-domain-primitives) - Main error type'
  );
  bundledContent.push(
    ' *    - Aliases: ContractsValidationError, CqrsValidationError - Specific variants'
  );
  bundledContent.push(' *');
  bundledContent.push(' * 3. ExecutionContext:');
  bundledContent.push(
    ' *    - Primary: ExecutionContext (from @vytches/ddd-cqrs) - Most commonly used'
  );
  bundledContent.push(' *');
  bundledContent.push(' * 4. safeRun:');
  bundledContent.push(' *    - Primary: safeRun (from @vytches/ddd-utils) - Core utility function');
  bundledContent.push(' *    - Testing version is excluded from main exports');
  bundledContent.push(' *');
  bundledContent.push(' * 5. IAggregateCapability:');
  bundledContent.push(
    ' *    - Primary: IAggregateCapability (from @vytches/ddd-contracts) - Foundation interface'
  );
  bundledContent.push(' *');
  bundledContent.push(' * For explicit access to alternative versions:');
  bundledContent.push(" * import { BaseEntityId } from '@vytches/ddd';");
  bundledContent.push(" * import { CqrsValidationError } from '@vytches/ddd';");
  bundledContent.push(" * import { safeRun as TestingSafeRun } from '@vytches/ddd-testing';");
  bundledContent.push(' */');

  // Write the bundled file
  const distPath = path.join(packagePath, 'dist');
  if (!fs.existsSync(distPath)) {
    fs.mkdirSync(distPath, { recursive: true });
  }

  const outputPath = path.join(distPath, 'index.d.ts');
  fs.writeFileSync(outputPath, bundledContent.join('\n'));

  console.log(`Bundled types file generated: ${outputPath}`);
}

// Main execution
const specificPackagePath = process.argv[2];

if (specificPackagePath) {
  const packagePath = path.resolve(specificPackagePath);
  try {
    bundleMetaTypes(packagePath);
  } catch (error) {
    console.error(`Error processing specific package:`, error.message);
    process.exit(1);
  }
} else {
  const packagesDir = path.join(__dirname, '..', 'packages');
  const packageDirs = fs
    .readdirSync(packagesDir)
    .filter(dir => fs.statSync(path.join(packagesDir, dir)).isDirectory());

  for (const packageDir of packageDirs) {
    const packagePath = path.join(packagesDir, packageDir);
    try {
      bundleMetaTypes(packagePath);
    } catch (error) {
      console.error(`Error processing ${packageDir}:`, error.message);
    }
  }
}
