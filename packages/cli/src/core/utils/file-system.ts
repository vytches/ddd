/**
 * @fileoverview File System - File scaffolding utilities
 * Enhanced file operations with Node.js built-ins
 */

import * as fs from 'fs';
import * as path from 'path';
import { CLIError } from '../../types';

/**
 * @llm-summary FileSystem class for file system operations
 * @llm-domain Infrastructure
 * @llm-complexity Medium
 *
 * @description
 * FileSystem class implementing infrastructure service for file system operations.
 *
 * @example
 * ```typescript
 * // Basic usage
 * const instance = new FileSystem();
 * ```
 * *
 * @since 1.0.0
 * @public
 */
export class FileSystem {
  /**
   * Check if path exists
   */
  static exists(filePath: string): boolean {
    try {
      return fs.existsSync(filePath);
    } catch {
      return false;
    }
  }

  /**
   * Check if path is a directory
   */
  static isDirectory(filePath: string): boolean {
    try {
      const stats = fs.statSync(filePath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Check if path is a file
   */
  static isFile(filePath: string): boolean {
    try {
      const stats = fs.statSync(filePath);
      return stats.isFile();
    } catch {
      return false;
    }
  }

  /**
   * Create directory recursively
   */
  static async createDirectory(dirPath: string): Promise<void> {
    try {
      await fs.promises.mkdir(dirPath, { recursive: true });
    } catch (error) {
      throw new CLIError(
        `Failed to create directory ${dirPath}: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  /**
   * Read file content
   */
  static async readFile(filePath: string): Promise<string> {
    try {
      return await fs.promises.readFile(filePath, 'utf-8');
    } catch (error) {
      throw new CLIError(
        `Failed to read file ${filePath}: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  /**
   * Write file content
   */
  static async writeFile(filePath: string, content: string): Promise<void> {
    try {
      // Ensure directory exists
      const dir = path.dirname(filePath);
      await this.createDirectory(dir);

      await fs.promises.writeFile(filePath, content, 'utf-8');
    } catch (error) {
      throw new CLIError(
        `Failed to write file ${filePath}: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  /**
   * Copy file
   */
  static async copyFile(source: string, destination: string): Promise<void> {
    try {
      // Ensure destination directory exists
      const dir = path.dirname(destination);
      await this.createDirectory(dir);

      await fs.promises.copyFile(source, destination);
    } catch (error) {
      throw new CLIError(
        `Failed to copy file from ${source} to ${destination}: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  /**
   * List directory contents
   */
  static async listDirectory(dirPath: string): Promise<string[]> {
    try {
      return await fs.promises.readdir(dirPath);
    } catch (error) {
      throw new CLIError(
        `Failed to list directory ${dirPath}: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  /**
   * Get file stats
   */
  static async getStats(filePath: string): Promise<fs.Stats> {
    try {
      return await fs.promises.stat(filePath);
    } catch (error) {
      throw new CLIError(
        `Failed to get stats for ${filePath}: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  /**
   * Find files matching pattern
   */
  static async findFiles(directory: string, pattern: RegExp): Promise<string[]> {
    const found: string[] = [];

    try {
      const items = await this.listDirectory(directory);

      for (const item of items) {
        const fullPath = path.join(directory, item);
        const stats = await this.getStats(fullPath);

        if (stats.isDirectory()) {
          // Recursive search
          const subFiles = await this.findFiles(fullPath, pattern);
          found.push(...subFiles);
        } else if (pattern.test(item)) {
          found.push(fullPath);
        }
      }

      return found;
    } catch (error) {
      throw new CLIError(
        `Failed to find files in ${directory}: ${error instanceof Error ? error.message : error}`
      );
    }
  }

  /**
   * Resolve absolute path
   */
  static resolvePath(filePath: string): string {
    return path.resolve(filePath);
  }

  /**
   * Get relative path
   */
  static relativePath(from: string, to: string): string {
    return path.relative(from, to);
  }

  /**
   * Join paths
   */
  static joinPath(...paths: string[]): string {
    return path.join(...paths);
  }

  /**
   * Get file extension
   */
  static getExtension(filePath: string): string {
    return path.extname(filePath);
  }

  /**
   * Get file name without extension
   */
  static getBaseName(filePath: string): string {
    return path.basename(filePath, path.extname(filePath));
  }

  /**
   * Get directory name
   */
  static getDirectoryName(filePath: string): string {
    return path.dirname(filePath);
  }
}
