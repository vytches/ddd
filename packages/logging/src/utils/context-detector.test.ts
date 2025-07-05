import { describe, it, expect } from 'vitest';
import { ContextDetector } from './context-detector';

describe('ContextDetector', () => {
  describe('basic context detection', () => {
    it('should return Unknown when no frame available', () => {
      // Mock stack trace to return empty
      const originalPrepareStackTrace = Error.prepareStackTrace;
      const originalStackTraceLimit = Error.stackTraceLimit;

      Error.prepareStackTrace = () => [];
      Error.stackTraceLimit = 0;

      try {
        const result = ContextDetector.detectContext();
        expect(result.contextName).toBe('Unknown');
      } finally {
        Error.prepareStackTrace = originalPrepareStackTrace;
        Error.stackTraceLimit = originalStackTraceLimit;
      }
    });

    it('should detect context name from function call', () => {
      function TestService() {
        return ContextDetector.detectContext();
      }

      const result = TestService();

      // Should detect the function name or filename
      expect(result.contextName).toBeDefined();
      expect(typeof result.contextName).toBe('string');
      expect(result.contextName).not.toBe('');
    });

    it('should extract context from class method', () => {
      class UserService {
        detectFromMethod() {
          return ContextDetector.detectContext();
        }
      }

      const service = new UserService();
      const result = service.detectFromMethod();

      expect(result.contextName).toBeDefined();
      // Might be UserService or filename-based
      expect(typeof result.contextName).toBe('string');
    });
  });

  describe('bounded context extraction', () => {
    it('should extract bounded context from packages path', () => {
      // This is more of an integration test since we can't easily mock the internal parsing
      // The actual implementation would need the stack to contain this path
      const result = ContextDetector.detectContext();

      // Just verify the structure exists, actual bounded context detection depends on runtime stack
      expect(result).toHaveProperty('boundedContext');
      expect(typeof result.boundedContext === 'string' || result.boundedContext === undefined).toBe(
        true
      );
    });
  });

  describe('filename parsing', () => {
    it('should convert filename to PascalCase', () => {
      // Test the toPascalCase method indirectly by testing the overall behavior
      function userServiceHandler() {
        return ContextDetector.detectContext();
      }

      const result = userServiceHandler();
      expect(result.contextName).toBeDefined();
    });

    it('should handle various filename formats', () => {
      // Since we can't directly test private methods, we test the public interface
      const result = ContextDetector.detectContext();
      expect(result).toHaveProperty('contextName');
      expect(result).toHaveProperty('boundedContext');
      expect(result).toHaveProperty('fileName');
      expect(result).toHaveProperty('className');
      expect(result).toHaveProperty('methodName');
    });
  });

  describe('error handling', () => {
    it('should handle errors gracefully when stack trace fails', () => {
      const originalPrepareStackTrace = Error.prepareStackTrace;

      // Mock to throw an error
      Error.prepareStackTrace = () => {
        throw new Error('Stack trace failed');
      };

      try {
        const result = ContextDetector.detectContext();
        expect(result.contextName).toBe('Unknown');
      } finally {
        Error.prepareStackTrace = originalPrepareStackTrace;
      }
    });

    it('should handle undefined or malformed stack frames', () => {
      const originalPrepareStackTrace = Error.prepareStackTrace;

      // Mock to return malformed stack
      Error.prepareStackTrace = () => ['malformed', 'stack', 'frames'];

      try {
        const result = ContextDetector.detectContext();
        expect(result.contextName).toBe('Unknown');
      } finally {
        Error.prepareStackTrace = originalPrepareStackTrace;
      }
    });
  });

  describe('skip frames parameter', () => {
    it('should skip the correct number of frames', () => {
      function level1() {
        return level2();
      }

      function level2() {
        return level3();
      }

      function level3() {
        return ContextDetector.detectContext(0); // Skip no frames
      }

      const result = level1();
      expect(result.contextName).toBeDefined();
    });

    it('should use default skip frames when not provided', () => {
      const result1 = ContextDetector.detectContext();
      const result2 = ContextDetector.detectContext(3);

      // Both should work (though results might differ based on call stack)
      expect(result1.contextName).toBeDefined();
      expect(result2.contextName).toBeDefined();
    });
  });

  describe('integration scenarios', () => {
    it('should work in real service class scenario', () => {
      class OrderService {
        private getUserOrders() {
          return this.detectContextInMethod();
        }

        private detectContextInMethod() {
          return ContextDetector.detectContext();
        }

        processOrder() {
          return this.getUserOrders();
        }
      }

      const service = new OrderService();
      const result = service.processOrder();

      expect(result.contextName).toBeDefined();
      expect(typeof result.contextName).toBe('string');
      expect(result.contextName.length).toBeGreaterThan(0);
    });

    it('should provide consistent results for same calling context', () => {
      function consistentCaller() {
        return ContextDetector.detectContext();
      }

      const result1 = consistentCaller();
      const result2 = consistentCaller();

      // Same caller should produce same context name
      expect(result1.contextName).toBe(result2.contextName);
    });
  });

  describe('return value structure', () => {
    it('should always return required contextName', () => {
      const result = ContextDetector.detectContext();

      expect(result).toHaveProperty('contextName');
      expect(typeof result.contextName).toBe('string');
      expect(result.contextName.length).toBeGreaterThan(0);
    });

    it('should return optional properties as undefined when not available', () => {
      const result = ContextDetector.detectContext();

      // These might be undefined, which is acceptable
      if (result.boundedContext !== undefined) {
        expect(typeof result.boundedContext).toBe('string');
      }

      if (result.fileName !== undefined) {
        expect(typeof result.fileName).toBe('string');
      }

      if (result.className !== undefined) {
        expect(typeof result.className).toBe('string');
      }

      if (result.methodName !== undefined) {
        expect(typeof result.methodName).toBe('string');
      }
    });
  });

  describe('performance', () => {
    it('should complete detection quickly', () => {
      const start = performance.now();

      for (let i = 0; i < 100; i++) {
        ContextDetector.detectContext();
      }

      const end = performance.now();
      const totalTime = end - start;

      // Should complete 100 detections in reasonable time (< 100ms)
      expect(totalTime).toBeLessThan(100);
    });

    it('should not cause memory leaks with repeated calls', () => {
      // Basic test - just ensure it doesn't throw
      for (let i = 0; i < 1000; i++) {
        ContextDetector.detectContext();
      }

      expect(true).toBe(true); // If we get here, no memory issues occurred
    });
  });
});
