/* eslint-disable no-case-declarations */
/**
 * Metric exporters for different output formats
 * Zero external dependencies - pure TypeScript implementation
 */

import type {
  HistogramMetric,
  Metric,
  MetricExporter,
  MetricLabels,
  TimerMetric,
} from './metrics-interfaces';

export class JsonMetricExporter implements MetricExporter {
  private readonly pretty: boolean;

  constructor(pretty = false) {
    this.pretty = pretty;
  }

  export(metrics: ReadonlyArray<Metric | HistogramMetric | TimerMetric>): string {
    const exportData = {
      timestamp: Date.now(),
      metrics: metrics.map(metric => this.serializeMetric(metric)),
    };

    return this.pretty ? JSON.stringify(exportData, null, 2) : JSON.stringify(exportData);
  }

  getFormat(): string {
    return 'json';
  }

  private serializeMetric(metric: Metric | HistogramMetric | TimerMetric): Record<string, unknown> {
    const base = {
      name: metric.name,
      type: metric.type,
      labels: metric.labels,
      timestamp: metric.timestamp,
      description: metric.description,
    };

    switch (metric.type) {
      case 'histogram':
        const histogramMetric = metric as HistogramMetric;
        return {
          ...base,
          buckets: histogramMetric.buckets,
          sum: histogramMetric.sum,
          count: histogramMetric.count,
        };
      case 'timer':
        const timerMetric = metric as TimerMetric;
        return {
          ...base,
          duration: timerMetric.duration,
          unit: timerMetric.unit,
        };
      default:
        const basicMetric = metric as Metric;
        return {
          ...base,
          value: basicMetric.value,
        };
    }
  }
}

export class PrometheusMetricExporter implements MetricExporter {
  export(metrics: ReadonlyArray<Metric | HistogramMetric | TimerMetric>): string {
    const lines: string[] = [];
    const metricGroups = this.groupMetricsByName(metrics);

    for (const [metricName, metricGroup] of metricGroups) {
      // Add help comment if description is available
      const firstMetric = metricGroup[0];
      if (firstMetric && firstMetric.description) {
        lines.push(`# HELP ${metricName} ${firstMetric.description}`);
      }

      // Add type comment
      if (firstMetric) {
        lines.push(`# TYPE ${metricName} ${this.getPrometheusType(firstMetric.type)}`);
      }

      // Add metric lines
      for (const metric of metricGroup) {
        lines.push(...this.formatMetricForPrometheus(metric));
      }

      lines.push(''); // Empty line between metric groups
    }

    return lines.join('\n');
  }

  getFormat(): string {
    return 'prometheus';
  }

  private groupMetricsByName(
    metrics: ReadonlyArray<Metric | HistogramMetric | TimerMetric>
  ): Map<string, (Metric | HistogramMetric | TimerMetric)[]> {
    const groups = new Map<string, (Metric | HistogramMetric | TimerMetric)[]>();

    for (const metric of metrics) {
      const group = groups.get(metric.name) || [];
      group.push(metric);
      groups.set(metric.name, group);
    }

    return groups;
  }

  private getPrometheusType(type: string): string {
    switch (type) {
      case 'counter':
        return 'counter';
      case 'gauge':
        return 'gauge';
      case 'histogram':
        return 'histogram';
      case 'timer':
        return 'histogram'; // Timers are represented as histograms in Prometheus
      default:
        return 'gauge';
    }
  }

