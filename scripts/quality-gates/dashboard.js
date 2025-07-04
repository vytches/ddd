#!/usr/bin/env node

/**
 * Quality Gates Dashboard
 * 
 * Interactive dashboard for tracking quality metrics over time.
 * Provides historical analysis, trends, and actionable insights.
 * 
 * Features:
 * - Historical data tracking
 * - Trend analysis and visualization
 * - Quality metric comparisons
 * - Actionable recommendations
 * - Export capabilities (JSON, CSV, HTML)
 * - CI/CD integration for reporting
 */

const fs = require('fs');
const path = require('path');
const yargs = require('yargs');

class QualityDashboard {
  constructor(options = {}) {
    this.dataDir = path.join(process.cwd(), '.quality-gates');
    this.historyFile = path.join(this.dataDir, 'quality-history.json');
    this.options = options;
    this.history = this.loadHistory();
  }

  /**
   * Load historical quality data
   */
  loadHistory() {
    try {
      if (fs.existsSync(this.historyFile)) {
        return JSON.parse(fs.readFileSync(this.historyFile, 'utf8'));
      }
    } catch (error) {
      console.warn('Could not load quality history:', error.message);
    }
    
    return {
      entries: [],
      summary: {
        totalRuns: 0,
        successRate: 0,
        averageAnyTypes: 0,
        averageBundleSize: 0,
        averageBuildTime: 0
      }
    };
  }

