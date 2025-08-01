/**
 * Post-Compilation .d.ts Processor for Enhanced Metadata System V2
 * Processes TypeScript declaration files AFTER compilation to resolve @*-inject directives
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { HierarchicalJSDocAdapter } from './hierarchical-jsdoc-adapter';

export class PostCompilationDTSProcessor {
  private adapter: HierarchicalJSDocAdapter;
  
  constructor() {
    this.adapter = new HierarchicalJSDocAdapter();
  }
  
  /**
   * Process all .d.ts files in a directory recursively
   */
  async processDirectory(distDir: string): Promise<void> {
    console.log(`[post-compilation-dts] Processing directory: ${distDir}`);
    
    await this.adapter.initialize();
    
    const dtsFiles = await this.findDTSFiles(distDir);
    console.log(`[post-compilation-dts] Found ${dtsFiles.length} .d.ts files`);
    
    for (const filePath of dtsFiles) {
      await this.processFile(filePath);
    }
  }
  
  /**
   * Process a single .d.ts file
   */
  async processFile(filePath: string): Promise<void> {
    try {
      console.log(`[post-compilation-dts] Processing file: ${filePath}`);
      
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Check if file contains @*-inject directives
      if (!/@\w+-inject/.test(content)) {
        console.log(`[post-compilation-dts] No directives found in: ${filePath}`);
        return;
      }
      
      console.log(`[post-compilation-dts] Found directives in: ${filePath}`);
      
      // Process the file with hierarchical adapter
      const processedContent = await this.adapter.processInjectionDirectives(content, filePath);
      
      // Only write if content changed
      if (processedContent !== content) {
        await fs.writeFile(filePath, processedContent, 'utf-8');
        console.log(`[post-compilation-dts] Updated file: ${filePath}`);
      } else {
        console.log(`[post-compilation-dts] No changes needed for: ${filePath}`);
      }
      
    } catch (error) {
      console.error(`[post-compilation-dts] Error processing ${filePath}:`, error);
    }
  }
  
  /**
   * Find all .d.ts files recursively
   */
  private async findDTSFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          // Recursively search subdirectories
          const subFiles = await this.findDTSFiles(fullPath);
          files.push(...subFiles);
        } else if (entry.isFile() && entry.name.endsWith('.d.ts')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(`[post-compilation-dts] Could not read directory ${dir}:`, error);
    }
    
    return files;
  }
  
  /**
   * Process specific package's dist directory
   */
  async processPackage(packageName: string, projectRoot: string = process.cwd()): Promise<void> {
    const distDir = path.join(projectRoot, 'packages', packageName, 'dist');
    
    try {
      await fs.access(distDir);
      await this.processDirectory(distDir);
    } catch (error) {
      console.warn(`[post-compilation-dts] Package ${packageName} has no dist directory or is not accessible`);
    }
  }
  
  /**
   * Process all packages in monorepo
   */
  async processAllPackages(projectRoot: string = process.cwd()): Promise<void> {
    const packagesDir = path.join(projectRoot, 'packages');
    
    try {
      const packages = await fs.readdir(packagesDir, { withFileTypes: true });
      
      for (const pkg of packages) {
        if (pkg.isDirectory()) {
          await this.processPackage(pkg.name, projectRoot);
        }
      }
    } catch (error) {
      console.error(`[post-compilation-dts] Error processing packages:`, error);
    }
  }
}

// CLI interface for standalone usage
export async function processDTSFiles(
  target: string, 
  options: { 
    allPackages?: boolean; 
    packageName?: string; 
    projectRoot?: string 
  } = {}
): Promise<void> {
  const processor = new PostCompilationDTSProcessor();
  const projectRoot = options.projectRoot || process.cwd();
  
  if (options.allPackages) {
    console.log('[post-compilation-dts] Processing all packages...');
    await processor.processAllPackages(projectRoot);
  } else if (options.packageName) {
    console.log(`[post-compilation-dts] Processing package: ${options.packageName}`);
    await processor.processPackage(options.packageName, projectRoot);
  } else {
    // Direct directory processing
    console.log(`[post-compilation-dts] Processing directory: ${target}`);
    await processor.processDirectory(target);
  }
  
  console.log('[post-compilation-dts] Processing complete!');
}