#!/usr/bin/env node

/**
 * Generate TypeScript declaration file for meta-packages
 * This script creates a proper .d.ts file that includes all type definitions inline
 * instead of using relative imports that break in published packages
 */

const fs = require('fs');
const path = require('path');

function generateMetaTypes(packagePath) {
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

  console.log(`Generating types for meta-package: ${packageName}`);

  // Check if there's a template file
  const templatePath = path.join(packagePath, 'index.d.ts.template');
  if (fs.existsSync(templatePath)) {
    // Use template file
    const templateContent = fs.readFileSync(templatePath, 'utf-8');

    // Write the generated file
    const distPath = path.join(packagePath, 'dist');
    if (!fs.existsSync(distPath)) {
      fs.mkdirSync(distPath, { recursive: true });
    }

    const outputPath = path.join(distPath, 'index.d.ts');
    fs.writeFileSync(outputPath, templateContent);

    console.log(`Generated types file from template: ${outputPath}`);
    return;
  }

  // Fallback: generate from source file
  const sourceIndexPath = path.join(packagePath, 'src', 'index.ts');
  if (!fs.existsSync(sourceIndexPath)) {
    console.log(`No source file found for ${packageName}`);
    return;
  }

  const sourceContent = fs.readFileSync(sourceIndexPath, 'utf-8');

  // Parse exports and convert relative paths to package imports
  const lines = sourceContent.split('\n');
  const generatedContent = [];

  // Add header
  generatedContent.push('/**');
  generatedContent.push(` * @file VytchesDDD - Complete Domain-Driven Design framework`);
  generatedContent.push(` * @module @vytches/ddd`);
  generatedContent.push(' */');
  generatedContent.push('');

  // Process each line
  for (const line of lines) {
    if (line.trim().startsWith('export') && line.includes('../../')) {
      // Convert relative imports to package imports
      const convertedLine = line.replace(/\.\.\/\.\.\/([^/]+)\/src\/index\.ts/g, '@vytches/ddd-$1');
      generatedContent.push(convertedLine);
    } else if (
      line.trim().startsWith('export') ||
      line.trim().startsWith('/**') ||
      line.trim().startsWith(' *')
    ) {
      // Keep other exports and comments
      generatedContent.push(line);
    } else if (line.trim() === '') {
      // Keep empty lines
      generatedContent.push('');
    }
  }

  // Write the generated file
  const distPath = path.join(packagePath, 'dist');
  if (!fs.existsSync(distPath)) {
    fs.mkdirSync(distPath, { recursive: true });
  }

  const outputPath = path.join(distPath, 'index.d.ts');
  fs.writeFileSync(outputPath, generatedContent.join('\n'));

  console.log(`Generated types file: ${outputPath}`);
}

// Main execution
const packagesDir = path.join(__dirname, '..', 'packages');
const packageDirs = fs
  .readdirSync(packagesDir)
  .filter(dir => fs.statSync(path.join(packagesDir, dir)).isDirectory());

for (const packageDir of packageDirs) {
  const packagePath = path.join(packagesDir, packageDir);
  try {
    generateMetaTypes(packagePath);
  } catch (error) {
    console.error(`Error processing ${packageDir}:`, error.message);
  }
}
