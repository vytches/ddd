import { describe, it, expect } from 'vitest';
import { ValidationError, ValidationErrors } from './validation-error';

describe('ValidationError', () => {
  it('should create a validation error with property and message', () => {
    // Arrange
    const property = 'username';
    const message = 'Username is required';

    // Act
    const error = new ValidationError(property, message);

    // Assert
    expect(error.property).toBe(property);
    expect(error.message).toBe(message);
    expect(error.context).toBeUndefined();
  });

  it('should include context data when provided', () => {
    // Arrange
    const property = 'email';
    const message = 'Invalid email format';
    const context = { value: 'test', expectedPattern: /^\S+@\S+\.\S+$/ };

    // Act
    const error = new ValidationError(property, message, context);

    // Assert
    expect(error.property).toBe(property);
    expect(error.message).toBe(message);
    expect(error.context).toEqual(context);
  });

  it('should convert to string with property and message', () => {
    // Arrange
    const property = 'age';
    const message = 'Must be 18 or older';
    const error = new ValidationError(property, message);

    // Act
    const result = error.toString();

    // Assert
    expect(result).toBe('age: Must be 18 or older');
  });
});

describe('ValidationErrors', () => {
  it('should create a collection of validation errors', () => {
    // Arrange
    const error1 = new ValidationError('name', 'Name is required');
    const error2 = new ValidationError('email', 'Invalid email format');

    // Act
    const errors = new ValidationErrors([error1, error2]);

    // Assert
    expect(errors.errors).toHaveLength(2);
    expect(errors.errors[0]).toBe(error1);
    expect(errors.errors[1]).toBe(error2);
  });

  it('should create error message with all validation errors', () => {
    // Arrange
    const error1 = new ValidationError('name', 'Name is required');
    const error2 = new ValidationError('email', 'Invalid email format');

    // Act
    const errors = new ValidationErrors([error1, error2]);

    // Assert
    expect(errors.message).toBe(
      'Validation failed with 2 error(s): name: Name is required; email: Invalid email format'
    );
  });

  it('should be an instance of Error', () => {
    // Arrange & Act
    const errors = new ValidationErrors([new ValidationError('test', 'Test error')]);

    // Assert
    expect(errors).toBeInstanceOf(Error);
    expect(errors.name).toBe('ValidationErrors');
  });
});