  private formatMetricForPrometheus(metric: Metric | HistogramMetric | TimerMetric): string[] {
    const lines: string[] = [];
    const labelStr = this.formatLabels(metric.labels);

    switch (metric.type) {
      case 'histogram':
        const histogramMetric = metric as HistogramMetric;
        // Histogram buckets
        for (const bucket of histogramMetric.buckets) {
          const bucketLabels = {
            ...metric.labels,
            le: bucket.upperBound === Infinity ? '+Inf' : bucket.upperBound.toString(),
          };
          lines.push(
            `${metric.name}_bucket${this.formatLabels(bucketLabels)} ${bucket.count} ${metric.timestamp}`
          );
        }
        // Histogram sum and count
        lines.push(`${metric.name}_sum${labelStr} ${histogramMetric.sum} ${metric.timestamp}`);
        lines.push(`${metric.name}_count${labelStr} ${histogramMetric.count} ${metric.timestamp}`);
        break;

      case 'timer':
        const timerMetric = metric as TimerMetric;
        // Convert timer to histogram format
        lines.push(`${metric.name}${labelStr} ${timerMetric.duration} ${metric.timestamp}`);
        break;

      default:
        const basicMetric = metric as Metric;
        lines.push(`${metric.name}${labelStr} ${basicMetric.value} ${metric.timestamp}`);
        break;
    }

    return lines;
  }

  private formatLabels(labels: MetricLabels): string {
    const labelPairs = Object.entries(labels);
    if (labelPairs.length === 0) {
      return '';
    }

    const formattedPairs = labelPairs.map(([key, value]) => `${key}="${this.escapeLabel(value)}"`);
    return `{${formattedPairs.join(',')}}`;
  }

  private escapeLabel(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
  }
}

export class CsvMetricExporter implements MetricExporter {
  private readonly includeHeaders: boolean;

  constructor(includeHeaders = true) {
    this.includeHeaders = includeHeaders;
  }

  export(metrics: ReadonlyArray<Metric | HistogramMetric | TimerMetric>): string {
    const lines: string[] = [];

    if (this.includeHeaders) {
      lines.push('name,type,timestamp,value,labels,description');
    }

    for (const metric of metrics) {
      lines.push(this.formatMetricForCsv(metric));
    }

    return lines.join('\n');
  }

  getFormat(): string {
    return 'csv';
  }

  private formatMetricForCsv(metric: Metric | HistogramMetric | TimerMetric): string {
    const fields: string[] = [
      this.escapeCsv(metric.name),
      this.escapeCsv(metric.type),
      metric.timestamp.toString(),
      this.getMetricValue(metric),
      this.escapeCsv(JSON.stringify(metric.labels)),
      this.escapeCsv(metric.description || ''),
    ];

    return fields.join(',');
  }

  private getMetricValue(metric: Metric | HistogramMetric | TimerMetric): string {
    switch (metric.type) {
      case 'histogram':
        const histogramMetric = metric as HistogramMetric;
        return this.escapeCsv(
          JSON.stringify({
            buckets: histogramMetric.buckets,
            sum: histogramMetric.sum,
            count: histogramMetric.count,
          })
        );
      case 'timer':
        const timerMetric = metric as TimerMetric;
        return this.escapeCsv(
          JSON.stringify({
            duration: timerMetric.duration,
            unit: timerMetric.unit,
          })
        );
      default:
        const basicMetric = metric as Metric;
        return this.escapeCsv(basicMetric.value.toString());
    }
  }

