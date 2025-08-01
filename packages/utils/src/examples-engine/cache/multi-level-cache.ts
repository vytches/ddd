/**
 * Multi-level caching system for Enhanced Metadata System V2
 */

import * as fs from 'fs';
import * as path from 'path';

interface CacheConfig {
  enabled: boolean;
  maxSize: number;
  ttl: number;
}

export class MultiLevelCache {
  private static memoryCache = new Map<string, { value: string; timestamp: number }>();
  private static config: CacheConfig = {
    enabled: true,
    maxSize: 1000,
    ttl: 60000 // 1 minute
  };

  static async get(key: string): Promise<string | null> {
    if (!this.config.enabled) return null;

    // Check memory cache first
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry) {
      if (Date.now() - memoryEntry.timestamp < this.config.ttl) {
        return memoryEntry.value;
      } else {
        this.memoryCache.delete(key);
      }
    }

    return null;
  }

  static async set(key: string, value: string): Promise<void> {
    if (!this.config.enabled) return;

    // Store in memory cache
    this.memoryCache.set(key, {
      value,
      timestamp: Date.now()
    });

    // Clean up if cache is too large
    if (this.memoryCache.size > this.config.maxSize) {
      const entries = Array.from(this.memoryCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

      // Remove oldest 10% of entries
      const toRemove = Math.floor(entries.length * 0.1);
      for (let i = 0; i < toRemove; i++) {
        this.memoryCache.delete(entries?.[i]?.[0] as string);
      }
    }
  }

  static clear(): void {
    this.memoryCache.clear();
  }

  static async initialize(): Promise<void> {
    // Initialize cache if needed
    this.clear();
    console.log('[MultiLevelCache] Cache initialized');
  }
}

export class PerformanceMonitor {
  private static metrics = new Map<string, number[]>();

  static recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(value);
  }

  static getMetrics(): Record<string, { avg: number; count: number }> {
    const result: Record<string, { avg: number; count: number }> = {};

    for (const [name, values] of this.metrics.entries()) {
      const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
      result[name] = { avg, count: values.length };
    }

    return result;
  }

  static async benchmark<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      this.recordMetric(name, duration);
      console.log(`[PerformanceMonitor] ${name}: ${duration}ms`);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.recordMetric(`${name}_error`, duration);
      console.log(`[PerformanceMonitor] ${name} failed after ${duration}ms`);
      throw error;
    }
  }
}
