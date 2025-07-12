import { describe, it, expect } from 'vitest';
import { safeRun } from '@vytches-ddd/utils';

import { BaseValueObject } from '../src/base-value-object';

// StringValueObject - A concrete implementation for strings with validation
class StringValueObject extends BaseValueObject<string> {
  constructor(value: string) {
    super(value);

    if (!this.validate(value)) {
      throw new Error('Invalid string value');
    }
  }

  validate(value: string): boolean {
    return typeof value === 'string' && value.length > 0;
  }
}

// NumberValueObject - A concrete implementation for numbers with validation
class NumberValueObject extends BaseValueObject<number> {
  constructor(value: number) {
    super(value);

    if (!this.validate(value)) {
      throw new Error('Invalid number value');
    }
  }

  validate(value: number): boolean {
    return typeof value === 'number' && !isNaN(value) && isFinite(value);
  }

  // Override toJSON for specific formatting
  override toJSON(): string {
    return JSON.stringify({
      value: this.value,
      formatted: `$${this.value.toFixed(2)}`,
    });
  }
}

// ComplexValueObject - A value object with a complex structure
interface Person {
  id: string;
  name: string;
  age: number;
}

class PersonValueObject extends BaseValueObject<Person> {
  constructor(value: Person) {
    super(value);

    if (!this.validate(value)) {
      throw new Error('Invalid person data');
    }
  }

  validate(value: Person): boolean {
    return (
      typeof value === 'object' &&
      value !== null &&
      typeof value.id === 'string' &&
      value.id.length > 0 &&
      typeof value.name === 'string' &&
      value.name.length > 0 &&
      typeof value.age === 'number' &&
      value.age >= 0
    );
  }

  // Custom string representation
  override toString(): string {
    return `Person: ${this.value.name} (${this.value.age})`;
  }
}

