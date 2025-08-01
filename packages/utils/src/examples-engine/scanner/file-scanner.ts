/**
 * File system scanning and parsing for example files
 */

import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';
import type { ExampleFile, ComplexityLevel } from '../types';
import type { IFileScanner } from '../interfaces';

export class FileScanner implements IFileScanner {
  /**
   * Scan directory recursively for markdown files with timeout protection
   */
  async scanDirectory(path: string): Promise<string[]> {
    console.log(`[FileScanner.scanDirectory] Starting scan: ${path}`);
    
    try {
      // Add timeout protection to prevent hanging
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Directory scan timed out after 5 seconds for ${path}`)), 5000);
      });

      const scanPromise = this._scanDirectoryRecursive(path);
      const files = await Promise.race([scanPromise, timeoutPromise]);
      
      console.log(`[FileScanner.scanDirectory] Found ${files.length} files in: ${path}`);
      return files;
    } catch (error) {
      console.error(`[FileScanner.scanDirectory] Failed to scan directory ${path}:`, error);
      throw new Error(`Failed to scan directory ${path}: ${error}`);
    }
  }

  /**
   * Internal recursive directory scanning method
   */
  private async _scanDirectoryRecursive(path: string): Promise<string[]> {
    console.log(`[FileScanner._scanDirectoryRecursive] Scanning: ${path}`);
    
    try {
      const entries = await readdir(path, { withFileTypes: true });
      const files: string[] = [];

      for (const entry of entries) {
        try {
          const fullPath = join(path, entry.name);
          console.log(`[FileScanner._scanDirectoryRecursive] Processing: ${fullPath}`);
          
          if (entry.isDirectory()) {
            // Recursively scan subdirectories with error protection
            try {
              const subFiles = await this._scanDirectoryRecursive(fullPath);
              files.push(...subFiles);
            } catch (subdirError) {
              console.warn(`[FileScanner._scanDirectoryRecursive] Failed to scan subdirectory ${fullPath}:`, subdirError);
              // Continue with other directories instead of failing completely
              continue;
            }
          } else if (entry.isFile() && entry.name.endsWith('.md')) {
            console.log(`[FileScanner._scanDirectoryRecursive] Found MD file: ${fullPath}`);
            files.push(fullPath);
          }
        } catch (entryError) {
          console.warn(`[FileScanner._scanDirectoryRecursive] Failed to process entry ${entry.name}:`, entryError);
          continue;
        }
      }

      console.log(`[FileScanner._scanDirectoryRecursive] Completed ${path}, found ${files.length} files`);
      return files;
    } catch (error) {
      console.error(`[FileScanner._scanDirectoryRecursive] Failed to read directory ${path}:`, error);
      // Return empty array instead of throwing to prevent build failure
      return [];
    }
  }

  /**
   * Parse example file and extract metadata
   */
  async parseExampleFile(filePath: string): Promise<ExampleFile> {
    try {
      const content = await readFile(filePath, 'utf-8');
      const metadata = this.extractMetadata(content);
      
      // Extract package name from path structure
      // Expected: docs/examples/domain/[package-name]/
      const pathParts = filePath.split('/');
      const packageIndex = pathParts.findIndex(part => part === 'domain' || part === 'frameworks');
      const packageSegment = packageIndex >= 0 ? pathParts[packageIndex + 1] : undefined;
      const packageName = packageSegment || 'unknown';

      // Extract complexity from directory structure
      const complexity = this.extractComplexityFromPath(filePath);

      return {
        filePath,
        packageName,
        complexity,
        content,
        metadata,
      };
    } catch (error) {
      throw new Error(`Failed to parse example file ${filePath}: ${error}`);
    }
  }

  /**
   * Extract metadata from markdown file headers
   */
  extractMetadata(content: string): ExampleFile['metadata'] {
    const lines = content.split('\n');
    const metadata: ExampleFile['metadata'] = {
      title: '',
      description: '',
      patterns: [],
      dependencies: [],
    };

    // Look for metadata in first 20 lines
    const headerSection = lines.slice(0, 20);
    
    for (const line of headerSection) {
      const trimmed = line.trim();
      
      // Extract title from first heading
      if (trimmed.startsWith('# ') && !metadata.title) {
        metadata.title = trimmed.substring(2).trim();
        continue;
      }

      // Look for metadata markers
      if (trimmed.startsWith('**Description**:')) {
        metadata.description = trimmed.substring(16).trim();
      } else if (trimmed.startsWith('**Patterns**:')) {
        const patternsText = trimmed.substring(13).trim();
        metadata.patterns = patternsText.split(',').map(p => p.trim()).filter(Boolean);
      } else if (trimmed.startsWith('**Dependencies**:')) {
        const depsText = trimmed.substring(17).trim();
        metadata.dependencies = depsText.split(',').map(d => d.trim()).filter(Boolean);
      }
    }

    // Fallback: extract description from first paragraph
    if (!metadata.description) {
      const descriptionMatch = content.match(/## Description\s*\n\n([^\n]+)/);
      if (descriptionMatch && descriptionMatch[1]) {
        metadata.description = descriptionMatch[1].trim();
      }
    }

    return metadata;
  }

  /**
   * Extract complexity level from file path
   */
  private extractComplexityFromPath(filePath: string): ComplexityLevel {
    const pathLower = filePath.toLowerCase();
    
    if (pathLower.includes('/basic/') || pathLower.includes('basic')) {
      return 'basic';
    } else if (pathLower.includes('/advanced/') || pathLower.includes('advanced')) {
      return 'advanced';
    } else if (pathLower.includes('/intermediate/') || pathLower.includes('intermediate')) {
      return 'intermediate';
    }
    
    // Default to basic if no complexity indicator found
    return 'basic';
  }

  /**
   * Check if file exists and is readable
   */
  async isFileAccessible(filePath: string): Promise<boolean> {
    try {
      const stats = await stat(filePath);
      return stats.isFile();
    } catch {
      return false;
    }
  }

  /**
   * Get file modification time for caching
   */
  async getFileModificationTime(filePath: string): Promise<Date> {
    try {
      const stats = await stat(filePath);
      return stats.mtime;
    } catch (error) {
      throw new Error(`Failed to get modification time for ${filePath}: ${error}`);
    }
  }
}