# Monadic Operations

**Version**: 1.0.0
**Package**: @vytches-ddd/utils
**Complexity**: advanced
**Domain**: Infrastructure
**Patterns**: Functional programming, monads, category theory
**Dependencies**: @vytches-ddd/utils

## Description

Advanced functional programming patterns using Result as a monad. This example demonstrates monadic operations, functor laws, applicative patterns, and category theory concepts applied to practical error handling and data transformation scenarios.

## Business Context

Complex business applications often involve:
- Multi-step data transformations with error propagation
- Conditional logic based on previous operation results
- Composable validation and processing pipelines
- Functional composition patterns for maintainable code
- Mathematical laws ensuring predictable behavior

Monadic patterns provide a mathematical foundation for composing operations while maintaining type safety and explicit error handling.

## Code Example

```typescript
// monadic-operations.ts
import { Result, LibUtils } from '@vytches-ddd/utils';
import { 
  UserData, 
  ValidationError, 
  Monad,
  Railway,
  PerformanceMetrics 
} from '../types';

// ✅ FOCUS: Monadic operations and functional composition
export class MonadicOperations {

  // 1. Extended Result Monad Implementation
  static createResultMonad<T, E>(value: T): ResultMonad<T, E> {
    return new ResultMonad(Result.ok<T, E>(value));
  }

  static failResultMonad<T, E>(error: E): ResultMonad<T, E> {
    return new ResultMonad(Result.fail<T, E>(error));
  }

  // 2. Functor Laws Demonstration
  demonstrateFunctorLaws(): void {
    console.log('=== Functor Laws Demonstration ===');
    
    const data = { name: 'John', age: 30 };
    
    // Law 1: Identity - fmap(id) = id
    const identity = <T>(x: T) => x;
    const result1 = Result.ok(data);
    const mapped1 = result1.map(identity);
    
    console.log('Identity Law:');
    console.log('Original equals mapped identity:', 
      LibUtils.deepEqual(result1.isSuccess ? result1.value : null, 
                        mapped1.isSuccess ? mapped1.value : null));

    // Law 2: Composition - fmap(f . g) = fmap(f) . fmap(g)
    const f = (user: any) => ({ ...user, processed: true });
    const g = (user: any) => ({ ...user, validated: true });
    const composed = (user: any) => f(g(user));
    
    const result2 = Result.ok(data);
    const composedMapping = result2.map(composed);
    const chainedMapping = result2.map(g).map(f);
    
    console.log('Composition Law:');
    console.log('Composed equals chained:', 
      LibUtils.deepEqual(
        composedMapping.isSuccess ? composedMapping.value : null,
        chainedMapping.isSuccess ? chainedMapping.value : null
      ));
  }

  // 3. Applicative Functor Pattern
  demonstrateApplicativePattern(): void {
    console.log('\n=== Applicative Pattern ===');
    
    // Lifting functions to work with Result contexts
    const validateName = (name: string): Result<string, string> => 
      name.length >= 2 ? Result.ok(name) : Result.fail('Name too short');
    
    const validateAge = (age: number): Result<number, string> => 
      age >= 18 ? Result.ok(age) : Result.fail('Age too young');
    
    const validateEmail = (email: string): Result<string, string> => 
      email.includes('@') ? Result.ok(email) : Result.fail('Invalid email');

    // Create user function lifted to Result context
    const createUser = (name: string) => (age: number) => (email: string): UserData => ({
      id: LibUtils.getUUID(),
      name,
      email,
      role: 'user',
      createdAt: new Date(),
    });

    // Apply validation and user creation
    const userResult = this.applyValidations(
      createUser,
      validateName('John Doe'),
      validateAge(25),
      validateEmail('john@example.com')
    );

    if (userResult.isSuccess) {
      console.log('User created successfully:', userResult.value.name);
    } else {
      console.log('Validation failed:', userResult.error);
    }
  }

  private applyValidations<T>(
    fn: (a: string) => (b: number) => (c: string) => T,
    nameResult: Result<string, string>,
    ageResult: Result<number, string>,
    emailResult: Result<string, string>
  ): Result<T, string[]> {
    // Collect all validation errors
    const errors: string[] = [];
    
    if (nameResult.isFailure) errors.push(nameResult.error);
    if (ageResult.isFailure) errors.push(ageResult.error);
    if (emailResult.isFailure) errors.push(emailResult.error);
    
    if (errors.length > 0) {
      return Result.fail(errors);
    }
    
    // Apply the function if all validations pass
    return Result.ok(fn(nameResult.value)(ageResult.value)(emailResult.value));
  }

  // 4. Monad Laws Verification
  demonstrateMonadLaws(): void {
    console.log('\n=== Monad Laws Demonstration ===');
    
    const value = 42;
    const f = (x: number) => Result.ok(x * 2);
    const g = (x: number) => Result.ok(x + 10);

    // Law 1: Left Identity - return a >>= f = f a
    const leftIdentity1 = Result.ok(value).flatMap(f);
    const leftIdentity2 = f(value);
    
    console.log('Left Identity Law:');
    console.log('Result.ok(value).flatMap(f) equals f(value):', 
      leftIdentity1.isSuccess && leftIdentity2.isSuccess && 
      leftIdentity1.value === leftIdentity2.value);

    // Law 2: Right Identity - m >>= return = m
    const m = Result.ok(value);
    const rightIdentity1 = m.flatMap(Result.ok);
    
    console.log('Right Identity Law:');
    console.log('m.flatMap(Result.ok) equals m:', 
      m.isSuccess && rightIdentity1.isSuccess && 
      m.value === rightIdentity1.value);

    // Law 3: Associativity - (m >>= f) >>= g = m >>= (x => f(x) >>= g)
    const associativity1 = Result.ok(value).flatMap(f).flatMap(g);
    const associativity2 = Result.ok(value).flatMap(x => f(x).flatMap(g));
    
    console.log('Associativity Law:');
    console.log('(m >>= f) >>= g equals m >>= (x => f(x) >>= g):', 
      associativity1.isSuccess && associativity2.isSuccess && 
      associativity1.value === associativity2.value);
  }

  // 5. Railway-Oriented Programming Implementation
  createRailwayPipeline<TInput, TOutput>(
    operations: Array<(input: any) => Result<any, Error>>
  ): (input: TInput) => Result<TOutput, Error> {
    return (input: TInput) => {
      return operations.reduce(
        (currentResult: Result<any, Error>, operation) => {
          return currentResult.flatMap(operation);
        },
        Result.ok(input)
      );
    };
  }

  demonstrateRailwayProgramming(): void {
    console.log('\n=== Railway-Oriented Programming ===');

    // Define pipeline operations
    const parseInput = (input: string): Result<any, Error> => {
      try {
        return Result.ok(JSON.parse(input));
      } catch (error) {
        return Result.fail(new Error('Invalid JSON'));
      }
    };

    const validateStructure = (data: any): Result<any, Error> => {
      if (!data.user || !data.user.name || !data.user.email) {
        return Result.fail(new Error('Invalid data structure'));
      }
      return Result.ok(data);
    };

    const normalizeUser = (data: any): Result<UserData, Error> => {
      return Result.ok({
        id: LibUtils.getUUID(),
        name: data.user.name.trim(),
        email: data.user.email.toLowerCase(),
        role: data.user.role || 'user',
        createdAt: new Date(),
      });
    };

    const validateBusiness = (user: UserData): Result<UserData, Error> => {
      if (user.email.includes('test')) {
        return Result.fail(new Error('Test emails not allowed'));
      }
      return Result.ok(user);
    };

    // Create and execute pipeline
    const pipeline = this.createRailwayPipeline<string, UserData>([
      parseInput,
      validateStructure,
      normalizeUser,
      validateBusiness,
    ]);

    // Test with valid data
    const validInput = JSON.stringify({
      user: { name: '  John Doe  ', email: 'JOHN@EXAMPLE.COM', role: 'admin' }
    });

    const result = pipeline(validInput);
    
    if (result.isSuccess) {
      console.log('Pipeline success:', result.value.name, '-', result.value.email);
    } else {
      console.log('Pipeline failed:', result.error.message);
    }

    // Test with invalid data
    const invalidInput = JSON.stringify({
      user: { name: 'Test User', email: 'test@example.com' }
    });

    const failResult = pipeline(invalidInput);
    console.log('Expected failure:', failResult.isFailure ? failResult.error.message : 'Unexpected success');
  }

  // 6. Advanced Composition Patterns
  demonstrateAdvancedComposition(): void {
    console.log('\n=== Advanced Composition Patterns ===');

    // Kleisli composition
    const kleisliCompose = <A, B, C>(
      f: (a: A) => Result<B, Error>,
      g: (b: B) => Result<C, Error>
    ) => (a: A): Result<C, Error> => f(a).flatMap(g);

    const addTen = (x: number) => Result.ok(x + 10);
    const multiplyByTwo = (x: number) => Result.ok(x * 2);
    const validatePositive = (x: number) => 
      x > 0 ? Result.ok(x) : Result.fail(new Error('Must be positive'));

    // Compose operations
    const composedOperation = kleisliCompose(
      kleisliCompose(addTen, multiplyByTwo),
      validatePositive
    );

    const compositionResult = composedOperation(5);
    console.log('Kleisli composition result:', 
      compositionResult.isSuccess ? compositionResult.value : compositionResult.error.message);

    // Parallel composition for independent operations
    const parallelValidation = this.validateInParallel([
      { name: 'length', validator: (s: string) => s.length >= 3 ? Result.ok(s) : Result.fail('Too short') },
      { name: 'format', validator: (s: string) => s.includes('@') ? Result.ok(s) : Result.fail('Missing @') },
      { name: 'domain', validator: (s: string) => s.endsWith('.com') ? Result.ok(s) : Result.fail('Invalid domain') },
    ]);

    const emailValidation = parallelValidation('user@example.com');
    console.log('Parallel validation:', 
      emailValidation.isSuccess ? 'All passed' : `Failed: ${emailValidation.error.join(', ')}`);
  }

  private validateInParallel(
    validators: Array<{ name: string; validator: (input: string) => Result<string, string> }>
  ): (input: string) => Result<string, string[]> {
    return (input: string) => {
      const errors: string[] = [];
      
      validators.forEach(({ name, validator }) => {
        const result = validator(input);
        if (result.isFailure) {
          errors.push(`${name}: ${result.error}`);
        }
      });

      return errors.length > 0 ? Result.fail(errors) : Result.ok(input);
    };
  }

  // 7. Performance-Optimized Monadic Operations
  createOptimizedPipeline<T>(operations: Array<(input: T) => Result<T, Error>>): (input: T) => Result<T, Error> {
    // Memoization for pure operations
    const memoCache = new Map<string, Result<T, Error>>();
    
    return (input: T) => {
      const inputKey = JSON.stringify(input);
      
      if (memoCache.has(inputKey)) {
        return memoCache.get(inputKey)!;
      }

      const startTime = performance.now();
      
      const result = operations.reduce(
        (currentResult: Result<T, Error>, operation, index) => {
          if (currentResult.isFailure) return currentResult;
          
          const operationStart = performance.now();
          const operationResult = operation(currentResult.value);
          const operationEnd = performance.now();
          
          console.log(`Operation ${index} took ${operationEnd - operationStart}ms`);
          return operationResult;
        },
        Result.ok(input)
      );

      const endTime = performance.now();
      
      const metrics: PerformanceMetrics = {
        executionTime: endTime - startTime,
        memoryUsage: {
          before: 0, // Would use process.memoryUsage() in Node.js
          after: 0,
          delta: 0,
        },
        operationsPerSecond: operations.length / ((endTime - startTime) / 1000),
      };

      console.log('Pipeline performance:', metrics);
      
      // Cache successful results for pure operations
      if (result.isSuccess && this.isPureOperation(operations)) {
        memoCache.set(inputKey, result);
      }

      return result;
    };
  }

  private isPureOperation(operations: Array<(input: any) => Result<any, Error>>): boolean {
    // Simplified purity check - in real implementation, would analyze function properties
    return operations.length <= 5; // Assume small operations are more likely to be pure
  }

  // 8. Category Theory Applications
  demonstrateCategoryTheory(): void {
    console.log('\n=== Category Theory Applications ===');

    // Morphisms in the Result category
    const morphismA = (x: number) => Result.ok(x.toString());
    const morphismB = (s: string) => Result.ok(s.length);
    const morphismC = (n: number) => Result.ok(n > 5);

    // Identity morphism
    const identity = <T>(x: T) => Result.ok(x);

    // Composition of morphisms
    const composed = this.composeMorphisms([morphismA, morphismB, morphismC]);

    const categoryResult = composed(42);
    console.log('Category theory composition:', 
      categoryResult.isSuccess ? categoryResult.value : categoryResult.error);

    // Natural transformation
    const listToResult = <T>(list: T[]): Result<T[], Error> => 
      list.length > 0 ? Result.ok(list) : Result.fail(new Error('Empty list'));

    const resultToMaybe = <T>(result: Result<T, Error>): T | null => 
      result.isSuccess ? result.value : null;

    // Demonstrate natural transformation properties
    const list = [1, 2, 3];
    const transformed = listToResult(list.map(x => x * 2));
    const alternative = resultToMaybe(listToResult(list));

    console.log('Natural transformation:', {
      transformed: transformed.isSuccess ? transformed.value : null,
      alternative,
    });
  }

  private composeMorphisms<T>(morphisms: Array<(input: any) => Result<any, Error>>): (input: T) => Result<any, Error> {
    return (input: T) => {
      return morphisms.reduce(
        (acc: Result<any, Error>, morphism) => acc.flatMap(morphism),
        Result.ok(input)
      );
    };
  }
}

// Extended Result Monad implementation
class ResultMonad<T, E> implements Monad<T> {
  constructor(private result: Result<T, E>) {}

  get value(): T {
    return this.result.value;
  }

  map<U>(fn: (value: T) => U): ResultMonad<U, E> {
    return new ResultMonad(this.result.map(fn));
  }

  flatMap<U>(fn: (value: T) => ResultMonad<U, E>): ResultMonad<U, E> {
    if (this.result.isFailure) {
      return new ResultMonad(Result.fail<U, E>(this.result.error));
    }
    return fn(this.result.value);
  }

  filter(predicate: (value: T) => boolean): ResultMonad<T, E> {
    if (this.result.isFailure) {
      return this;
    }
    
    if (predicate(this.result.value)) {
      return this;
    }
    
    // Would need to provide a default error for filter failure
    return new ResultMonad(Result.fail<T, E>(undefined as any));
  }

  // Additional monadic operations
  fold<U>(onFailure: (error: E) => U, onSuccess: (value: T) => U): U {
    return this.result.isSuccess ? onSuccess(this.result.value) : onFailure(this.result.error);
  }

  orElse(alternative: ResultMonad<T, E>): ResultMonad<T, E> {
    return this.result.isSuccess ? this : alternative;
  }
}

// Extension methods for Result to support advanced monadic operations
declare module '@vytches-ddd/utils' {
  interface Result<TValue, TError> {
    sequence<U>(results: Result<U, TError>[]): Result<U[], TError>;
    traverse<U>(fn: (value: TValue) => Result<U, TError>): Result<U[], TError>;
  }
}
```

