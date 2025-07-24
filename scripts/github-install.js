#!/usr/bin/env node

/**
 * GitHub Installation Build Script
 * Automatically builds the library when installed from GitHub
 */

const { execSync } = require('child_process');
const { existsSync } = require('fs');
const path = require('path');

console.log('🚀 VytchesDDD: Preparing library for GitHub installation...');

// Check if we're in a fresh install (no dist folders)
const packagesDir = path.join(__dirname, '..', 'packages');
const coreDistPath = path.join(packagesDir, 'core', 'dist');

if (!existsSync(coreDistPath)) {
  console.log('📦 Building library packages...');

  try {
    // Install dependencies if needed
    if (!existsSync(path.join(__dirname, '..', 'node_modules'))) {
      console.log('📥 Installing dependencies...');
      execSync('pnpm install', {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..'),
      });
    }

    // Build the library for distribution
    console.log('🔨 Building packages for distribution...');
    execSync('node scripts/build-distribution.js', {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
    });

    console.log('✅ VytchesDDD build completed successfully!');
    console.log('📚 Ready to use: import { AggregateRoot } from "vytches-ddd/core"');
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    console.log('⚠️  You may need to build manually: cd node_modules/vytches-ddd && pnpm build');
    process.exit(0); // Don't fail the installation
  }
} else {
  console.log('✅ VytchesDDD already built and ready to use!');
}