  private escapeCsv(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}

export class TextMetricExporter implements MetricExporter {
  export(metrics: ReadonlyArray<Metric | HistogramMetric | TimerMetric>): string {
    const lines: string[] = [];
    lines.push('='.repeat(80));
    lines.push(`Resilience Metrics Report - ${new Date().toISOString()}`);
    lines.push('='.repeat(80));
    lines.push('');

    const metricGroups = this.groupMetricsByPattern(metrics);

    for (const [pattern, patternMetrics] of metricGroups) {
      lines.push(`📊 ${pattern.toUpperCase()} METRICS`);
      lines.push('-'.repeat(40));

      for (const metric of patternMetrics) {
        lines.push(this.formatMetricForText(metric));
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  getFormat(): string {
    return 'text';
  }

  private groupMetricsByPattern(
    metrics: ReadonlyArray<Metric | HistogramMetric | TimerMetric>
  ): Map<string, (Metric | HistogramMetric | TimerMetric)[]> {
    const groups = new Map<string, (Metric | HistogramMetric | TimerMetric)[]>();

    for (const metric of metrics) {
      const pattern = metric.labels.pattern || 'unknown';
      const group = groups.get(pattern) || [];
      group.push(metric);
      groups.set(pattern, group);
    }

    return groups;
  }

  private formatMetricForText(metric: Metric | HistogramMetric | TimerMetric): string {
    const instanceLabel = metric.labels.instance ? `[${metric.labels.instance}] ` : '';

    switch (metric.type) {
      case 'histogram':
        const histogramMetric = metric as HistogramMetric;
        return `  ${instanceLabel}${metric.name}: count=${histogramMetric.count}, sum=${histogramMetric.sum}, buckets=${histogramMetric.buckets.length}`;
      case 'timer':
        const timerMetric = metric as TimerMetric;
        return `  ${instanceLabel}${metric.name}: ${timerMetric.duration}${timerMetric.unit}`;
      case 'counter':
        const counterMetric = metric as Metric;
        return `  ${instanceLabel}${metric.name}: ${counterMetric.value} (total)`;
      case 'gauge':
        const gaugeMetric = metric as Metric;
        return `  ${instanceLabel}${metric.name}: ${gaugeMetric.value}`;
      default:
        const defaultMetric = metric as Metric;
        return `  ${instanceLabel}${defaultMetric.name}: ${defaultMetric.value}`;
    }
  }
}

export class CompositeMetricExporter implements MetricExporter {
  private readonly exporters: Map<string, MetricExporter> = new Map();

  constructor(exporters: MetricExporter[] = []) {
    for (const exporter of exporters) {
      this.addExporter(exporter);
    }
  }

  addExporter(exporter: MetricExporter): void {
    this.exporters.set(exporter.getFormat(), exporter);
  }

  removeExporter(format: string): void {
    this.exporters.delete(format);
  }

  export(metrics: ReadonlyArray<Metric | HistogramMetric | TimerMetric>): string {
    const results: Record<string, string> = {};

    for (const [format, exporter] of this.exporters) {
      try {
        const result = exporter.export(metrics);
        results[format] = typeof result === 'string' ? result : JSON.stringify(result);
      } catch (error) {
        results[format] =
          `Error exporting to ${format}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    }

    return JSON.stringify(results, null, 2);
  }

  async exportAsync(
    metrics: ReadonlyArray<Metric | HistogramMetric | TimerMetric>
  ): Promise<Record<string, string>> {
    const results: Record<string, string> = {};
    const promises: Promise<void>[] = [];

    for (const [format, exporter] of this.exporters) {
      promises.push(
        (async () => {
          try {
            const result = await exporter.export(metrics);
            results[format] = result;
          } catch (error) {
            results[format] =
              `Error exporting to ${format}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          }
        })()
      );
    }

    await Promise.allSettled(promises);
    return results;
  }

  getFormat(): string {
    return 'composite';
  }

  getAvailableFormats(): string[] {
    return Array.from(this.exporters.keys());
  }
}

export class MetricExporterFactory {
  /**
   * Create an exporter by format name
   */
  static create(format: string, options: Record<string, unknown> = {}): MetricExporter {
    switch (format.toLowerCase()) {
      case 'json':
        return new JsonMetricExporter(options.pretty as boolean);
      case 'prometheus':
        return new PrometheusMetricExporter();
      case 'csv':
        return new CsvMetricExporter(options.includeHeaders as boolean);
      case 'text':
        return new TextMetricExporter();
      default:
        throw new Error(`Unsupported metric export format: ${format}`);
    }
  }

  /**
   * Get all available export formats
   */
  static getAvailableFormats(): string[] {
    return ['json', 'prometheus', 'csv', 'text'];
  }

  /**
   * Create a composite exporter with multiple formats
   */
  static createComposite(
    formats: string[],
    options: Record<string, Record<string, unknown>> = {}
  ): CompositeMetricExporter {
    const exporters = formats.map(format =>
      MetricExporterFactory.create(format, options[format] || {})
    );
    return new CompositeMetricExporter(exporters);
  }
}