## Key Features

- **Monad Laws**: Verification of left identity, right identity, and associativity
- **Functor Laws**: Demonstration of identity and composition laws
- **Applicative Patterns**: Parallel validation and lifting of functions
- **Railway Programming**: Composable pipelines with early termination
- **Kleisli Composition**: Monadic function composition
- **Category Theory**: Morphisms, natural transformations, and composition
- **Performance Optimization**: Memoization and metrics for monadic pipelines

## Usage Examples

```typescript
const operations = new MonadicOperations();

// Demonstrate monad laws
operations.demonstrateMonadLaws();

// Create railway pipeline
const pipeline = operations.createRailwayPipeline([
  (data: string) => Result.try(() => JSON.parse(data)),
  (parsed: any) => parsed.user ? Result.ok(parsed) : Result.fail(new Error('No user')),
  (data: any) => Result.ok({ ...data.user, processed: true }),
]);

const result = pipeline('{"user": {"name": "John"}}');

// Advanced composition
operations.demonstrateAdvancedComposition();

// Performance-optimized pipeline
const optimizedPipeline = operations.createOptimizedPipeline([
  (x: number) => Result.ok(x * 2),
  (x: number) => Result.ok(x + 1),
  (x: number) => x > 0 ? Result.ok(x) : Result.fail(new Error('Must be positive')),
]);

const optimizedResult = optimizedPipeline(5);
```

## Mathematical Foundations

### Monad Laws
1. **Left Identity**: `return a >>= f` ≡ `f a`
2. **Right Identity**: `m >>= return` ≡ `m`
3. **Associativity**: `(m >>= f) >>= g` ≡ `m >>= (x => f(x) >>= g)`

### Functor Laws
1. **Identity**: `fmap(id)` ≡ `id`
2. **Composition**: `fmap(f ∘ g)` ≡ `fmap(f) ∘ fmap(g)`

### Category Theory
- **Objects**: Types in TypeScript
- **Morphisms**: Functions between types
- **Composition**: Function composition that is associative
- **Identity**: Identity function for each type

## Common Pitfalls

- **Breaking monad laws**: Ensure implementations satisfy mathematical laws
- **Performance overhead**: Monadic chains can be expensive - optimize hot paths
- **Stack overflow**: Deep monadic chains can cause stack issues
- **Type complexity**: TypeScript inference struggles with deeply nested monadic types

## Related Examples

- [Advanced Result Patterns](./example-1.md)
- [Railway-Oriented Programming](./example-2.md)
- [Performance-Optimized Utilities](./example-3.md)