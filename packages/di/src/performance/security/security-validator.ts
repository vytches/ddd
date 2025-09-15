/**
 * VP-012: Security Validator - Enterprise-grade Security for Performance Strategies
 * Comprehensive security validation and threat detection
 */

import type {
  IPerformanceContext,
  IPerformanceStrategy,
} from '../abstractions/performance-strategy.interface';
import type { HandlerRegistry, PerformanceConfigurationOptions } from '../performance-types';

/**
 * Security threat levels
 */
export enum SecurityThreatLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Security validation result
 */
export interface SecurityValidationResult {
  isValid: boolean;
  threatLevel: SecurityThreatLevel;
  violations: SecurityViolation[];
  recommendations: string[];
  metadata: Record<string, unknown>;
}

/**
 * Security violation details
 */
export interface SecurityViolation {
  code: string;
  message: string;
  severity: SecurityThreatLevel;
  field?: string;
  value?: unknown;
  mitigation: string;
  timestamp: Date;
}

/**
 * Security validation rules configuration
 */
export interface SecurityValidationConfig {
  enableContentValidation: boolean;
  enableRegistryValidation: boolean;
  enableContextValidation: boolean;
  enableResourceLimits: boolean;
  maxHandlerLimit: number;
  maxTimeoutLimit: number;
  maxMemoryLimit: number;
  allowedPerformanceModes: string[];
  trustedContexts: string[];
  blockedPatterns: RegExp[];
  requireCorrelationTracking: boolean;
}

/**
 * Security Validator for VP-012 Performance Strategies
 * ENTERPRISE: Comprehensive security validation and threat detection
 */
export class SecurityValidator {
  private readonly config: SecurityValidationConfig;