  /**
   * Save history to file
   */
  saveHistory() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    
    fs.writeFileSync(this.historyFile, JSON.stringify(this.history, null, 2));
  }

  /**
   * Add new quality gate results to history
   */
  addEntry(results) {
    const entry = {
      timestamp: results.timestamp || new Date().toISOString(),
      branch: this.getCurrentBranch(),
      commit: this.getCurrentCommit(),
      anyTypes: results.anyTypes ? {
        total: results.anyTypes.totalAnyTypes,
        justified: results.anyTypes.justifiedAnyTypes,
        unjustified: results.anyTypes.unjustifiedAnyTypes,
        violations: results.anyTypes.violations.length,
        passed: results.anyTypes.passed
      } : null,
      bundleSize: results.bundleSize ? {
        totalSourceSize: results.bundleSize.totalSourceSize,
        totalBuiltSize: results.bundleSize.totalBuiltSize,
        violations: results.bundleSize.violations.length,
        regressions: results.bundleSize.regressions.length,
        improvements: results.bundleSize.improvements.length,
        passed: results.bundleSize.passed
      } : null,
      performance: results.performance ? {
        buildTime: results.performance.globalMetrics.summary?.totalBuildTime || 0,
        testTime: results.performance.globalMetrics.summary?.totalTestTime || 0,
        violations: results.performance.violations.length,
        regressions: results.performance.regressions.length,
        passed: results.performance.passed
      } : null,
      summary: results.summary
    };

    this.history.entries.push(entry);
    this.updateSummary();
    this.saveHistory();
    
    return entry;
  }

  /**
   * Get current git branch
   */
  getCurrentBranch() {
    try {
      const { execSync } = require('child_process');
      return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
    } catch {
      return 'unknown';
    }
  }

  /**
   * Get current git commit
   */
  getCurrentCommit() {
    try {
      const { execSync } = require('child_process');
      return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
    } catch {
      return 'unknown';
    }
  }

  /**
   * Update summary statistics
   */
  updateSummary() {
    const entries = this.history.entries.filter(e => e.summary);
    const totalRuns = entries.length;
    
    if (totalRuns === 0) {
      return;
    }

    const successfulRuns = entries.filter(e => e.summary.overallStatus === 'passed').length;
    const successRate = Math.round((successfulRuns / totalRuns) * 100 * 100) / 100;

    // Calculate averages
    const anyTypesEntries = entries.filter(e => e.anyTypes);
    const bundleSizeEntries = entries.filter(e => e.bundleSize);
    const performanceEntries = entries.filter(e => e.performance);

    const averageAnyTypes = anyTypesEntries.length > 0 
      ? Math.round(anyTypesEntries.reduce((sum, e) => sum + e.anyTypes.total, 0) / anyTypesEntries.length * 100) / 100
      : 0;

    const averageBundleSize = bundleSizeEntries.length > 0
      ? Math.round(bundleSizeEntries.reduce((sum, e) => sum + e.bundleSize.totalSourceSize, 0) / bundleSizeEntries.length * 100) / 100
      : 0;

    const averageBuildTime = performanceEntries.length > 0
      ? Math.round(performanceEntries.reduce((sum, e) => sum + e.performance.buildTime, 0) / performanceEntries.length * 100) / 100
      : 0;

    this.history.summary = {
      totalRuns,
      successRate,
      averageAnyTypes,
      averageBundleSize,
      averageBuildTime,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Get trend analysis
   */
  getTrendAnalysis(days = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const recentEntries = this.history.entries.filter(entry => 
      new Date(entry.timestamp) >= cutoffDate
    );

    if (recentEntries.length < 2) {
      return {
        period: days,
        entries: recentEntries.length,
        trends: {},
        message: 'Insufficient data for trend analysis'
      };
    }

    // Calculate trends
    const trends = {};

    // Any types trend
    const anyTypesData = recentEntries.filter(e => e.anyTypes).map(e => e.anyTypes.total);
    if (anyTypesData.length >= 2) {
      const first = anyTypesData[0];
      const last = anyTypesData[anyTypesData.length - 1];
      trends.anyTypes = {
        direction: last > first ? 'increasing' : last < first ? 'decreasing' : 'stable',
        change: last - first,
        changePercent: first > 0 ? Math.round((last - first) / first * 100 * 100) / 100 : 0
      };
    }

    // Bundle size trend
    const bundleSizeData = recentEntries.filter(e => e.bundleSize).map(e => e.bundleSize.totalSourceSize);
    if (bundleSizeData.length >= 2) {
      const first = bundleSizeData[0];
      const last = bundleSizeData[bundleSizeData.length - 1];
      trends.bundleSize = {
        direction: last > first ? 'increasing' : last < first ? 'decreasing' : 'stable',
        change: Math.round((last - first) * 100) / 100,
        changePercent: first > 0 ? Math.round((last - first) / first * 100 * 100) / 100 : 0
      };
    }

    // Performance trend
    const buildTimeData = recentEntries.filter(e => e.performance).map(e => e.performance.buildTime);
    if (buildTimeData.length >= 2) {
      const first = buildTimeData[0];
      const last = buildTimeData[buildTimeData.length - 1];
      trends.performance = {
        direction: last > first ? 'slower' : last < first ? 'faster' : 'stable',
        change: Math.round((last - first) * 100) / 100,
        changePercent: first > 0 ? Math.round((last - first) / first * 100 * 100) / 100 : 0
      };
    }

    // Success rate trend
    const successData = recentEntries.map(e => e.summary.overallStatus === 'passed' ? 1 : 0);
    const recentSuccessRate = Math.round(successData.reduce((a, b) => a + b, 0) / successData.length * 100 * 100) / 100;
    trends.successRate = {
      current: recentSuccessRate,
      direction: recentSuccessRate >= 90 ? 'excellent' : recentSuccessRate >= 70 ? 'good' : 'needs_improvement'
    };

    return {
      period: days,
      entries: recentEntries.length,
      trends,
      message: 'Trend analysis complete'
    };
  }

  /**
   * Generate dashboard report
   */
  generateDashboard(options = {}) {
    const { format = 'console', days = 30, detailed = false } = options;

    if (format === 'json') {
      return JSON.stringify({
        history: this.history,
        trends: this.getTrendAnalysis(days)
      }, null, 2);
    }

    let report = '';
    
    // Header
    report += '📊 Quality Gates Dashboard\n';
    report += '='.repeat(60) + '\n\n';

    // Summary Statistics
    const { summary } = this.history;
    report += '📈 Summary Statistics:\n';
    report += `   Total Quality Gate Runs: ${summary.totalRuns}\n`;
    report += `   Success Rate: ${summary.successRate}%\n`;
    report += `   Average Any Types: ${summary.averageAnyTypes}\n`;
    report += `   Average Bundle Size: ${summary.averageBundleSize}KB\n`;
    report += `   Average Build Time: ${summary.averageBuildTime}s\n`;
    
    if (summary.lastUpdated) {
      const lastUpdate = new Date(summary.lastUpdated).toLocaleString();
      report += `   Last Updated: ${lastUpdate}\n`;
    }
    report += '\n';

    // Trend Analysis
    const trends = this.getTrendAnalysis(days);
    report += `📊 Trend Analysis (Last ${days} days):\n`;
    report += `   Data Points: ${trends.entries}\n`;
    
    if (trends.trends.anyTypes) {
      const trend = trends.trends.anyTypes;
      const icon = trend.direction === 'decreasing' ? '📉' : trend.direction === 'increasing' ? '📈' : '📊';
      report += `   ${icon} Any Types: ${trend.direction} (${trend.change > 0 ? '+' : ''}${trend.change}, ${trend.changePercent}%)\n`;
    }
    
    if (trends.trends.bundleSize) {
      const trend = trends.trends.bundleSize;
      const icon = trend.direction === 'decreasing' ? '📉' : trend.direction === 'increasing' ? '📈' : '📊';
      report += `   ${icon} Bundle Size: ${trend.direction} (${trend.change > 0 ? '+' : ''}${trend.change}KB, ${trend.changePercent}%)\n`;
    }
    
    if (trends.trends.performance) {
      const trend = trends.trends.performance;
      const icon = trend.direction === 'faster' ? '📉' : trend.direction === 'slower' ? '📈' : '📊';
      report += `   ${icon} Build Time: ${trend.direction} (${trend.change > 0 ? '+' : ''}${trend.change}s, ${trend.changePercent}%)\n`;
    }
    
    if (trends.trends.successRate) {
      const trend = trends.trends.successRate;
      const icon = trend.direction === 'excellent' ? '🟢' : trend.direction === 'good' ? '🟡' : '🔴';
      report += `   ${icon} Success Rate: ${trend.current}% (${trend.direction})\n`;
    }
    report += '\n';

    // Recent Activity
    const recentEntries = this.history.entries.slice(-5).reverse();
    if (recentEntries.length > 0) {
      report += '🕒 Recent Activity:\n';
      for (const entry of recentEntries) {
        const date = new Date(entry.timestamp).toLocaleString();
        const status = entry.summary.overallStatus === 'passed' ? '✅' : '❌';
        const violations = entry.summary.totalViolations;
        const branch = entry.branch !== 'unknown' ? ` (${entry.branch})` : '';
        
        report += `   ${status} ${date}${branch}: ${violations} violations\n`;
        
        if (detailed && violations > 0) {
          if (entry.anyTypes && entry.anyTypes.violations > 0) {
            report += `      • Any types: ${entry.anyTypes.violations} violations\n`;
          }
          if (entry.bundleSize && entry.bundleSize.violations > 0) {
            report += `      • Bundle size: ${entry.bundleSize.violations} violations\n`;
          }
          if (entry.performance && entry.performance.violations > 0) {
            report += `      • Performance: ${entry.performance.violations} violations\n`;
          }
        }
      }
      report += '\n';
    }

    // Recommendations
    report += '💡 Recommendations:\n';
    
    if (trends.trends.anyTypes?.direction === 'increasing') {
      report += '   • Focus on reducing `any` type usage - trend is increasing\n';
    }
    
    if (trends.trends.bundleSize?.direction === 'increasing') {
      report += '   • Review bundle size optimizations - growth detected\n';
    }
    
    if (trends.trends.performance?.direction === 'slower') {
      report += '   • Investigate build performance - times are increasing\n';
    }
    
    if (trends.trends.successRate?.direction === 'needs_improvement') {
      report += '   • Address quality gate failures - success rate is low\n';
    }
    
    if (summary.successRate >= 95) {
      report += '   • Excellent quality! Consider tightening thresholds\n';
    }
    
    report += '\n';

    return report;
  }

  /**
   * Export data in various formats
   */
  exportData(format, filePath) {
    let data;
    let content;

    switch (format) {
      case 'json':
        data = {
          history: this.history,
          trends: this.getTrendAnalysis(30),
          exported: new Date().toISOString()
        };
        content = JSON.stringify(data, null, 2);
        break;

      case 'csv':
        content = this.generateCSV();
        break;

      case 'html':
        content = this.generateHTML();
        break;

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }

    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, content);
    console.log(`📁 Data exported to ${filePath}`);
  }

  /**
   * Generate CSV export
   */
  generateCSV() {
    const headers = [
      'timestamp', 'branch', 'commit', 'overallStatus',
      'anyTypes_total', 'anyTypes_violations', 'anyTypes_passed',
      'bundleSize_total', 'bundleSize_violations', 'bundleSize_passed',
      'performance_buildTime', 'performance_violations', 'performance_passed',
      'totalViolations', 'totalRegressions'
    ];

    let csv = headers.join(',') + '\n';

    for (const entry of this.history.entries) {
      const row = [
        entry.timestamp,
        entry.branch || '',
        entry.commit || '',
        entry.summary?.overallStatus || '',
        entry.anyTypes?.total || '',
        entry.anyTypes?.violations || '',
        entry.anyTypes?.passed || '',
        entry.bundleSize?.totalSourceSize || '',
        entry.bundleSize?.violations || '',
        entry.bundleSize?.passed || '',
        entry.performance?.buildTime || '',
        entry.performance?.violations || '',
        entry.performance?.passed || '',
        entry.summary?.totalViolations || '',
        entry.summary?.totalRegressions || ''
      ];

      csv += row.join(',') + '\n';
    }

    return csv;
  }

  /**
   * Generate HTML export
   */
  generateHTML() {
    const trends = this.getTrendAnalysis(30);
    
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Quality Gates Dashboard</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 8px; }
        .metric { display: inline-block; margin: 10px; padding: 15px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .trend-up { color: #e74c3c; }
        .trend-down { color: #27ae60; }
        .trend-stable { color: #3498db; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f2f2f2; }
        .status-passed { color: #27ae60; }
        .status-failed { color: #e74c3c; }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 Quality Gates Dashboard</h1>
        <p>Generated: ${new Date().toLocaleString()}</p>
    </div>

    <h2>Summary Statistics</h2>
    <div class="metric">
        <h3>Total Runs</h3>
        <p>${this.history.summary.totalRuns}</p>
    </div>
    <div class="metric">
        <h3>Success Rate</h3>
        <p>${this.history.summary.successRate}%</p>
    </div>
    <div class="metric">
        <h3>Avg Any Types</h3>
        <p>${this.history.summary.averageAnyTypes}</p>
    </div>
    <div class="metric">
        <h3>Avg Bundle Size</h3>
        <p>${this.history.summary.averageBundleSize}KB</p>
    </div>
    <div class="metric">
        <h3>Avg Build Time</h3>
        <p>${this.history.summary.averageBuildTime}s</p>
    </div>

    <h2>Recent Quality Gate Runs</h2>
    <table>
        <thead>
            <tr>
                <th>Timestamp</th>
                <th>Branch</th>
                <th>Status</th>
                <th>Any Types</th>
                <th>Bundle Size (KB)</th>
                <th>Build Time (s)</th>
                <th>Violations</th>
            </tr>
        </thead>
        <tbody>
            ${this.history.entries.slice(-10).reverse().map(entry => `
                <tr>
                    <td>${new Date(entry.timestamp).toLocaleString()}</td>
                    <td>${entry.branch}</td>
                    <td class="status-${entry.summary?.overallStatus === 'passed' ? 'passed' : 'failed'}">
                        ${entry.summary?.overallStatus === 'passed' ? '✅ Passed' : '❌ Failed'}
                    </td>
                    <td>${entry.anyTypes?.total || 'N/A'}</td>
                    <td>${entry.bundleSize?.totalSourceSize || 'N/A'}</td>
                    <td>${entry.performance?.buildTime || 'N/A'}</td>
                    <td>${entry.summary?.totalViolations || 0}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>
</body>
</html>`;
  }
}

// CLI interface
async function main() {
  const argv = yargs
    .command('add <results-file>', 'Add quality gate results to history', {
      'results-file': {
        describe: 'Path to quality gate results JSON file',
        type: 'string'
      }
    })
    .command('dashboard', 'Show quality dashboard', {
      days: {
        describe: 'Number of days for trend analysis',
        type: 'number',
        default: 30
      },
      detailed: {
        describe: 'Show detailed information',
        type: 'boolean',
        default: false
      }
    })
    .command('export <format> <file>', 'Export data', {
      format: {
        describe: 'Export format',
        choices: ['json', 'csv', 'html'],
        type: 'string'
      },
      file: {
        describe: 'Output file path',
        type: 'string'
      }
    })
    .command('trends [days]', 'Show trend analysis', {
      days: {
        describe: 'Number of days to analyze',
        type: 'number',
        default: 30
      }
    })
    .option('format', {
      type: 'string',
      choices: ['console', 'json'],
      description: 'Output format',
      default: 'console'
    })
    .help()
    .argv;

  const dashboard = new QualityDashboard();

  try {
    if (argv._[0] === 'add') {
      const resultsFile = argv.resultsFile;
      if (!fs.existsSync(resultsFile)) {
        throw new Error(`Results file not found: ${resultsFile}`);
      }
      
      const results = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
      const entry = dashboard.addEntry(results);
      console.log('✅ Added quality gate results to history');
      console.log(`📊 Entry: ${entry.timestamp} - ${entry.summary.overallStatus}`);
      
    } else if (argv._[0] === 'export') {
      dashboard.exportData(argv.format, argv.file);
      
    } else if (argv._[0] === 'trends') {
      const trends = dashboard.getTrendAnalysis(argv.days);
      console.log(JSON.stringify(trends, null, 2));
      
    } else {
      // Default dashboard command
      const report = dashboard.generateDashboard({
        format: argv.format,
        days: argv.days || 30,
        detailed: argv.detailed
      });
      console.log(report);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { QualityDashboard };