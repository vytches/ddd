/**
 * JSDoc-specific adapter for example injection
 */

import type {
  LayerType,
  ComplexityLevel,
} from '../types';
import type { IJSDocAdapter } from '../interfaces';
import { ExampleEngine } from '../engine';

export class JSDocAdapter implements IJSDocAdapter {
  private engine: ExampleEngine;

  constructor() {
    this.engine = new ExampleEngine();
  }

  /**
   * Get best example for method at specific layer
   */
  async getExampleForMethod(
    methodName: string,
    packageName: string,
    layer: LayerType = 'domain',
    complexity: ComplexityLevel = 'basic'
  ): Promise<string> {
    try {
      console.log(`[jsdoc-adapter] Looking for example: ${methodName} in ${packageName} (${layer}:${complexity})`);
      const example = await this.engine.getBestExampleForMethod(
        methodName,
        packageName,
        layer,
        complexity
      );

      if (!example) {
        console.log(`[jsdoc-adapter] No example found for ${methodName}, using fallback`);
        return this.createFallbackExample(methodName, layer);
      }

      console.log(`[jsdoc-adapter] Found example for ${methodName}: ${example.content.substring(0, 100)}...`);
      return this.engine.formatOutput(example.content, 'jsdoc');
    } catch (error) {
      console.warn(`Failed to get example for ${methodName}:`, error);
      return this.createFallbackExample(methodName, layer);
    }
  }

  /**
   * Inject examples into JSDoc comments
   */
  async injectIntoJSDoc(code: string, methodName: string, packageName: string): Promise<string> {
    try {
      // Get the best example for this method
      const exampleText = await this.getExampleForMethod(methodName, packageName);
      
      // Replace @example-inject with actual example
      // Match the entire line including JSDoc comment markers
      const injectionPattern = /(\s*\*\s*)@example-inject(?:\s+[^\n]*)?/g;
      
      return code.replace(injectionPattern, exampleText);
    } catch (error) {
      console.warn(`Failed to inject JSDoc example for ${methodName}:`, error);
      // Return original code if injection fails
      return code;
    }
  }

  /**
   * Process @example-inject directives in file
   */
  async processInjectionDirectives(code: string, filePath: string): Promise<string> {
    try {
      // Extract package name from file path
      const packageName = this.extractPackageFromPath(filePath);
      console.log(`[jsdoc-examples] Package name extracted: ${packageName} from path: ${filePath}`);
      
      // Find all @example-inject directives
      const directives = this.findInjectionDirectives(code);
      
      let processedCode = code;
      
      // Process each directive
      for (const directive of directives) {
        console.log(`[jsdoc-adapter] Processing directive at position ${directive.position}: ${directive.directive}`);
        const methodName = this.extractMethodNameFromContext(code, directive.position);
        console.log(`[jsdoc-adapter] Extracted method name: ${methodName}`);
        
        if (methodName) {
          const injectedCode = await this.injectIntoJSDoc(
            processedCode,
            methodName,
            packageName
          );
          console.log(`[jsdoc-adapter] Injected code length: ${injectedCode.length} (was ${processedCode.length})`);
          
          // Debug: show a portion of the injected code around the change
          const changedAreaStart = Math.max(0, directive.position - 100);
          const changedAreaEnd = Math.min(injectedCode.length, directive.position + 500);
          console.log(`[jsdoc-adapter] Code around injection point:\n${injectedCode.substring(changedAreaStart, changedAreaEnd)}`);
          
          processedCode = injectedCode;
        }
      }
      
      return processedCode;
    } catch (error) {
      console.warn(`Failed to process injection directives in ${filePath}:`, error);
      return code;
    }
  }

  /**
   * Create fallback example when no example found
   */
  private createFallbackExample(methodName: string, layer: LayerType): string {
    const fallbackContent = this.generateFallbackContent(methodName, layer);
    return this.engine.formatOutput(fallbackContent, 'jsdoc');
  }

  /**
   * Generate fallback content based on method name and layer
   */
  private generateFallbackContent(methodName: string, layer: LayerType): string {
    switch (layer) {
      case 'domain':
        return `// Example for ${methodName} (domain layer)\nconst result = entity.${methodName}(data);\nreturn result;`;
      case 'service':
        return `// Example for ${methodName} (service layer)\nconst command = new ${this.capitalize(methodName)}Command(data);\nconst result = await this.service.${methodName}(command);\nreturn result;`;
      case 'integration':
        return `// Example for ${methodName} (integration layer)\nconst entity = await this.repository.${methodName}(data);\nawait this.eventBus.publish(new ${this.capitalize(methodName)}Event(entity));\nreturn entity;`;
      default:
        return `// Example for ${methodName}\nconst result = await ${methodName}(data);\nreturn result;`;
    }
  }

