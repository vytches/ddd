/**
 * DX-005: RepomixIntegration for Live Codebase Validation
 *
 * Validates discovery recommendations against actual VytchesDDD implementation
 * to ensure recommended methods, imports, and patterns actually exist.
 */

import { promises as fs } from 'fs';
import { join, resolve } from 'path';
import { Colors } from '../core/utils/colors';

export interface ValidationResult {
  isValid: boolean;
  packageName: string;
  issues: ValidationIssue[];
  actualMethods: string[];
  recommendedMethods: string[];
  confidence: number;
  suggestions: string[];
}

export interface ValidationIssue {
  type: 'method-not-found' | 'import-invalid' | 'deprecated-api' | 'type-mismatch';
  severity: 'error' | 'warning' | 'info';
  message: string;
  recommended?: string | undefined;
  actualSignature?: string | undefined;
}

export interface PackageAnalysisResult {
  packageName: string;
  exports: string[];
  classes: ClassAnalysis[];
  interfaces: InterfaceAnalysis[];
  types: TypeAnalysis[];
  methods: MethodAnalysis[];
  lastAnalyzed: Date;
}

export interface ClassAnalysis {
  name: string;
  methods: string[];
  properties: string[];
  constructorParams: string[];
  baseClass?: string;
  isAbstract: boolean;
}

export interface InterfaceAnalysis {
  name: string;
  methods: string[];
  properties: string[];
  extends?: string[];
}

export interface TypeAnalysis {
  name: string;
  type: 'type-alias' | 'enum' | 'union' | 'intersection';
  definition?: string;
}

export interface MethodAnalysis {
  name: string;
  className?: string;
  parameters: ParameterInfo[];
  returnType: string;
  isStatic: boolean;
  isAsync: boolean;
  accessibility: 'public' | 'private' | 'protected';
}

export interface ParameterInfo {
  name: string;
  type: string;
  optional: boolean;
  defaultValue?: string;
}

export interface ValidationOptions {
  includeDeprecated?: boolean;
  strictMode?: boolean;
  cacheTimeout?: number;
  includeDTypes?: boolean;
  maxSuggestions?: number;
}

export class RepomixIntegration {
  private packageCache: Map<string, PackageAnalysisResult> = new Map();
  private rootPath: string;
  private packagesPath: string;
  private cacheTimeout = 60000; // 1 minute cache

  constructor(rootPath?: string) {
    this.rootPath = rootPath || resolve(process.cwd());
    this.packagesPath = join(this.rootPath, 'packages');
  }