  constructor(config: Partial<SecurityValidationConfig> = {}) {
    this.config = {
      enableContentValidation: true,
      enableRegistryValidation: true,
      enableContextValidation: true,
      enableResourceLimits: true,
      maxHandlerLimit: 10000,
      maxTimeoutLimit: 300000, // 5 minutes
      maxMemoryLimit: 1024 * 1024 * 1024, // 1GB
      allowedPerformanceModes: ['development', 'production', 'enterprise'],
      trustedContexts: ['core', 'common', 'system'],
      blockedPatterns: [
        /\.\./g, // Path traversal
        /<script/gi, // XSS
        /union.*select/gi, // SQL injection
        /javascript:/gi, // JavaScript protocol
        /data:/gi, // Data protocol
        /eval\(/gi, // Code evaluation
        /Function\(/gi, // Function constructor
        /setTimeout\(/gi, // Async execution
        /setInterval\(/gi, // Async execution
      ],
      requireCorrelationTracking: false,
      ...config,
    };
  }

  /**
   * Validate performance configuration for security threats
   * CRITICAL: Comprehensive security validation
   */
  async validateConfiguration(
    config: PerformanceConfigurationOptions
  ): Promise<SecurityValidationResult> {
    const violations: SecurityViolation[] = [];
    const recommendations: string[] = [];
    let threatLevel = SecurityThreatLevel.LOW;

    // Validate performance mode
    if (this.config.enableContentValidation) {
      const modeViolations = this.validatePerformanceMode(config.performanceMode);
      violations.push(...modeViolations);
    }

    // Validate resource limits
    if (this.config.enableResourceLimits) {
      const resourceViolations = this.validateResourceLimits(config);
      violations.push(...resourceViolations);
    }

    // Validate contexts
    if (this.config.enableContextValidation && config.contexts) {
      const contextViolations = this.validateContexts(config.contexts);
      violations.push(...contextViolations);
    }

    // Validate pre-compiled registry
    if (this.config.enableRegistryValidation && config.preCompiledRegistry) {
      const registryViolations = await this.validatePreCompiledRegistry(config.preCompiledRegistry);
      violations.push(...registryViolations);
    }

    // Validate content for malicious patterns
    if (this.config.enableContentValidation) {
      const contentViolations = this.validateContentSafety(config);
      violations.push(...contentViolations);
    }

    // Calculate overall threat level
    threatLevel = this.calculateThreatLevel(violations);

    // Generate recommendations
    recommendations.push(...this.generateSecurityRecommendations(config, violations));

    return {
      isValid:
        violations.filter(
          v =>
            v.severity === SecurityThreatLevel.HIGH || v.severity === SecurityThreatLevel.CRITICAL
        ).length === 0,
      threatLevel,
      violations,
      recommendations,
      metadata: {
        validationTimestamp: new Date(),
        configurationHash: this.generateConfigHash(config),
        validatorVersion: '1.0.0',
      },
    };
  }

  /**
   * Validate performance context for security
   */
  async validateContext(context: IPerformanceContext): Promise<SecurityValidationResult> {
    const violations: SecurityViolation[] = [];
    const recommendations: string[] = [];

    // Validate plugin security
    const pluginViolations = await this.validateDiscoveryPlugins(context.discoveryPlugins);
    violations.push(...pluginViolations);

    // Validate context isolation
    if (context.contexts) {
      const contextViolations = this.validateContextIsolation(context.contexts);
      violations.push(...contextViolations);
    }

    // Validate correlation tracking
    if (this.config.requireCorrelationTracking) {
      const trackingViolations = this.validateCorrelationTracking(context);
      violations.push(...trackingViolations);
    }

    const threatLevel = this.calculateThreatLevel(violations);

    return {
      isValid:
        violations.filter(
          v =>
            v.severity === SecurityThreatLevel.HIGH || v.severity === SecurityThreatLevel.CRITICAL
        ).length === 0,
      threatLevel,
      violations,
      recommendations: this.generateContextRecommendations(context, violations),
      metadata: {
        validationTimestamp: new Date(),
        contextHash: this.generateContextHash(context),
        pluginCount: context.discoveryPlugins.length,
      },
    };
  }

  /**
   * Validate strategy execution security
   */
  async validateStrategyExecution(
    strategy: IPerformanceStrategy,
    context: IPerformanceContext
  ): Promise<SecurityValidationResult> {
    const violations: SecurityViolation[] = [];
    const recommendations: string[] = [];

    // Validate strategy permissions
    const permissionViolations = this.validateStrategyPermissions(strategy, context);
    violations.push(...permissionViolations);

    // Validate strategy isolation
    const isolationViolations = this.validateStrategyIsolation(strategy, context);
    violations.push(...isolationViolations);

    // Validate execution context
    const executionViolations = this.validateExecutionContext(strategy, context);
    violations.push(...executionViolations);

    const threatLevel = this.calculateThreatLevel(violations);

    return {
      isValid:
        violations.filter(
          v =>
            v.severity === SecurityThreatLevel.HIGH || v.severity === SecurityThreatLevel.CRITICAL
        ).length === 0,
      threatLevel,
      violations,
      recommendations: this.generateStrategyRecommendations(strategy, context, violations),
      metadata: {
        validationTimestamp: new Date(),
        strategyId: strategy.strategyId,
        executionMode: context.performanceMode,
      },
    };
  }

  /**
   * Validate performance mode security
   */
  private validatePerformanceMode(mode?: string): SecurityViolation[] {
    const violations: SecurityViolation[] = [];

    if (!mode || !this.config.allowedPerformanceModes.includes(mode)) {
      violations.push({
        code: 'SEC001',
        message: `Invalid or unsafe performance mode: ${mode}`,
        severity: SecurityThreatLevel.HIGH,
        field: 'performanceMode',
        value: mode,
        mitigation: `Use one of the allowed modes: ${this.config.allowedPerformanceModes.join(', ')}`,
        timestamp: new Date(),
      });
    }

    return violations;
  }

  /**
   * Validate resource limits for security
   */
  private validateResourceLimits(config: PerformanceConfigurationOptions): SecurityViolation[] {
    const violations: SecurityViolation[] = [];

    // Validate handler limit
    if (config.maxHandlers && config.maxHandlers > this.config.maxHandlerLimit) {
      violations.push({
        code: 'SEC002',
        message: `Handler limit exceeds maximum allowed: ${config.maxHandlers} > ${this.config.maxHandlerLimit}`,
        severity: SecurityThreatLevel.MEDIUM,
        field: 'maxHandlers',
        value: config.maxHandlers,
        mitigation: `Reduce maxHandlers to ${this.config.maxHandlerLimit} or lower`,
        timestamp: new Date(),
      });
    }

    // Validate timeout limit
    if (config.timeout && config.timeout > this.config.maxTimeoutLimit) {
      violations.push({
        code: 'SEC003',
        message: `Timeout exceeds maximum allowed: ${config.timeout} > ${this.config.maxTimeoutLimit}`,
        severity: SecurityThreatLevel.MEDIUM,
        field: 'timeout',
        value: config.timeout,
        mitigation: `Reduce timeout to ${this.config.maxTimeoutLimit}ms or lower`,
        timestamp: new Date(),
      });
    }

    return violations;
  }

  /**
   * Validate contexts for security
   */
  private validateContexts(contexts: string[]): SecurityViolation[] {
    const violations: SecurityViolation[] = [];

    for (const context of contexts) {
      // Check for malicious patterns
      for (const pattern of this.config.blockedPatterns) {
        if (pattern.test(context)) {
          violations.push({
            code: 'SEC004',
            message: `Context contains potentially malicious pattern: ${context}`,
            severity: SecurityThreatLevel.HIGH,
            field: 'contexts',
            value: context,
            mitigation: 'Remove suspicious characters or patterns from context names',
            timestamp: new Date(),
          });
        }
      }

      // Validate context naming
      if (context.length > 100) {
        violations.push({
          code: 'SEC005',
          message: `Context name exceeds maximum length: ${context.length} > 100`,
          severity: SecurityThreatLevel.LOW,
          field: 'contexts',
          value: context,
          mitigation: 'Shorten context names to 100 characters or less',
          timestamp: new Date(),
        });
      }
    }

    return violations;
  }

  /**
   * Validate pre-compiled registry for security
   */
  private async validatePreCompiledRegistry(
    registry: HandlerRegistry
  ): Promise<SecurityViolation[]> {
    const violations: SecurityViolation[] = [];

    try {
      // Validate registry structure
      if (!registry || typeof registry !== 'object') {
        violations.push({
          code: 'SEC006',
          message: 'Pre-compiled registry has invalid structure',
          severity: SecurityThreatLevel.CRITICAL,
          field: 'preCompiledRegistry',
          value: typeof registry,
          mitigation: 'Ensure registry follows HandlerRegistry interface',
          timestamp: new Date(),
        });
        return violations;
      }

      // Validate registry entries
      const allEntries = [
        ...(registry.commands || []),
        ...(registry.queries || []),
        ...(registry.events || []),
        ...(registry.domainServices || []),
      ];

      for (const entry of allEntries) {
        // Check for malicious content in entry data
        const entryJson = JSON.stringify(entry);
        for (const pattern of this.config.blockedPatterns) {
          if (pattern.test(entryJson)) {
            violations.push({
              code: 'SEC007',
              message: `Registry entry contains potentially malicious pattern: ${entry.id}`,
              severity: SecurityThreatLevel.HIGH,
              field: 'preCompiledRegistry.entry',
              value: entry.id,
              mitigation: 'Review and sanitize registry entry data',
              timestamp: new Date(),
            });
          }
        }
      }

      // Validate registry size
      if (allEntries.length > this.config.maxHandlerLimit) {
        violations.push({
          code: 'SEC008',
          message: `Registry contains too many entries: ${allEntries.length} > ${this.config.maxHandlerLimit}`,
          severity: SecurityThreatLevel.MEDIUM,
          field: 'preCompiledRegistry',
          value: allEntries.length,
          mitigation: `Reduce registry size to ${this.config.maxHandlerLimit} entries or lower`,
          timestamp: new Date(),
        });
      }
    } catch (error) {
      violations.push({
        code: 'SEC009',
        message: `Registry validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: SecurityThreatLevel.HIGH,
        field: 'preCompiledRegistry',
        value: error,
        mitigation: 'Ensure registry is properly structured and contains valid data',
        timestamp: new Date(),
      });
    }

    return violations;
  }

  /**
   * Validate content safety against known attack patterns
   */
  private validateContentSafety(config: PerformanceConfigurationOptions): SecurityViolation[] {
    const violations: SecurityViolation[] = [];

    // Convert config to string for pattern checking
    const configJson = JSON.stringify(config);

    for (const pattern of this.config.blockedPatterns) {
      if (pattern.test(configJson)) {
        violations.push({
          code: 'SEC010',
          message: `Configuration contains potentially malicious pattern`,
          severity: SecurityThreatLevel.HIGH,
          field: 'configuration',
          value: pattern.toString(),
          mitigation: 'Remove suspicious content from configuration',
          timestamp: new Date(),
        });
      }
    }

    return violations;
  }

  /**
   * Validate discovery plugins for security
   */
  private async validateDiscoveryPlugins(plugins: any[]): Promise<SecurityViolation[]> {
    const violations: SecurityViolation[] = [];

    for (let i = 0; i < plugins.length; i++) {
      const plugin = plugins[i];

      // Validate plugin structure
      if (!plugin || typeof plugin.discoverHandlers !== 'function') {
        violations.push({
          code: 'SEC011',
          message: `Plugin ${i} has invalid structure`,
          severity: SecurityThreatLevel.HIGH,
          field: `discoveryPlugins[${i}]`,
          value: typeof plugin,
          mitigation: 'Ensure all plugins implement IHandlerDiscoveryPlugin interface',
          timestamp: new Date(),
        });
      }

      // Validate plugin constructor name (basic sanity check)
      if (plugin && plugin.constructor && plugin.constructor.name) {
        const name = plugin.constructor.name;
        for (const pattern of this.config.blockedPatterns) {
          if (pattern.test(name)) {
            violations.push({
              code: 'SEC012',
              message: `Plugin name contains suspicious pattern: ${name}`,
              severity: SecurityThreatLevel.MEDIUM,
              field: `discoveryPlugins[${i}].constructor.name`,
              value: name,
              mitigation: 'Review plugin implementation and naming',
              timestamp: new Date(),
            });
          }
        }
      }
    }

    return violations;
  }

  /**
   * Validate context isolation security
   */
  private validateContextIsolation(contexts: string[]): SecurityViolation[] {
    const violations: SecurityViolation[] = [];

    // Check for context overlap with trusted contexts
    const trustedSet = new Set(this.config.trustedContexts);
    const contextSet = new Set(contexts);

    for (const trustedContext of trustedSet) {
      if (contextSet.has(trustedContext)) {
        violations.push({
          code: 'SEC013',
          message: `Request attempts to access trusted context: ${trustedContext}`,
          severity: SecurityThreatLevel.MEDIUM,
          field: 'contexts',
          value: trustedContext,
          mitigation: 'Remove trusted contexts from request or obtain proper authorization',
          timestamp: new Date(),
        });
      }
    }

    return violations;
  }

  /**
   * Validate correlation tracking
   */
  private validateCorrelationTracking(context: IPerformanceContext): SecurityViolation[] {
    const violations: SecurityViolation[] = [];

    if (!context.correlationId) {
      violations.push({
        code: 'SEC014',
        message: 'Correlation tracking is required but not provided',
        severity: SecurityThreatLevel.MEDIUM,
        field: 'correlationId',
        value: undefined,
        mitigation: 'Provide correlationId for request tracking',
        timestamp: new Date(),
      });
    }

    return violations;
  }

  /**
   * Validate strategy permissions
   */
  private validateStrategyPermissions(
    strategy: IPerformanceStrategy,
    context: IPerformanceContext
  ): SecurityViolation[] {
    const violations: SecurityViolation[] = [];

    // Validate high-privilege strategies
    if (
      strategy.strategyId === 'pre-compiled-registry' &&
      context.performanceMode !== 'enterprise'
    ) {
      violations.push({
        code: 'SEC015',
        message: 'Pre-compiled registry strategy requires enterprise mode',
        severity: SecurityThreatLevel.HIGH,
        field: 'strategyId',
        value: strategy.strategyId,
        mitigation: 'Use enterprise mode for pre-compiled registry strategy',
        timestamp: new Date(),
      });
    }

    if (strategy.strategyId === 'parallel-discovery' && context.performanceMode !== 'enterprise') {
      violations.push({
        code: 'SEC016',
        message: 'Parallel discovery strategy requires enterprise mode',
        severity: SecurityThreatLevel.MEDIUM,
        field: 'strategyId',
        value: strategy.strategyId,
        mitigation: 'Use enterprise mode for parallel discovery strategy',
        timestamp: new Date(),
      });
    }

    return violations;
  }

  /**
   * Validate strategy isolation
   */
  private validateStrategyIsolation(
    strategy: IPerformanceStrategy,
    context: IPerformanceContext
  ): SecurityViolation[] {
    const violations: SecurityViolation[] = [];

    // Ensure caching strategies don't leak data between contexts
    if (
      strategy.strategyId === 'cached-discovery' &&
      context.contexts &&
      context.contexts.length > 1
    ) {
      violations.push({
        code: 'SEC017',
        message: 'Cached discovery with multiple contexts may cause data leakage',
        severity: SecurityThreatLevel.LOW,
        field: 'strategyId',
        value: strategy.strategyId,
        mitigation: 'Use selective discovery or ensure cache isolation',
        timestamp: new Date(),
      });
    }

    return violations;
  }

  /**
   * Validate execution context
   */
  private validateExecutionContext(
    strategy: IPerformanceStrategy,
    context: IPerformanceContext
  ): SecurityViolation[] {
    const violations: SecurityViolation[] = [];

    // Validate timeout for potentially expensive strategies
    if (
      strategy.strategyId === 'parallel-discovery' &&
      (!context.timeout || context.timeout > 60000)
    ) {
      violations.push({
        code: 'SEC018',
        message: 'Parallel discovery should have timeout protection',
        severity: SecurityThreatLevel.LOW,
        field: 'timeout',
        value: context.timeout,
        mitigation: 'Set timeout to 60 seconds or less for parallel discovery',
        timestamp: new Date(),
      });
    }

    return violations;
  }

  /**
   * Calculate overall threat level
   */
  private calculateThreatLevel(violations: SecurityViolation[]): SecurityThreatLevel {
    if (violations.some(v => v.severity === SecurityThreatLevel.CRITICAL)) {
      return SecurityThreatLevel.CRITICAL;
    }
    if (violations.some(v => v.severity === SecurityThreatLevel.HIGH)) {
      return SecurityThreatLevel.HIGH;
    }
    if (violations.some(v => v.severity === SecurityThreatLevel.MEDIUM)) {
      return SecurityThreatLevel.MEDIUM;
    }
    return SecurityThreatLevel.LOW;
  }

  /**
   * Generate security recommendations
   */
  private generateSecurityRecommendations(
    config: PerformanceConfigurationOptions,
    violations: SecurityViolation[]
  ): string[] {
    const recommendations: string[] = [];

    if (violations.length === 0) {
      recommendations.push('Configuration passed all security checks');
    } else {
      recommendations.push('Review and address security violations');
      if (violations.some(v => v.code.startsWith('SEC00'))) {
        recommendations.push('Enable additional security monitoring for high-risk operations');
      }
      if (violations.some(v => v.field === 'preCompiledRegistry')) {
        recommendations.push('Consider using signed registry for enhanced security');
      }
    }

    return recommendations;
  }

  /**
   * Generate context-specific recommendations
   */
  private generateContextRecommendations(
    context: IPerformanceContext,
    violations: SecurityViolation[]
  ): string[] {
    const recommendations: string[] = [];

    if (context.performanceMode === 'development') {
      recommendations.push('Consider enabling additional security checks for development mode');
    }

    if (!context.correlationId && this.config.requireCorrelationTracking) {
      recommendations.push('Enable correlation tracking for better security monitoring');
    }

    return recommendations;
  }

  /**
   * Generate strategy-specific recommendations
   */
  private generateStrategyRecommendations(
    strategy: IPerformanceStrategy,
    context: IPerformanceContext,
    violations: SecurityViolation[]
  ): string[] {
    const recommendations: string[] = [];

    if (strategy.strategyId === 'cached-discovery') {
      recommendations.push('Ensure cache isolation between different security contexts');
    }

    if (strategy.strategyId === 'parallel-discovery') {
      recommendations.push('Monitor resource usage for parallel execution');
    }

    return recommendations;
  }

  /**
   * Generate configuration hash for integrity checking
   */
  private generateConfigHash(config: PerformanceConfigurationOptions): string {
    const configString = JSON.stringify(config, Object.keys(config).sort());
    // Simple hash function for demonstration
    let hash = 0;
    for (let i = 0; i < configString.length; i++) {
      const char = configString.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Generate context hash for integrity checking
   */
  private generateContextHash(context: IPerformanceContext): string {
    const contextData = {
      performanceMode: context.performanceMode,
      contexts: context.contexts,
      pluginCount: context.discoveryPlugins.length,
      correlationId: context.correlationId,
    };
    const contextString = JSON.stringify(contextData, Object.keys(contextData).sort());
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < contextString.length; i++) {
      const char = contextString.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Update security configuration
   */
  updateConfig(newConfig: Partial<SecurityValidationConfig>): void {
    Object.assign(this.config, newConfig);
  }

  /**
   * Get current security configuration
   */
  getConfig(): SecurityValidationConfig {
    return { ...this.config };
  }
}

/**
 * Global security validator instance
 */
export const globalSecurityValidator = new SecurityValidator({
  requireCorrelationTracking: process.env.NODE_ENV === 'production',
});
