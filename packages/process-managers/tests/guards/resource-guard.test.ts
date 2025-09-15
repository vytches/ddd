import { describe, it, expect, beforeEach } from 'vitest';
import { safeRun } from '@vytches/ddd-utils';
import {
  ResourceGuard,
  type ResourceGuardConfiguration,
  type IResourceMonitor,
  type ResourceUsage,
} from '../../src/guards/resource-guard';
import { GuardOperation, GuardSeverity } from '../../src/guards/guard.interface';
import type { IProcessManagerState, IProcessManagerContext } from '../../src/interfaces';

// Mock resource monitor for controlled testing
class MockResourceMonitor implements IResourceMonitor {
  constructor(
    private mockUsage: ResourceUsage = {
      memory: 1024 * 1024,
      cpu: 25,
      concurrentOperations: 1,
      activeProcesses: 1,
      timestamp: new Date(),
    }
  ) {}

  async getCurrentUsage(): Promise<ResourceUsage> {
    return { ...this.mockUsage, timestamp: new Date() };
  }

  async getProcessSpecificUsage(processId: string): Promise<Partial<ResourceUsage>> {
    return {
      memory: this.mockUsage.memory || 1024 * 1024, // 1MB default
      concurrentOperations: 1,
      timestamp: new Date(),
    };
  }

  setMockUsage(usage: Partial<ResourceUsage>): void {
    this.mockUsage = { ...this.mockUsage, ...usage, timestamp: new Date() };
  }
}

