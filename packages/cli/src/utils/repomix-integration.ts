/**
 * Repomix Integration Utilities
 *
 * Provides integration between Enhanced Metadata System and Repomix codebase analysis
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, statSync } from 'fs';
import { resolve } from 'path';

export interface RepomixAnalysis {
  content: string;
  fileCount: number;
  sizeBytes: number;
  lastGenerated: Date;
}

export interface ApiValidationResult {
  valid: boolean;
  missingApis: string[];
  deprecatedApis: string[];
  suggestions: string[];
}

export class RepomixIntegration {
  private static repomixOutputPath = 'repomix-output.md';

  /**
   * Ensures repomix output exists and is recent
   */
  static async ensureRepomixOutput(force = false): Promise<RepomixAnalysis> {
    const outputPath = resolve(process.cwd(), this.repomixOutputPath);

    // Check if repomix output exists and is recent (< 1 hour old)
    const shouldRegenerate = force || !existsSync(outputPath) || this.isOutputStale(outputPath);

    if (shouldRegenerate) {
      console.log('🔄 Generating fresh repomix analysis...');
      try {
        execSync('npx repomix', {
          stdio: 'pipe',
          cwd: process.cwd(),
        });
        console.log('✅ Repomix analysis complete');
      } catch (error) {
        throw new Error(
          `Failed to generate repomix output: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // Read and analyze the output
    const content = readFileSync(outputPath, 'utf8');
    const stats = statSync(outputPath);

    return {
      content,
      fileCount: this.countFilesInRepomix(content),
      sizeBytes: stats.size,
      lastGenerated: stats.mtime,
    };
  }

  /**
   * Validates API existence against repomix analysis
   */
  static async validateApis(packageName: string, apis: string[]): Promise<ApiValidationResult> {
    const analysis = await this.ensureRepomixOutput();
    const content = analysis.content;

    const missingApis: string[] = [];
    const deprecatedApis: string[] = [];
    const suggestions: string[] = [];

    for (const api of apis) {
      if (!this.apiExistsInRepomix(content, packageName, api)) {
        missingApis.push(api);

        // Try to find similar APIs
        const similar = this.findSimilarApis(content, packageName, api);
        if (similar.length > 0) {
          suggestions.push(`${api} -> Consider: ${similar.join(', ')}`);
        }
      }
    }

    return {
      valid: missingApis.length === 0,
      missingApis,
      deprecatedApis,
      suggestions,
    };
  }

  /**
   * Extracts current API signatures for a package from repomix
   */
  static async extractPackageApis(packageName: string): Promise<string[]> {
    const analysis = await this.ensureRepomixOutput();
    const content = analysis.content;

    const apis: string[] = [];

    // Extract class methods, functions, and exports
    const packagePattern = new RegExp(`## File: packages/${packageName}/src/.*\\.ts`, 'g');
    const matches = content.match(packagePattern);

    if (matches) {
      for (const match of matches) {
        const fileStart = content.indexOf(match);
        const nextFile = content.indexOf('## File:', fileStart + 1);
        const fileContent =
          nextFile > 0 ? content.substring(fileStart, nextFile) : content.substring(fileStart);

        // Extract method signatures
        const methodMatches = fileContent.match(
          /(?:public|private|protected)?\s*(?:static\s+)?(\w+)\s*\([^)]*\):/g
        );
        if (methodMatches) {
          apis.push(...methodMatches.map(m => m.trim()));
        }

        // Extract function exports
        const functionMatches = fileContent.match(/export\s+(?:function\s+)?(\w+)/g);
        if (functionMatches) {
          apis.push(
            ...functionMatches.map(m => m.replace('export function ', '').replace('export ', ''))
          );
        }
      }
    }

    return [...new Set(apis)]; // Remove duplicates
  }

  private static isOutputStale(outputPath: string): boolean {
    const stats = statSync(outputPath);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return stats.mtime < oneHourAgo;
  }

  private static countFilesInRepomix(content: string): number {
    const matches = content.match(/## File:/g);
    return matches ? matches.length : 0;
  }

  private static apiExistsInRepomix(content: string, packageName: string, api: string): boolean {
    // Look for API in package files
    const apiPattern = new RegExp(`packages/${packageName}/.*${api}`, 'i');
    return apiPattern.test(content);
  }

  private static findSimilarApis(content: string, packageName: string, api: string): string[] {
    // Simple similarity matching - could be enhanced
    const packagePattern = new RegExp(`packages/${packageName}/src/.*\\.ts`, 'g');
    const apiLower = api.toLowerCase();
    const similar: string[] = [];

    // Extract method names and find similar ones
    const methodMatches = content.match(/\w+\s*\([^)]*\)/g);
    if (methodMatches) {
      for (const method of methodMatches) {
        const methodName = method.split('(')[0]?.trim();
        if (
          methodName &&
          (methodName.toLowerCase().includes(apiLower) ||
            apiLower.includes(methodName.toLowerCase()))
        ) {
          similar.push(methodName);
        }
      }
    }

    return [...new Set(similar)].slice(0, 3); // Return top 3 suggestions
  }
}
