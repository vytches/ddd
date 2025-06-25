#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('📊 VytchesDDD Bundle Analysis');
console.log('');

// Load package configuration
const packagesConfig = JSON.parse(fs.readFileSync('config/packages.json', 'utf8'));
const packages = Object.keys(packagesConfig.packages);

// Bundle size analysis
function analyzeBundleSize(packageName) {
  const distPath = `packages/${packageName}/dist`;

  if (!fs.existsSync(distPath)) {
    return { error: 'No dist folder found' };
  }

  try {
    const files = fs.readdirSync(distPath);
    const analysis = {
      package: packageName,
      files: [],
      totalSize: 0,
      gzipSize: 0,
    };

    files.forEach(file => {
      const filePath = path.join(distPath, file);
      const stats = fs.statSync(filePath);

      if (stats.isFile()) {
        let gzipSize = 0;
        try {
          // Get gzip size if gzip is available
          const gzipOutput = execSync(`gzip -c "${filePath}" | wc -c`, { encoding: 'utf8' });
          gzipSize = parseInt(gzipOutput.trim());
        } catch (error) {
          // Fallback if gzip not available
          gzipSize = Math.round(stats.size * 0.3); // Rough estimate
        }

        analysis.files.push({
          name: file,
          size: stats.size,
          gzipSize: gzipSize,
          sizeFormatted: formatBytes(stats.size),
          gzipFormatted: formatBytes(gzipSize),
        });

        analysis.totalSize += stats.size;
        analysis.gzipSize += gzipSize;
      }
    });

    analysis.totalSizeFormatted = formatBytes(analysis.totalSize);
    analysis.gzipSizeFormatted = formatBytes(analysis.gzipSize);

    return analysis;
  } catch (error) {
    return { error: error.message };
  }
}

// Format bytes to human readable
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Check bundle size limits
function checkBundleLimits(analysis) {
  const limits = {
    core: { max: 50 * 1024, gzipMax: 15 * 1024 }, // 50KB / 15KB gzip
    utils: { max: 20 * 1024, gzipMax: 8 * 1024 }, // 20KB / 8KB gzip
    events: { max: 30 * 1024, gzipMax: 10 * 1024 }, // 30KB / 10KB gzip
    cqrs: { max: 40 * 1024, gzipMax: 12 * 1024 }, // 40KB / 12KB gzip
    enterprise: { max: 200 * 1024, gzipMax: 60 * 1024 }, // 200KB / 60KB gzip
  };

  const limit = limits[analysis.package] || { max: 100 * 1024, gzipMax: 30 * 1024 };

  return {
    sizeOk: analysis.totalSize <= limit.max,
    gzipOk: analysis.gzipSize <= limit.gzipMax,
    limit: limit,
  };
}

// Main analysis
function main() {
  const results = [];
  let totalSize = 0;
  let totalGzipSize = 0;
  let hasErrors = false;

  packages.forEach(packageName => {
    if (packageName === 'enterprise') return; // Skip bundle analysis for enterprise

    console.log(`📦 Analyzing ${packageName}...`);
    const analysis = analyzeBundleSize(packageName);

    if (analysis.error) {
      console.log(`  ❌ ${analysis.error}`);
      hasErrors = true;
      return;
    }

    const limits = checkBundleLimits(analysis);

    console.log(
      `  📊 Total: ${analysis.totalSizeFormatted} (${analysis.gzipSizeFormatted} gzipped)`
    );

    if (!limits.sizeOk) {
      console.log(`  ⚠️  Size exceeds limit: ${formatBytes(limits.limit.max)}`);
      hasErrors = true;
    }

    if (!limits.gzipOk) {
      console.log(`  ⚠️  Gzip size exceeds limit: ${formatBytes(limits.limit.gzipMax)}`);
      hasErrors = true;
    }

    if (limits.sizeOk && limits.gzipOk) {
      console.log(`  ✅ Within size limits`);
    }

    analysis.files.forEach(file => {
      console.log(`    📄 ${file.name}: ${file.sizeFormatted} (${file.gzipFormatted} gzipped)`);
    });

    console.log('');

    totalSize += analysis.totalSize;
    totalGzipSize += analysis.gzipSize;
    results.push(analysis);
  });

  // Summary
  console.log('📋 Summary:');
  console.log(
    `  📦 Total library size: ${formatBytes(totalSize)} (${formatBytes(totalGzipSize)} gzipped)`
  );
  console.log(`  📊 Number of packages: ${results.length}`);
  console.log(`  📈 Average package size: ${formatBytes(totalSize / results.length)}`);

  if (hasErrors) {
    console.log('');
    console.log('❌ Some packages exceed size limits!');
    process.exit(1);
  } else {
    console.log('');
    console.log('✅ All packages within size limits!');
  }
}

main();