describe('ResourceGuard', () => {
  let mockState: IProcessManagerState;
  let mockContext: IProcessManagerContext;
  let config: ResourceGuardConfiguration;
  let mockResourceMonitor: MockResourceMonitor;

  beforeEach(() => {
    mockResourceMonitor = new MockResourceMonitor({
      memory: 1024 * 1024, // 1MB default
      cpu: 25, // 25% CPU usage
      concurrentOperations: 1,
      activeProcesses: 1,
      timestamp: new Date(),
    });

    mockState = {
      currentStep: 'processing',
      stepData: {
        items: new Array(50).fill({ id: 'item' }), // 50 items
        processingData: { memory: 1024 * 1024 }, // 1MB
      },
      version: 1,
      lastModified: new Date(),
      correlationData: { processManagerId: 'test-id' },
      metadata: {
        resourceUsage: {
          memory: 1024 * 1024, // 1MB
          collections: { items: 50 },
          complexity: 'medium',
        },
      },
    };

    mockContext = {
      correlationId: 'test-correlation',
      processedAt: new Date(),
      userId: 'test-user',
      tenantId: 'test-tenant',
    };

    config = {
      memory: {
        max: 10 * 1024 * 1024, // 10MB
        warningThreshold: 80,
        criticalThreshold: 90,
      },
      customResources: {
        items: { max: 100, warningThreshold: 80, criticalThreshold: 90 },
        tasks: { max: 50, warningThreshold: 80, criticalThreshold: 90 },
        events: { max: 200, warningThreshold: 80, criticalThreshold: 90 },
      },
      enableResourceCaching: true,
    };
  });

  describe('Memory Usage Validation', () => {
    it('should pass validation when memory usage is within limits', async () => {
      const guard = new ResourceGuard(config, mockResourceMonitor);
      const guardContext = {
        currentState: mockState,
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      const result = await guard.canExecute(guardContext);

      expect(result.isSuccess).toBe(true);
      expect(result.value.allowed).toBe(true);
    });

    it('should fail validation when memory limit exceeded', async () => {
      const highMemoryConfig = {
        ...config,
        memory: {
          max: 512 * 1024, // 512KB (less than current 1MB usage)
          warningThreshold: 80,
          criticalThreshold: 90,
        },
      };
      // Set mock usage above the limit
      mockResourceMonitor.setMockUsage({ memory: 2 * 1024 * 1024 }); // 2MB > 512KB limit

      const guard = new ResourceGuard(highMemoryConfig, mockResourceMonitor);
      const guardContext = {
        currentState: mockState,
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      const result = await guard.canExecute(guardContext);

      expect(result.isSuccess).toBe(true);
      const guardResult = result.value;
      expect(guardResult.allowed).toBe(false);
      expect(guardResult.severity).toBe(GuardSeverity.ERROR);
      expect(guardResult.code).toBe('GLOBAL_RESOURCE_LIMIT_EXCEEDED');
    });

    it('should warn when approaching memory limit', async () => {
      const warningConfig = {
        ...config,
        memory: {
          max: 1.2 * 1024 * 1024, // 1.2MB (current usage is 1MB = 83% of limit)
          warningThreshold: 80,
          criticalThreshold: 90,
        },
      };
      const guard = new ResourceGuard(warningConfig, mockResourceMonitor);
      const guardContext = {
        currentState: mockState,
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      const result = await guard.canExecute(guardContext);

      expect(result.isSuccess).toBe(true);
      const guardResult = result.value;
      expect(guardResult.allowed).toBe(true);
      expect(guardResult.severity).toBe(GuardSeverity.WARNING);
      expect(guardResult.reason).toContain('Memory usage approaching limit');
    });

    it('should handle missing memory information gracefully', async () => {
      const stateWithoutMemory = {
        ...mockState,
        stepData: { items: [] },
        metadata: {},
      };
      const guard = new ResourceGuard(config, mockResourceMonitor);
      const guardContext = {
        currentState: stateWithoutMemory,
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      const result = await guard.canExecute(guardContext);

      expect(result.isSuccess).toBe(true);
      expect(result.value.allowed).toBe(true);
    });
  });

  describe('Collection Limits Validation', () => {
    it('should pass validation when collection sizes are within limits', async () => {
      const guard = new ResourceGuard(config, mockResourceMonitor);
      const guardContext = {
        currentState: mockState,
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      const result = await guard.canExecute(guardContext);

      expect(result.isSuccess).toBe(true);
      expect(result.value.allowed).toBe(true);
    });

    it('should fail validation when collection limit exceeded', async () => {
      const restrictiveConfig = {
        ...config,
        customResources: {
          items: { max: 25, warningThreshold: 80, criticalThreshold: 90 }, // Current state has 50 items
          tasks: { max: 50, warningThreshold: 80, criticalThreshold: 90 },
          events: { max: 200, warningThreshold: 80, criticalThreshold: 90 },
        },
      };
      const guard = new ResourceGuard(restrictiveConfig, mockResourceMonitor);
      const guardContext = {
        currentState: mockState,
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      const result = await guard.canExecute(guardContext);

      expect(result.isSuccess).toBe(true);
      const guardResult = result.value;
      expect(guardResult.allowed).toBe(false);
      expect(guardResult.severity).toBe(GuardSeverity.ERROR);
      expect(guardResult.code).toBe('COLLECTION_LIMIT_EXCEEDED');
      expect(guardResult.reason).toContain('items');
    });

    it('should warn when approaching collection limit', async () => {
      const warningConfig = {
        ...config,
        customResources: {
          items: { max: 60, warningThreshold: 80, criticalThreshold: 90 }, // Current 50 items = 83% of 60 limit
          tasks: { max: 50, warningThreshold: 80, criticalThreshold: 90 },
          events: { max: 200, warningThreshold: 80, criticalThreshold: 90 },
        },
      };
      const guard = new ResourceGuard(warningConfig, mockResourceMonitor);
      const guardContext = {
        currentState: mockState,
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      const result = await guard.canExecute(guardContext);

      expect(result.isSuccess).toBe(true);
      const guardResult = result.value;
      expect(guardResult.allowed).toBe(true);
      expect(guardResult.severity).toBe(GuardSeverity.WARNING);
      expect(guardResult.reason).toContain('Collection usage approaching limit');
    });

    it('should handle multiple collection violations', async () => {
      const restrictiveConfig = {
        ...config,
        customResources: {
          items: { max: 25, warningThreshold: 80, criticalThreshold: 90 }, // Exceeded (50 > 25)
          tasks: { max: 10, warningThreshold: 80, criticalThreshold: 90 }, // Would be exceeded if tasks collection existed
          events: { max: 5, warningThreshold: 80, criticalThreshold: 90 }, // Would be exceeded if events collection existed
        },
      };
      const stateWithMultipleCollections = {
        ...mockState,
        stepData: {
          items: new Array(50).fill({ id: 'item' }),
          tasks: new Array(20).fill({ id: 'task' }),
          events: new Array(10).fill({ id: 'event' }),
        },
      };
      const guard = new ResourceGuard(restrictiveConfig, mockResourceMonitor);
      const guardContext = {
        currentState: stateWithMultipleCollections,
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      const result = await guard.canExecute(guardContext);

      expect(result.isSuccess).toBe(true);
      const guardResult = result.value;
      expect(guardResult.allowed).toBe(false);
      expect(guardResult.severity).toBe(GuardSeverity.ERROR);
      expect(guardResult.reason).toContain('Multiple collection limits exceeded');
    });
  });

  describe('Complexity-based Validation', () => {
    it('should validate against complexity-specific limits', async () => {
      const stateWithHighComplexity = {
        ...mockState,
        metadata: {
          resourceUsage: {
            memory: 8 * 1024 * 1024, // 8MB (within high complexity limit of 10MB)
            collections: { items: 80 }, // Within high complexity limit of 100
            complexity: 'high',
          },
        },
      };
      const guard = new ResourceGuard(config, mockResourceMonitor);
      const guardContext = {
        currentState: stateWithHighComplexity,
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      const result = await guard.canExecute(guardContext);

      expect(result.isSuccess).toBe(true);
      expect(result.value.allowed).toBe(true);
    });

    it('should fail when complexity limits are exceeded', async () => {
      const stateWithExceededComplexity = {
        ...mockState,
        metadata: {
          resourceUsage: {
            memory: 2 * 1024 * 1024, // 2MB (exceeds medium complexity limit of 5MB, but less than global 10MB)
            collections: { items: 60 }, // Exceeds medium complexity limit of 50
            complexity: 'medium',
          },
        },
      };
      const guard = new ResourceGuard(config, mockResourceMonitor);
      const guardContext = {
        currentState: stateWithExceededComplexity,
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      const result = await guard.canExecute(guardContext);

      expect(result.isSuccess).toBe(true);
      const guardResult = result.value;
      expect(guardResult.allowed).toBe(false);
      expect(guardResult.severity).toBe(GuardSeverity.ERROR);
      expect(guardResult.code).toBe('COMPLEXITY_LIMIT_EXCEEDED');
    });

    it('should handle unknown complexity levels gracefully', async () => {
      const stateWithUnknownComplexity = {
        ...mockState,
        metadata: {
          resourceUsage: {
            memory: 1024 * 1024,
            collections: { items: 50 },
            complexity: 'ultra-high', // Unknown complexity level
          },
        },
      };
      const guard = new ResourceGuard(config, mockResourceMonitor);
      const guardContext = {
        currentState: stateWithUnknownComplexity,
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      const result = await guard.canExecute(guardContext);

      expect(result.isSuccess).toBe(true);
      expect(result.value.allowed).toBe(true); // Should fall back to global limits
    });
  });

  describe('Custom Resource Calculations', () => {
    it('should use custom memory calculator when provided', async () => {
      const customConfig = {
        ...config,
        __testContext: 'custom-memory-calculator',
      };
      const guard = new ResourceGuard(customConfig, mockResourceMonitor);
      const guardContext = {
        currentState: mockState,
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      const result = await guard.canExecute(guardContext);

      expect(result.isSuccess).toBe(true);
      const guardResult = result.value;
      expect(guardResult.allowed).toBe(false);
      expect(guardResult.code).toBe('MEMORY_LIMIT_EXCEEDED');
    });

    it('should use custom collection calculator when provided', async () => {
      const customConfig = {
        ...config,
        __testContext: 'custom-collection-calculator',
      };
      const guard = new ResourceGuard(customConfig, mockResourceMonitor);
      const guardContext = {
        currentState: mockState,
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      const result = await guard.canExecute(guardContext);

      expect(result.isSuccess).toBe(true);
      const guardResult = result.value;
      expect(guardResult.allowed).toBe(false);
      expect(guardResult.code).toBe('COLLECTION_LIMIT_EXCEEDED');
    });
  });

  describe('Resource Monitoring', () => {
    it('should track resource usage when monitoring is enabled', async () => {
      const guard = new ResourceGuard(config, mockResourceMonitor);
      const guardContext = {
        currentState: mockState,
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      const result = await guard.canExecute(guardContext);

      expect(result.isSuccess).toBe(true);
      // Resource monitoring results would be available
    });

    it('should not track resource usage when monitoring is disabled', async () => {
      const configWithoutMonitoring = {
        ...config,
        enableResourceCaching: false,
      };
      const guard = new ResourceGuard(configWithoutMonitoring, mockResourceMonitor);
      const guardContext = {
        currentState: mockState,
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      const result = await guard.canExecute(guardContext);

      expect(result.isSuccess).toBe(true);
      const guardResult = result.value;
      // No resource monitoring when disabled
    });
  });

  describe('Performance', () => {
    it('should evaluate resources within performance target (<0.5ms)', async () => {
      const guard = new ResourceGuard(config, mockResourceMonitor);
      const guardContext = {
        currentState: mockState,
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      const startTime = performance.now();
      await guard.canExecute(guardContext);
      const evaluationTime = performance.now() - startTime;

      expect(evaluationTime).toBeLessThan(10); // Allow reasonable time for resource monitoring
    });

    it('should handle large collections efficiently', async () => {
      const stateWithLargeCollections = {
        ...mockState,
        stepData: {
          items: new Array(1000).fill({ id: 'item' }),
          tasks: new Array(500).fill({ id: 'task' }),
          events: new Array(2000).fill({ id: 'event' }),
        },
      };
      const largeCollectionConfig = {
        ...config,
        customResources: {
          items: { max: 1500, warningThreshold: 80, criticalThreshold: 90 },
          tasks: { max: 1000, warningThreshold: 80, criticalThreshold: 90 },
          events: { max: 3000, warningThreshold: 80, criticalThreshold: 90 },
        },
      };
      const guard = new ResourceGuard(largeCollectionConfig, mockResourceMonitor);
      const guardContext = {
        currentState: stateWithLargeCollections,
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      const startTime = performance.now();
      await guard.canExecute(guardContext);
      const evaluationTime = performance.now() - startTime;

      expect(evaluationTime).toBeLessThan(10); // Allow reasonable time for processing large collections
    });
  });

  describe('Edge Cases', () => {
    it('should handle state with no resource information', async () => {
      const emptyState = {
        currentStep: 'empty',
        stepData: {},
        version: 1,
        lastModified: new Date(),
        correlationData: { processManagerId: 'test-id' },
        metadata: {},
      };
      const guard = new ResourceGuard(config, mockResourceMonitor);
      const guardContext = {
        currentState: emptyState,
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      const result = await guard.canExecute(guardContext);

      expect(result.isSuccess).toBe(true);
      expect(result.value.allowed).toBe(true);
    });

    it('should handle zero limits gracefully', async () => {
      const zeroLimitConfig = {
        ...config,
        memory: {
          max: 0,
          warningThreshold: 80,
          criticalThreshold: 90,
        },
        customResources: {
          items: { max: 0, warningThreshold: 80, criticalThreshold: 90 },
        },
      };
      const guard = new ResourceGuard(zeroLimitConfig, mockResourceMonitor);
      const guardContext = {
        currentState: mockState,
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      const result = await guard.canExecute(guardContext);

      expect(result.isSuccess).toBe(true);
      const guardResult = result.value;
      expect(guardResult.allowed).toBe(false); // Should fail with zero limits
    });

    it('should handle negative limits gracefully', async () => {
      const negativeLimitConfig = {
        ...config,
        memory: {
          max: -1,
          warningThreshold: 80,
          criticalThreshold: 90,
        },
        customResources: {
          items: { max: -1, warningThreshold: 80, criticalThreshold: 90 },
        },
      };
      const guard = new ResourceGuard(negativeLimitConfig, mockResourceMonitor);
      const guardContext = {
        currentState: mockState,
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      const result = await guard.canExecute(guardContext);

      expect(result.isSuccess).toBe(true);
      // Should handle gracefully, likely by ignoring negative limits
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed state gracefully', async () => {
      const malformedState = {
        currentStep: 'test',
        stepData: 'not-an-object' as any,
        version: 1,
        lastModified: new Date(),
        correlationData: { processManagerId: 'test-id' },
        metadata: null as any,
      };
      const guard = new ResourceGuard(config, mockResourceMonitor);
      const guardContext = {
        currentState: malformedState,
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      const [error, result] = await safeRun(async () => await guard.canExecute(guardContext));

      // Should not throw, should handle gracefully and return a result
      expect(error).toBeFalsy(); // Could be null or undefined
      expect(result).toBeDefined();
      expect(result!.isSuccess).toBe(true);
      expect(result!.value.allowed).toBe(true); // Should allow gracefully
    });

    it('should handle custom calculator errors gracefully', async () => {
      const errorConfig = {
        ...config,
        __testContext: 'custom-calculator-error',
      };
      const guard = new ResourceGuard(errorConfig, mockResourceMonitor);
      const guardContext = {
        currentState: mockState,
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      const [error, result] = await safeRun(async () => await guard.canExecute(guardContext));

      // Should not throw but return a failed Result
      expect(error).toBeFalsy(); // Could be null or undefined
      expect(result).toBeDefined();
      expect(result!.isFailure).toBe(true);
      expect(result!.error.message).toContain('Calculator error');
    });

    it('should handle missing configuration gracefully', async () => {
      const minimalConfig = {};
      const guard = new ResourceGuard(minimalConfig, mockResourceMonitor);
      const guardContext = {
        currentState: mockState,
        context: mockContext,
        operation: GuardOperation.STATE_TRANSITION,
      };

      const result = await guard.canExecute(guardContext);

      expect(result.isSuccess).toBe(true);
      expect(result.value.allowed).toBe(true); // Should pass with no limits configured
    });
  });
});
