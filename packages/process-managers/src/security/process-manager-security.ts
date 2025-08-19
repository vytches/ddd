import { ProcessManagerSecurityError } from './process-manager-security-error';

export class ProcessManagerSecurity {
  static validateId(id: unknown): string {
    // Check if it's a string
    if (typeof id !== 'string') {
      throw new ProcessManagerSecurityError('Process Manager ID must be a string');
    }

    // Check if it's empty
    if (!id.trim()) {
      throw new ProcessManagerSecurityError('Process Manager ID cannot be empty');
    }

    // Check length
    if (id.length > 255) {
      throw new ProcessManagerSecurityError(
        'Process Manager ID exceeds maximum length of 255 characters'
      );
    }

    // Check for XSS patterns
    if (
      id.includes('javascript:') ||
      id.includes('data:') ||
      id.includes('vbscript:') ||
      id.includes('<script') ||
      id.includes('<')
    ) {
      throw new ProcessManagerSecurityError('Process Manager ID contains XSS patterns');
    }

    // Check for dangerous path traversal or other dangerous characters
    if (id.includes('..') || id.includes('>') || id.includes('\\')) {
      throw new ProcessManagerSecurityError('Process Manager ID contains invalid characters');
    }

    return id.trim();
  }

  static validateType(type: unknown): string {
    if (typeof type !== 'string' || !type.trim()) {
      throw new ProcessManagerSecurityError('Process Manager type must be a non-empty string');
    }

    // Only alphanumeric and common separators
    if (!/^[a-zA-Z0-9_-]+$/.test(type)) {
      throw new ProcessManagerSecurityError('Process Manager type contains invalid characters');
    }

    return type.trim();
  }

  static validateTimeout(timeout: unknown): number | undefined {
    if (timeout === undefined || timeout === null) {
      return undefined;
    }

    const timeoutNum = Number(timeout);

    if (isNaN(timeoutNum)) {
      throw new ProcessManagerSecurityError('Timeout must be a valid number');
    }

    if (!Number.isInteger(timeoutNum)) {
      throw new ProcessManagerSecurityError('Timeout must be an integer');
    }

    // Allow shorter timeouts for testing (minimum 10ms)
    if (timeoutNum < 10) {
      throw new ProcessManagerSecurityError('Timeout must be at least 10ms');
    }

    if (timeoutNum > 86400000) {
      // Max 24 hours
      throw new ProcessManagerSecurityError('Timeout cannot exceed 86400000ms (24 hours)');
    }

    return timeoutNum;
  }

  static sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      // Skip prototype pollution vectors
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue;
      }

      if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeObject(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  static maskSensitiveData(data: Record<string, unknown>): Record<string, unknown> {
    const masked: Record<string, unknown> = {};
    const sensitiveKeys = [
      'password',
      'token',
      'apiKey',
      'secret',
      'credential',
      'ssn',
      'creditCard',
      'email',
    ];

    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some(k => lowerKey.includes(k.toLowerCase()))) {
        masked[key] = '[MASKED]';
      } else if (typeof value === 'object' && value !== null) {
        masked[key] = this.maskSensitiveData(value as Record<string, unknown>);
      } else {
        masked[key] = value;
      }
    }

    return masked;
  }

  static validateEventPayload(payload: unknown): Record<string, unknown> {
    if (!payload || typeof payload !== 'object') {
      throw new ProcessManagerSecurityError('Event payload must be a valid object');
    }

    return this.sanitizeObject(payload as Record<string, unknown>);
  }

  static sanitizeStepData(stepData: unknown): Record<string, unknown> {
    if (!stepData || typeof stepData !== 'object') {
      return {};
    }

    // Check size limit (1MB)
    const jsonStr = JSON.stringify(stepData);
    if (jsonStr.length > 1024 * 1024) {
      throw new ProcessManagerSecurityError('Step data exceeds maximum size of 1MB');
    }

    return this.sanitizeObject(stepData as Record<string, unknown>);
  }

  static sanitizeCorrelationData(correlationData: unknown): Record<string, unknown> {
    if (!correlationData || typeof correlationData !== 'object') {
      return {};
    }

    return this.sanitizeObject(correlationData as Record<string, unknown>);
  }

  static sanitizeMetadata(metadata: unknown): Record<string, unknown> {
    if (!metadata || typeof metadata !== 'object') {
      return {};
    }

    return this.sanitizeObject(metadata as Record<string, unknown>);
  }
}