  /**
   * Extract package name from file path
   */
  private extractPackageFromPath(filePath: string): string {
    // Pattern: packages/[package-name]/src/...
    const packageMatch = filePath.match(/packages\/([^/]+)\/src/);
    if (packageMatch && packageMatch[1]) {
      return packageMatch[1];
    }
    
    // Fallback: try to extract from path segments
    const segments = filePath.split('/');
    const packagesIndex = segments.findIndex(segment => segment === 'packages');
    const packageSegment = packagesIndex >= 0 ? segments[packagesIndex + 1] : undefined;
    if (packageSegment) {
      return packageSegment;
    }
    
    return 'unknown';
  }

  /**
   * Find all @example-inject directives in code
   */
  private findInjectionDirectives(code: string): Array<{ position: number; directive: string }> {
    const directives: Array<{ position: number; directive: string }> = [];
    const pattern = /@example-inject(?:\s+[^\n]*)?/g;
    
    let match;
    while ((match = pattern.exec(code)) !== null) {
      directives.push({
        position: match.index,
        directive: match[0],
      });
    }
    
    return directives;
  }

  /**
   * Extract method name from surrounding context
   */
  private extractMethodNameFromContext(code: string, position: number): string | null {
    try {
      // Look for method/function declaration after the JSDoc comment
      const afterPosition = code.substring(position);
      
      // Patterns to match method declarations
      const patterns = [
        // static methodName(
        /static\s+(\w+)\s*\(/,
        // methodName(
        /(\w+)\s*\(/,
        // get methodName()
        /get\s+(\w+)\s*\(/,
        // set methodName(
        /set\s+(\w+)\s*\(/,
        // async methodName(
        /async\s+(\w+)\s*\(/,
      ];

      for (const pattern of patterns) {
        const match = afterPosition.match(pattern);
        if (match && match[1]) {
          // Validate method name (not constructor, etc.)
          const methodName = match[1];
          if (methodName !== 'constructor' && methodName !== 'class') {
            return methodName;
          }
        }
      }

      return null;
    } catch (error) {
      console.warn('Failed to extract method name from context:', error);
      return null;
    }
  }

  /**
   * Capitalize first letter
   */
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Parse directive parameters
   */
  private parseDirectiveParams(directive: string): {
    layer?: LayerType;
    complexity?: ComplexityLevel;
    examples?: number;
  } {
    const params: {
      layer?: LayerType;
      complexity?: ComplexityLevel;
      examples?: number;
    } = {};
    
    // Parse layer parameter: @example-inject layer:domain
    const layerMatch = directive.match(/layer:(\w+)/);
    if (layerMatch) {
      const layer = layerMatch[1] as LayerType;
      if (['domain', 'service', 'integration'].includes(layer)) {
        params.layer = layer;
      }
    }
    
    // Parse complexity parameter: @example-inject complexity:basic
    const complexityMatch = directive.match(/complexity:(\w+)/);
    if (complexityMatch) {
      const complexity = complexityMatch[1] as ComplexityLevel;
      if (['basic', 'intermediate', 'advanced'].includes(complexity)) {
        params.complexity = complexity;
      }
    }
    
    // Parse examples count: @example-inject examples:3
    const examplesMatch = directive.match(/examples:(\d+)/);
    if (examplesMatch && examplesMatch[1]) {
      params.examples = parseInt(examplesMatch[1], 10);
    }
    
    return params;
  }

  /**
   * Enhanced injection with parameter support
   */
  async injectWithParameters(
    code: string, 
    methodName: string, 
    packageName: string,
    params: {
      layer?: LayerType;
      complexity?: ComplexityLevel;
      examples?: number;
    } = {}
  ): Promise<string> {
    try {
      const {
        layer = 'domain',
        complexity = 'basic',
        examples = 1,
      } = params;

      if (examples === 1) {
        // Single example
        return await this.injectIntoJSDoc(code, methodName, packageName);
      } else {
        // Multiple examples
        const allExamples = await this.engine.getExamplesForMethod(methodName, packageName);
        const selectedExamples = allExamples
          .filter(ex => ex.layer === layer)
          .slice(0, examples);

        const formattedExamples = selectedExamples
          .map(ex => this.engine.formatOutput(ex.content, 'jsdoc'))
          .join('\n *\n');

        const injectionPattern = /@example-inject(?:\s+[^\n]*)?/g;
        return code.replace(injectionPattern, formattedExamples || this.createFallbackExample(methodName, layer));
      }
    } catch (error) {
      console.warn(`Failed to inject with parameters for ${methodName}:`, error);
      return code;
    }
  }
}