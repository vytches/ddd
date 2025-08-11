/**
 * File-level cache for Enhanced Metadata System V2
 * Eliminates repeated file reading and parsing
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { MetadataParseResult } from '../hierarchy/types';

export interface CachedFile {
  content: string;
  parsedMetadata?: MetadataParseResult;
  parsedMethods?: Map<string, MetadataParseResult>;
  lastModified: number;
  size: number;
}

export class FileCache {
  private static instance: FileCache;
  private cache = new Map<string, CachedFile>();
  private stats = {
    hits: 0,
    misses: 0,
    reads: 0,
    parses: 0,
  };

  static getInstance(): FileCache {
    if (!FileCache.instance) {
      FileCache.instance = new FileCache();
    }
    return FileCache.instance;
  }

  /**
   * Get file content with caching
   */
  async getFileContent(filePath: string): Promise<string | null> {
    try {
      const normalizedPath = path.resolve(filePath);
      const fileStats = await fs.stat(normalizedPath);

      const cached = this.cache.get(normalizedPath);

      // Check if cache is valid
      if (
        cached &&
        cached.lastModified >= fileStats.mtime.getTime() &&
        cached.size === fileStats.size
      ) {
        this.stats.hits++;
        return cached.content;
      }

      // Cache miss - read file
      this.stats.misses++;
      this.stats.reads++;
      const content = await fs.readFile(normalizedPath, 'utf-8');

      this.cache.set(normalizedPath, {
        content,
        lastModified: fileStats.mtime.getTime(),
        size: fileStats.size,
      });

      return content;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get parsed metadata with caching
   */
  async getParsedMetadata(
    filePath: string,
    parser: (content: string) => MetadataParseResult
  ): Promise<MetadataParseResult | null> {
    const content = await this.getFileContent(filePath);
    if (!content) return null;

    const normalizedPath = path.resolve(filePath);
    const cached = this.cache.get(normalizedPath);

    if (cached?.parsedMetadata) {
      return cached.parsedMetadata;
    }

    // Parse and cache
    this.stats.parses++;
    const parsed = parser(content);

    if (cached) {
      cached.parsedMetadata = parsed;
    }

    return parsed;
  }

  /**
   * Get method-specific metadata with caching
   */
  async getMethodMetadata(
    filePath: string,
    methodName: string,
    parser: (content: string, methodName: string) => MetadataParseResult | null
  ): Promise<MetadataParseResult | null> {
    const content = await this.getFileContent(filePath);
    if (!content) return null;

    const normalizedPath = path.resolve(filePath);
    const cached = this.cache.get(normalizedPath);

    if (!cached?.parsedMethods) {
      if (cached) {
        cached.parsedMethods = new Map();
      }
    }

    const methodCache = cached?.parsedMethods?.get(methodName);
    if (methodCache) {
      return methodCache;
    }

    // Parse and cache method
    this.stats.parses++;
    const parsed = parser(content, methodName);

    if (parsed && cached?.parsedMethods) {
      cached.parsedMethods.set(methodName, parsed);
    }

    return parsed;
  }

  /**
   * Pre-warm cache for entire class file
   */
  async preWarmClassFile(
    filePath: string,
    methodNames: string[],
    methodParser: (content: string, methodName: string) => MetadataParseResult | null
  ): Promise<void> {
    const content = await this.getFileContent(filePath);
    if (!content) return;

    const normalizedPath = path.resolve(filePath);
    const cached = this.cache.get(normalizedPath);

    if (!cached?.parsedMethods) {
      if (cached) {
        cached.parsedMethods = new Map();
      }
    }

    // Parse all methods at once
    for (const methodName of methodNames) {
      if (!cached?.parsedMethods?.has(methodName)) {
        const parsed = methodParser(content, methodName);
        if (parsed && cached?.parsedMethods) {
          cached.parsedMethods.set(methodName, parsed);
        }
      }
    }
  }

  /**
   * Clear cache for specific file
   */
  clearFile(filePath: string): void {
    const normalizedPath = path.resolve(filePath);
    this.cache.delete(normalizedPath);
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, reads: 0, parses: 0 };
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      ...this.stats,
      cacheSize: this.cache.size,
      hitRate: (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100,
    };
  }

  /**
   * Get memory usage
   */
  getMemoryUsage(): number {
    let totalSize = 0;
    for (const cached of this.cache.values()) {
      totalSize += cached.content.length * 2; // UTF-16 chars = 2 bytes each
      if (cached.parsedMethods) {
        totalSize += cached.parsedMethods.size * 100; // Estimate metadata size
      }
    }
    return totalSize;
  }
}