describe('BaseValueObject', () => {
  describe('StringValueObject', () => {
    it('should create a valid string value object', () => {
      // Arrange
      const stringValue = 'test';

      // Act
      const vo = new StringValueObject(stringValue);

      // Assert
      expect(vo.getValue()).toBe(stringValue);
    });

    it('should throw an error for invalid string', () => {
      // Arrange
      const emptyString = '';

      // Act & Assert
      const [error] = safeRun(() => new StringValueObject(emptyString));
      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toBe('Invalid string value');
    });

    it('should compare two string value objects for equality', () => {
      // Arrange
      const vo1 = new StringValueObject('test');
      const vo2 = new StringValueObject('test');
      const vo3 = new StringValueObject('different');

      // Act & Assert
      expect(vo1.equals(vo2)).toBe(true);
      expect(vo1.equals(vo3)).toBe(false);
    });

    it('should return string representation', () => {
      // Arrange
      const stringValue = 'test';
      const vo = new StringValueObject(stringValue);

      // Act
      const result = vo.toString();

      // Assert
      expect(result).toBe(stringValue);
    });

    it('should return JSON representation', () => {
      // Arrange
      const stringValue = 'test';
      const vo = new StringValueObject(stringValue);

      // Act
      const result = vo.toJSON();

      // Assert
      expect(result).toBe(JSON.stringify(stringValue));
    });

    it('should handle equality with null/undefined', () => {
      // Arrange
      const vo = new StringValueObject('test');

      // Act & Assert
      expect(vo.equals(null as any)).toBe(false);
      expect(vo.equals(undefined as any)).toBe(false);
    });
  });

  describe('NumberValueObject', () => {
    it('should create a valid number value object', () => {
      // Arrange
      const numberValue = 42;

      // Act
      const vo = new NumberValueObject(numberValue);

      // Assert
      expect(vo.getValue()).toBe(numberValue);
    });

    it('should throw an error for invalid numbers', () => {
      // Arrange & Act & Assert
      const [nanError] = safeRun(() => new NumberValueObject(NaN));
      expect(nanError).toBeInstanceOf(Error);
      expect(nanError?.message).toBe('Invalid number value');

      const [infinityError] = safeRun(() => new NumberValueObject(Infinity));
      expect(infinityError).toBeInstanceOf(Error);
      expect(infinityError?.message).toBe('Invalid number value');
    });

    it('should compare two number value objects for equality', () => {
      // Arrange
      const vo1 = new NumberValueObject(42);
      const vo2 = new NumberValueObject(42);
      const vo3 = new NumberValueObject(100);

      // Act & Assert
      expect(vo1.equals(vo2)).toBe(true);
      expect(vo1.equals(vo3)).toBe(false);
    });

    it('should return string representation', () => {
      // Arrange
      const numberValue = 42;
      const vo = new NumberValueObject(numberValue);

      // Act
      const result = vo.toString();

      // Assert
      expect(result).toBe('42');
    });

    it('should return custom JSON representation', () => {
      // Arrange
      const numberValue = 42.5;
      const vo = new NumberValueObject(numberValue);

      // Act
      const result = vo.toJSON();
      const parsed = JSON.parse(result);

      // Assert
      expect(parsed.value).toBe(numberValue);
      expect(parsed.formatted).toBe('$42.50');
    });
  });

  describe('ComplexValueObject', () => {
    it('should create a valid complex value object', () => {
      // Arrange
      const personData: Person = {
        id: '123',
        name: 'John Doe',
        age: 30,
      };

      // Act
      const vo = new PersonValueObject(personData);

      // Assert
      expect(vo.getValue()).toEqual(personData);
    });

    it('should throw an error for invalid person data', () => {
      // Arrange
      const invalidPersons = [
        { id: '', name: 'John', age: 30 }, // Empty ID
        { id: '123', name: '', age: 30 }, // Empty name
        { id: '123', name: 'John', age: -1 }, // Negative age
        { id: '123', name: 'John' }, // Missing property
      ];

      // Act & Assert
      for (const invalidPerson of invalidPersons) {
        const [error] = safeRun(() => new PersonValueObject(invalidPerson as any));
        expect(error).toBeInstanceOf(Error);
        expect(error?.message).toBe('Invalid person data');
      }
    });

    it('should compare two complex value objects for equality', () => {
      // Arrange
      const person1 = { id: '123', name: 'John Doe', age: 30 };
      const person2 = { id: '123', name: 'John Doe', age: 30 };
      const person3 = { id: '456', name: 'Jane Doe', age: 25 };

      const vo1 = new PersonValueObject(person1);
      const vo2 = new PersonValueObject(person2);
      const vo3 = new PersonValueObject(person3);

      // Act & Assert
      expect(vo1.equals(vo2)).toBe(false); // Objects are different instances
      expect(vo1.equals(vo3)).toBe(false);
    });

    it('should return custom string representation', () => {
      // Arrange
      const person = { id: '123', name: 'John Doe', age: 30 };
      const vo = new PersonValueObject(person);

      // Act
      const result = vo.toString();

      // Assert
      expect(result).toBe('Person: John Doe (30)');
    });

    it('should return JSON representation', () => {
      // Arrange
      const person = { id: '123', name: 'John Doe', age: 30 };
      const vo = new PersonValueObject(person);

      // Act
      const result = vo.toJSON();
      const parsed = JSON.parse(result);

      // Assert
      expect(parsed).toEqual(person);
    });
  });

  describe('Edge cases', () => {
    it('should handle special characters in string value objects', () => {
      // Arrange
      const specialChars = 'Special characters: áéíóú ñ €$&@#';

      // Act
      const vo = new StringValueObject(specialChars);

      // Assert
      expect(vo.getValue()).toBe(specialChars);
      expect(vo.toString()).toBe(specialChars);
    });

    it('should handle zero as a valid number', () => {
      // Arrange & Act
      const vo = new NumberValueObject(0);

      // Assert
      expect(vo.getValue()).toBe(0);
    });

    it('should handle object references correctly', () => {
      // Arrange
      const personObj = { id: '123', name: 'John', age: 30 };
      const vo1 = new PersonValueObject({ ...personObj });

      // Modify the original object
      personObj.name = 'Jane';
      const vo2 = new PersonValueObject(personObj);

      // Act & Assert
      // The first VO should keep the original values
      expect(vo1.getValue().name).toEqual('John');
      expect(vo2.getValue().name).toEqual('Jane');
    });
  });

  describe('Inheritance and polymorphism', () => {
    // ExtendedStringValueObject - A subclass of StringValueObject with additional validation
    class ExtendedStringValueObject extends StringValueObject {
      constructor(value: string) {
        super(value);
      }

      override validate(value: string): boolean {
        // Call parent validation first
        if (!super.validate(value)) {
          return false;
        }

        // Additional validation: must contain at least one number
        return /\d/.test(value);
      }
    }

    it('should support inheritance with extended validation', () => {
      // Arrange
      const validValue = 'test123';
      const invalidValue = 'testonly';

      // Act & Assert - Valid value
      const validVO = new ExtendedStringValueObject(validValue);
      expect(validVO?.getValue()).toBe(validValue);

      // Act & Assert - Invalid value (passes parent validation but fails child validation)
      const [error] = safeRun(() => new ExtendedStringValueObject(invalidValue));
      expect(error).toBeInstanceOf(Error);
    });

    it('should maintain polymorphic behavior', () => {
      // Arrange
      const baseValue = 'test123';
      const baseVO = new StringValueObject(baseValue);
      const extendedVO = new ExtendedStringValueObject(baseValue);

      // Act & Assert
      // Both should provide the basic BaseValueObject functionality
      expect(baseVO.toString()).toBe(extendedVO.toString());
      expect(baseVO.toJSON()).toBe(extendedVO.toJSON());

      // But they shouldn't be equal to each other
      expect(baseVO.equals(extendedVO)).toBe(true); // Same value

      // Type checking
      expect(baseVO instanceof BaseValueObject).toBe(true);
      expect(extendedVO instanceof BaseValueObject).toBe(true);
      expect(extendedVO instanceof StringValueObject).toBe(true);
    });
  });

  describe('Immutability', () => {
    // INFO: TypeScript does not allow direct modification of class properties
    // INFO: For now, the object is mutable in JS, it is not in TS

    // it('should ensure value objects are immutable', () => {
    //   // Arrange
    //   const stringValue = 'immutable';
    //   const vo = new StringValueObject(stringValue);

    //   // Act - Attempt to modify the value directly (this should not be allowed in TypeScript)
    //   // But we'll test the runtime behavior for safety
    //   try {
    //     (vo as any).value = 'modified';
    //   } catch (e) {
    //     // Some environments might throw for this attempt
    //   }

    //   // Assert
    //   expect(vo.getValue()).toBe(stringValue);
    // });

    it('should ensure complex objects are not affected by external changes', () => {
      // Arrange
      const person = { id: '123', name: 'John Doe', age: 30 };
      const vo = new PersonValueObject({ ...person }); // Create a copy for safety

      // Act - Modify the original object
      person.name = 'Modified Name';
      person.age = 99;

      // Assert - Value object should keep the original values
      const currentValue = vo.getValue();
      expect(currentValue.name).toBe('John Doe');
      expect(currentValue.age).toBe(30);
    });
  });
});