  /**
   * Validates discovery recommendations against actual implementation
   */
  async validateRecommendations(
    packageName: string,
    recommendations: string[],
    options: ValidationOptions = {}
  ): Promise<ValidationResult> {
    try {
      console.log(Colors.blue(`🔍 Validating recommendations for @vytches/ddd-${packageName}`));

      const analysis = await this.analyzePackage(packageName, options);
      const issues: ValidationIssue[] = [];
      const suggestions: string[] = [];

      // Extract actual methods and exports
      const actualMethods = this.extractAllMethods(analysis);

      // Validate each recommendation
      let validCount = 0;
      for (const recommendation of recommendations) {
        const validationResult = await this.validateSingleRecommendation(
          recommendation,
          analysis,
          options
        );

        if (validationResult.isValid) {
          validCount++;
        } else {
          issues.push(...validationResult.issues);
          if (validationResult.suggestion) {
            suggestions.push(validationResult.suggestion);
          }
        }
      }

      const confidence = recommendations.length > 0 ? validCount / recommendations.length : 0;

      return {
        isValid: issues.filter(i => i.severity === 'error').length === 0,
        packageName,
        issues,
        actualMethods,
        recommendedMethods: recommendations,
        confidence,
        suggestions: [...new Set(suggestions)],
      };
    } catch (error) {
      console.error(Colors.red(`❌ Validation failed for ${packageName}:`), error);
      return {
        isValid: false,
        packageName,
        issues: [
          {
            type: 'import-invalid',
            severity: 'error',
            message: `Failed to analyze package: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        actualMethods: [],
        recommendedMethods: recommendations,
        confidence: 0,
        suggestions: [],
      };
    }
  }

  /**
   * Analyzes a package and extracts all available APIs
   */
  async analyzePackage(
    packageName: string,
    options: ValidationOptions = {}
  ): Promise<PackageAnalysisResult> {
    const cacheKey = `${packageName}-${JSON.stringify(options)}`;

    // Check cache first
    if (this.packageCache.has(cacheKey)) {
      const cached = this.packageCache.get(cacheKey);
      if (cached) {
        const cacheAge = Date.now() - cached.lastAnalyzed.getTime();

        if (cacheAge < (options.cacheTimeout || this.cacheTimeout)) {
          console.log(Colors.dim(`📦 Using cached analysis for ${packageName}`));
          return cached;
        }
      }
    }

    console.log(Colors.blue(`📦 Analyzing package: @vytches/ddd-${packageName}`));

    const packagePath = join(this.packagesPath, packageName);
    const srcPath = join(packagePath, 'src');
    const distPath = join(packagePath, 'dist');

    // Check if package exists
    if (!(await this.pathExists(packagePath))) {
      throw new Error(`Package ${packageName} not found at ${packagePath}`);
    }

    const analysis: PackageAnalysisResult = {
      packageName,
      exports: [],
      classes: [],
      interfaces: [],
      types: [],
      methods: [],
      lastAnalyzed: new Date(),
    };

    // Analyze package.json exports
    analysis.exports = await this.analyzePackageExports(packagePath);

    // Analyze TypeScript source files
    if (await this.pathExists(srcPath)) {
      await this.analyzeSourceFiles(srcPath, analysis);
    }

    // Analyze generated .d.ts files if available
    if (options.includeDTypes && (await this.pathExists(distPath))) {
      await this.analyzeDeclarationFiles(distPath, analysis);
    }

    // Cache the result
    this.packageCache.set(cacheKey, analysis);

    console.log(
      Colors.green(
        `✅ Package analysis complete: ${analysis.classes.length} classes, ` +
          `${analysis.interfaces.length} interfaces, ${analysis.methods.length} methods`
      )
    );

    return analysis;
  }

  /**
   * Validates a single recommendation against package analysis
   */
  private async validateSingleRecommendation(
    recommendation: string,
    analysis: PackageAnalysisResult,
    _options: ValidationOptions
  ): Promise<{ isValid: boolean; issues: ValidationIssue[]; suggestion?: string | undefined }> {
    const issues: ValidationIssue[] = [];

    // Check if it's a method call pattern (Class.method or instance.method)
    if (recommendation.includes('.')) {
      return this.validateMethodCall(recommendation, analysis, _options);
    }

    // Check if it's an import/class name
    if (this.isClassName(recommendation)) {
      return this.validateClassName(recommendation, analysis, _options);
    }

    // Check if it's a method name
    const methodValidation = this.validateMethodName(recommendation, analysis, _options);
    if (methodValidation.isValid || methodValidation.issues.length > 0) {
      return methodValidation;
    }

    // If nothing matches, suggest similar items
    const suggestedItem = this.findSimilarItem(recommendation, analysis);

    issues.push({
      type: 'method-not-found',
      severity: 'warning',
      message: `Recommendation '${recommendation}' not found in package analysis`,
      recommended: suggestedItem,
    });

    return { isValid: false, issues, suggestion: suggestedItem };
  }

  /**
   * Validates method call patterns like "AggregateRoot.create" or "instance.commit"
   */
  private validateMethodCall(
    methodCall: string,
    analysis: PackageAnalysisResult,
    _options: ValidationOptions
  ): Promise<{ isValid: boolean; issues: ValidationIssue[]; suggestion?: string | undefined }> {
    const parts = methodCall.split('.');
    const className = parts[0] || '';
    const methodName = parts[1] || '';
    const issues: ValidationIssue[] = [];
    let suggestion: string | undefined;

    // Find the class
    const classInfo = analysis.classes.find(c => c.name === className);

    if (!classInfo) {
      // Try to find similar class name
      const similarClass = this.findSimilarClassName(className, analysis);

      issues.push({
        type: 'method-not-found',
        severity: 'error',
        message: `Class '${className}' not found in package`,
        recommended: similarClass ? `${similarClass}.${methodName}` : undefined,
      });

      suggestion = similarClass ? `${similarClass}.${methodName}` : undefined;
      return Promise.resolve({ isValid: false, issues, suggestion });
    }

    // Check if method exists on the class
    const hasMethod = classInfo.methods.includes(methodName);

    if (!hasMethod) {
      // Find similar method name
      const similarMethod = this.findSimilarMethod(methodName, classInfo.methods);

      issues.push({
        type: 'method-not-found',
        severity: 'error',
        message: `Method '${methodName}' not found on class '${className}'`,
        recommended: similarMethod ? `${className}.${similarMethod}` : undefined,
      });

      suggestion = similarMethod ? `${className}.${similarMethod}` : undefined;
      return Promise.resolve({ isValid: false, issues, suggestion });
    }

    // Method exists - find full signature if available
    const methodInfo = analysis.methods.find(
      m => m.className === className && m.name === methodName
    );

    if (methodInfo && methodInfo.accessibility === 'private') {
      issues.push({
        type: 'method-not-found',
        severity: 'warning',
        message: `Method '${methodName}' on '${className}' is private`,
      });
    }

    return Promise.resolve({ isValid: true, issues, suggestion });
  }

  /**
   * Validates class name recommendations
   */
  private validateClassName(
    className: string,
    analysis: PackageAnalysisResult,
    _options: ValidationOptions
  ): Promise<{ isValid: boolean; issues: ValidationIssue[]; suggestion?: string | undefined }> {
    const issues: ValidationIssue[] = [];
    const suggestion: string | undefined = this.findSimilarClassName(className, analysis);

    // Check if class exists
    const classExists = analysis.classes.some(c => c.name === className);
    const interfaceExists = analysis.interfaces.some(i => i.name === className);
    const typeExists = analysis.types.some(t => t.name === className);

    if (classExists || interfaceExists || typeExists) {
      return Promise.resolve({ isValid: true, issues, suggestion });
    }

    // Check exports
    const exportExists = analysis.exports.includes(className);
    if (exportExists) {
      return Promise.resolve({ isValid: true, issues, suggestion });
    }

    issues.push({
      type: 'import-invalid',
      severity: 'error',
      message: `Class/Type '${className}' not found in package`,
      recommended: suggestion,
    });

    return Promise.resolve({ isValid: false, issues, suggestion });
  }

  /**
   * Validates method name recommendations
   */
  private validateMethodName(
    methodName: string,
    analysis: PackageAnalysisResult,
    _options: ValidationOptions
  ): { isValid: boolean; issues: ValidationIssue[]; suggestion?: string | undefined } {
    const issues: ValidationIssue[] = [];
    const suggestion: string | undefined = this.findSimilarMethod(
      methodName,
      analysis.methods.map(m => m.name)
    );

    // Check if method exists in any class
    const methodExists = analysis.methods.some(m => m.name === methodName);

    if (methodExists) {
      return { isValid: true, issues, suggestion };
    }

    if (suggestion) {
      issues.push({
        type: 'method-not-found',
        severity: 'warning',
        message: `Method '${methodName}' not found, did you mean '${suggestion}'?`,
        recommended: suggestion,
      });
    }

    return { isValid: false, issues, suggestion };
  }

  /**
   * Helper methods for file operations and analysis
   */

  private async pathExists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }

  private async analyzePackageExports(packagePath: string): Promise<string[]> {
    try {
      const packageJsonPath = join(packagePath, 'package.json');
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);

      const exports: string[] = [];

      // Extract from main/types fields
      if (packageJson.main) {
        exports.push('default');
      }

      // Extract from exports field
      if (packageJson.exports) {
        if (typeof packageJson.exports === 'string') {
          exports.push('default');
        } else if (typeof packageJson.exports === 'object') {
          Object.keys(packageJson.exports).forEach(key => {
            if (key !== '.') {
              exports.push(key.replace('./', ''));
            }
          });
        }
      }

      return exports;
    } catch (error) {
      console.warn(Colors.yellow(`⚠️  Could not analyze package.json exports: ${error}`));
      return [];
    }
  }

  private async analyzeSourceFiles(
    srcPath: string,
    analysis: PackageAnalysisResult
  ): Promise<void> {
    try {
      const files = await this.findTypeScriptFiles(srcPath);

      for (const filePath of files) {
        await this.analyzeTypeScriptFile(filePath, analysis);
      }
    } catch (error) {
      console.warn(Colors.yellow(`⚠️  Could not analyze source files: ${error}`));
    }
  }

  private async analyzeDeclarationFiles(
    distPath: string,
    analysis: PackageAnalysisResult
  ): Promise<void> {
    try {
      const files = await this.findDeclarationFiles(distPath);

      for (const filePath of files) {
        await this.analyzeDeclarationFile(filePath, analysis);
      }
    } catch (error) {
      console.warn(Colors.yellow(`⚠️  Could not analyze declaration files: ${error}`));
    }
  }

  private async analyzeTypeScriptFile(
    filePath: string,
    analysis: PackageAnalysisResult
  ): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');

      // Extract classes
      const classMatches = content.matchAll(/export\s+(?:abstract\s+)?class\s+(\w+)/g);
      for (const match of classMatches) {
        const className = match[1];
        if (className) {
          const classInfo = await this.extractClassInfo(className, content);
          analysis.classes.push(classInfo);

          // Add methods to global methods list
          classInfo.methods.forEach(methodName => {
            const methodInfo = this.extractMethodInfo(methodName, className, content);
            if (methodInfo) {
              analysis.methods.push(methodInfo);
            }
          });
        }
      }

      // Extract interfaces
      const interfaceMatches = content.matchAll(/export\s+interface\s+(\w+)/g);
      for (const match of interfaceMatches) {
        const interfaceName = match[1];
        if (interfaceName) {
          const interfaceInfo = await this.extractInterfaceInfo(interfaceName, content);
          analysis.interfaces.push(interfaceInfo);
        }
      }

      // Extract types
      const typeMatches = content.matchAll(/export\s+(?:type|enum)\s+(\w+)/g);
      for (const match of typeMatches) {
        const typeName = match[1];
        if (typeName) {
          const typeInfo = await this.extractTypeInfo(typeName, content);
          analysis.types.push(typeInfo);
        }
      }
    } catch (error) {
      console.warn(Colors.yellow(`⚠️  Could not analyze file ${filePath}: ${error}`));
    }
  }

  private async analyzeDeclarationFile(
    filePath: string,
    analysis: PackageAnalysisResult
  ): Promise<void> {
    // Similar to analyzeTypeScriptFile but focused on .d.ts structure
    await this.analyzeTypeScriptFile(filePath, analysis);
  }

  private async findTypeScriptFiles(dirPath: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);

      if (entry.isDirectory()) {
        const subFiles = await this.findTypeScriptFiles(fullPath);
        files.push(...subFiles);
      } else if (
        entry.name.endsWith('.ts') &&
        !entry.name.endsWith('.test.ts') &&
        !entry.name.endsWith('.spec.ts')
      ) {
        files.push(fullPath);
      }
    }

    return files;
  }

  private async findDeclarationFiles(dirPath: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);

      if (entry.isDirectory()) {
        const subFiles = await this.findDeclarationFiles(fullPath);
        files.push(...subFiles);
      } else if (entry.name.endsWith('.d.ts')) {
        files.push(fullPath);
      }
    }

    return files;
  }

  private async extractClassInfo(className: string, content: string): Promise<ClassAnalysis> {
    const classInfo: ClassAnalysis = {
      name: className,
      methods: [],
      properties: [],
      constructorParams: [],
      isAbstract: content.includes(`abstract class ${className}`),
    };

    // Extract methods (simplified regex-based extraction)
    const methodMatches = content.matchAll(
      new RegExp(
        `class\\s+${className}[\\s\\S]*?(?:public|private|protected)?\\s+(\\w+)\\s*\\([^)]*\\)`,
        'g'
      )
    );
    for (const match of methodMatches) {
      if (match[1] && match[1] !== className) {
        // Exclude constructor
        classInfo.methods.push(match[1]);
      }
    }

    // Extract properties
    const propertyMatches = content.matchAll(
      new RegExp(
        `class\\s+${className}[\\s\\S]*?(?:public|private|protected)?\\s+(\\w+):\\s*\\w+`,
        'g'
      )
    );
    for (const match of propertyMatches) {
      if (match[1]) {
        classInfo.properties.push(match[1]);
      }
    }

    return classInfo;
  }

  private async extractInterfaceInfo(
    interfaceName: string,
    content: string
  ): Promise<InterfaceAnalysis> {
    const interfaceInfo: InterfaceAnalysis = {
      name: interfaceName,
      methods: [],
      properties: [],
    };

    // Extract interface members (simplified)
    const memberMatches = content.matchAll(
      new RegExp(`interface\\s+${interfaceName}[\\s\\S]*?(\\w+)\\s*[(:][^}]*`, 'g')
    );
    for (const match of memberMatches) {
      if (match[1] && match[1] !== interfaceName) {
        interfaceInfo.methods.push(match[1]);
      }
    }

    return interfaceInfo;
  }

  private async extractTypeInfo(typeName: string, content: string): Promise<TypeAnalysis> {
    const typeInfo: TypeAnalysis = {
      name: typeName,
      type: content.includes(`enum ${typeName}`) ? 'enum' : 'type-alias',
    };

    return typeInfo;
  }

  private extractMethodInfo(
    methodName: string,
    className: string,
    content: string
  ): MethodAnalysis | null {
    // Simplified method signature extraction
    const methodRegex = new RegExp(
      `(public|private|protected)?\\s*(async\\s+)?(static\\s+)?${methodName}\\s*\\(([^)]*)\\)\\s*:\\s*([^{;]+)`,
      'g'
    );
    const match = methodRegex.exec(content);

    if (!match) return null;

    return {
      name: methodName,
      className,
      parameters: [], // Could be enhanced to parse parameters
      returnType: match[5]?.trim() || 'unknown',
      isStatic: match[3] !== undefined,
      isAsync: match[2] !== undefined,
      accessibility: (match[1] as 'public' | 'private' | 'protected') || 'public',
    };
  }

  private extractAllMethods(analysis: PackageAnalysisResult): string[] {
    const methods = new Set<string>();

    // Add all class methods
    analysis.classes.forEach(cls => {
      cls.methods.forEach(method => methods.add(`${cls.name}.${method}`));
    });

    // Add standalone methods
    analysis.methods.forEach(method => {
      if (!method.className) {
        methods.add(method.name);
      }
    });

    return Array.from(methods);
  }

  private isClassName(name: string): boolean {
    // Simple heuristic: starts with uppercase letter
    return /^[A-Z]/.test(name);
  }

  private findSimilarItem(query: string, analysis: PackageAnalysisResult): string | undefined {
    const allItems = [
      ...analysis.classes.map(c => c.name),
      ...analysis.interfaces.map(i => i.name),
      ...analysis.types.map(t => t.name),
      ...analysis.methods.map(m => m.name),
      ...analysis.exports,
    ];

    return this.findSimilarString(query, allItems);
  }

  private findSimilarClassName(
    className: string,
    analysis: PackageAnalysisResult
  ): string | undefined {
    const classNames = [
      ...analysis.classes.map(c => c.name),
      ...analysis.interfaces.map(i => i.name),
      ...analysis.types.map(t => t.name),
    ];

    return this.findSimilarString(className, classNames);
  }

  private findSimilarMethod(methodName: string, methods: string[]): string | undefined {
    return this.findSimilarString(methodName, methods);
  }

  private findSimilarString(query: string, candidates: string[]): string | undefined {
    if (candidates.length === 0) return undefined;

    const queryLower = query.toLowerCase();
    let bestMatch = '';
    let bestScore = 0;

    for (const candidate of candidates) {
      const candidateLower = candidate.toLowerCase();

      // Exact match
      if (candidateLower === queryLower) {
        return candidate;
      }

      // Contains
      if (candidateLower.includes(queryLower) || queryLower.includes(candidateLower)) {
        const score =
          Math.min(queryLower.length, candidateLower.length) /
          Math.max(queryLower.length, candidateLower.length);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = candidate;
        }
      }

      // Levenshtein distance
      const distance = this.levenshteinDistance(queryLower, candidateLower);
      const maxLength = Math.max(queryLower.length, candidateLower.length);
      const similarity = 1 - distance / maxLength;

      if (similarity > 0.6 && similarity > bestScore) {
        bestScore = similarity;
        bestMatch = candidate;
      }
    }

    return bestScore > 0.3 ? bestMatch : undefined;
  }

  private levenshteinDistance(a: string, b: string): number {
    const dp: number[][] = Array(a.length + 1)
      .fill(null)
      .map(() => Array(b.length + 1).fill(0));

    for (let i = 0; i <= a.length; i++) {
      const row = dp[i];
      if (row) row[0] = i;
    }
    for (let j = 0; j <= b.length; j++) {
      const firstRow = dp[0];
      if (firstRow) firstRow[j] = j;
    }

    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const currentRow = dp[i];
        const prevRow = dp[i - 1];
        if (currentRow && prevRow) {
          if (a[i - 1] === b[j - 1]) {
            currentRow[j] = prevRow[j - 1] || 0;
          } else {
            const left = currentRow[j - 1] || 0;
            const up = prevRow[j] || 0;
            const diag = prevRow[j - 1] || 0;
            currentRow[j] = Math.min(up, left, diag) + 1;
          }
        }
      }
    }

    const lastRow = dp[a.length];
    return lastRow ? lastRow[b.length] || 0 : 0;
  }

  /**
   * Clears the analysis cache
   */
  clearCache(): void {
    this.packageCache.clear();
    console.log(Colors.green('🧹 RepomixIntegration cache cleared'));
  }

  /**
   * Gets cache statistics
   */
  getCacheStats(): { size: number; packages: string[] } {
    return {
      size: this.packageCache.size,
      packages: Array.from(this.packageCache.keys()),
    };
  }
}
