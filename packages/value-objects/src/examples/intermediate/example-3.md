# Measurement Value Object - Intermediate Example

**Version**: 2025-01-21 **Package**: @vytches-ddd/value-objects  
**Complexity**: Intermediate **Domain**: Scientific & Engineering **Patterns**:
Unit Conversion, Measurement Systems, Precision Handling **Dependencies**:
@vytches-ddd/value-objects, @vytches-ddd/domain-primitives

## Description

This example demonstrates creating a **Measurement** value object that
encapsulates scientific measurements with unit conversion, precision handling,
and environmental context. Shows intermediate patterns for measurement systems,
unit conversion algorithms, and scientific data management.

## Business Context

Measurement is essential for scientific applications, IoT systems,
manufacturing, and quality control. It provides accurate unit conversion,
precision tracking, and environmental context for measurements. Critical for
sensor data, laboratory systems, manufacturing QC, and engineering calculations.

## Code Example

```typescript
// measurement.ts
import { ValueObject } from '@vytches-ddd/value-objects';
import {
  MeasurementData,
  MeasurementMetadata,
  EnvironmentData,
  UnitConversionResult,
  ValueObjectValidationResult,
} from './types';
import {
  validateRequired,
  validateNumericRange,
  createSuccessResult,
  createFailureResult,
  combineValidationResults,
} from '../shared';

// ✅ Unit system definitions
export type MeasurementUnit = {
  symbol: string;
  name: string;
  category: MeasurementCategory;
  baseUnit?: string;
  conversionFactor?: number;
  conversionFunction?: (value: number) => number;
  inverseFunction?: (value: number) => number;
};

export type MeasurementCategory =
  | 'length'
  | 'mass'
  | 'temperature'
  | 'volume'
  | 'pressure'
  | 'time'
  | 'energy'
  | 'frequency'
  | 'force';

export class Measurement extends ValueObject<MeasurementData> {
  // ✅ FOCUS: Comprehensive unit definitions
  private static readonly UNIT_REGISTRY: Map<string, MeasurementUnit> = new Map(
    [
      // Length units
      [
        'mm',
        {
          symbol: 'mm',
          name: 'millimeter',
          category: 'length',
          baseUnit: 'm',
          conversionFactor: 0.001,
        },
      ],
      [
        'cm',
        {
          symbol: 'cm',
          name: 'centimeter',
          category: 'length',
          baseUnit: 'm',
          conversionFactor: 0.01,
        },
      ],
      ['m', { symbol: 'm', name: 'meter', category: 'length' }],
      [
        'km',
        {
          symbol: 'km',
          name: 'kilometer',
          category: 'length',
          baseUnit: 'm',
          conversionFactor: 1000,
        },
      ],
      [
        'in',
        {
          symbol: 'in',
          name: 'inch',
          category: 'length',
          baseUnit: 'm',
          conversionFactor: 0.0254,
        },
      ],
      [
        'ft',
        {
          symbol: 'ft',
          name: 'foot',
          category: 'length',
          baseUnit: 'm',
          conversionFactor: 0.3048,
        },
      ],
      [
        'yd',
        {
          symbol: 'yd',
          name: 'yard',
          category: 'length',
          baseUnit: 'm',
          conversionFactor: 0.9144,
        },
      ],
      [
        'mi',
        {
          symbol: 'mi',
          name: 'mile',
          category: 'length',
          baseUnit: 'm',
          conversionFactor: 1609.34,
        },
      ],

      // Mass units
      [
        'g',
        {
          symbol: 'g',
          name: 'gram',
          category: 'mass',
          baseUnit: 'kg',
          conversionFactor: 0.001,
        },
      ],
      ['kg', { symbol: 'kg', name: 'kilogram', category: 'mass' }],
      [
        'lb',
        {
          symbol: 'lb',
          name: 'pound',
          category: 'mass',
          baseUnit: 'kg',
          conversionFactor: 0.453592,
        },
      ],
      [
        'oz',
        {
          symbol: 'oz',
          name: 'ounce',
          category: 'mass',
          baseUnit: 'kg',
          conversionFactor: 0.0283495,
        },
      ],

      // Temperature units (require special conversion functions)
      [
        'C',
        {
          symbol: '°C',
          name: 'Celsius',
          category: 'temperature',
          baseUnit: 'K',
          conversionFunction: c => c + 273.15,
          inverseFunction: k => k - 273.15,
        },
      ],
      [
        'F',
        {
          symbol: '°F',
          name: 'Fahrenheit',
          category: 'temperature',
          baseUnit: 'K',
          conversionFunction: f => ((f - 32) * 5) / 9 + 273.15,
          inverseFunction: k => ((k - 273.15) * 9) / 5 + 32,
        },
      ],
      ['K', { symbol: 'K', name: 'Kelvin', category: 'temperature' }],

      // Volume units
      [
        'mL',
        {
          symbol: 'mL',
          name: 'milliliter',
          category: 'volume',
          baseUnit: 'L',
          conversionFactor: 0.001,
        },
      ],
      ['L', { symbol: 'L', name: 'liter', category: 'volume' }],
      [
        'gal',
        {
          symbol: 'gal',
          name: 'gallon',
          category: 'volume',
          baseUnit: 'L',
          conversionFactor: 3.78541,
        },
      ],

      // Pressure units
      ['Pa', { symbol: 'Pa', name: 'Pascal', category: 'pressure' }],
      [
        'kPa',
        {
          symbol: 'kPa',
          name: 'kilopascal',
          category: 'pressure',
          baseUnit: 'Pa',
          conversionFactor: 1000,
        },
      ],
      [
        'bar',
        {
          symbol: 'bar',
          name: 'bar',
          category: 'pressure',
          baseUnit: 'Pa',
          conversionFactor: 100000,
        },
      ],
      [
        'psi',
        {
          symbol: 'psi',
          name: 'pounds per square inch',
          category: 'pressure',
          baseUnit: 'Pa',
          conversionFactor: 6895,
        },
      ],
    ]
  );

  private constructor(data: MeasurementData) {
    super(data);
  }

  // ✅ FOCUS: Factory methods with validation
  static create(
    value: number,
    unit: string,
    precision?: number,
    metadata?: MeasurementMetadata
  ): Measurement {
    const unitDef = Measurement.UNIT_REGISTRY.get(unit);
    if (!unitDef) {
      throw new Error(`Unsupported unit: ${unit}`);
    }

    const data: MeasurementData = {
      value,
      unit,
      precision: precision ?? Measurement.getDefaultPrecision(value),
      metadata,
    };

    const validation = Measurement.validate(data);
    if (!validation.isValid) {
      throw new Error(`Invalid measurement: ${validation.errors.join(', ')}`);
    }

    return new Measurement(data);
  }

  // ✅ FOCUS: Factory with environmental context
  static createWithEnvironment(
    value: number,
    unit: string,
    environment: EnvironmentData,
    operator?: string,
    instrument?: string
  ): Measurement {
    const metadata: MeasurementMetadata = {
      measurementDate: new Date(),
      instrument,
      operator,
      environment,
      uncertainty: Measurement.calculateEnvironmentalUncertainty(
        environment,
        unit
      ),
    };

    return Measurement.create(value, unit, undefined, metadata);
  }

  // ✅ FOCUS: Comprehensive validation
  static validate(data: MeasurementData): ValueObjectValidationResult {
    const results: ValueObjectValidationResult[] = [];

    // Required field validation
    results.push(validateRequired(data.value, 'measurement value'));
    results.push(validateRequired(data.unit, 'measurement unit'));

    // Numeric validation
    if (typeof data.value !== 'number' || isNaN(data.value)) {
      results.push(
        createFailureResult(['Measurement value must be a valid number'])
      );
    }

    // Unit validation
    const unitDef = Measurement.UNIT_REGISTRY.get(data.unit);
    if (!unitDef) {
      results.push(createFailureResult([`Unsupported unit: ${data.unit}`]));
    }

    // Precision validation
    if (data.precision !== undefined) {
      results.push(validateNumericRange(data.precision, 0, 10, 'precision'));
    }

    // Physical constraints validation
    if (unitDef) {
      const physicalValidation = Measurement.validatePhysicalConstraints(
        data.value,
        unitDef
      );
      results.push(physicalValidation);
    }

    return combineValidationResults(...results);
  }

  // ✅ FOCUS: Unit conversion operations
  convertTo(targetUnit: string): UnitConversionResult {
    const sourceUnitDef = Measurement.UNIT_REGISTRY.get(this.data.unit);
    const targetUnitDef = Measurement.UNIT_REGISTRY.get(targetUnit);

    if (!sourceUnitDef || !targetUnitDef) {
      throw new Error('Invalid unit for conversion');
    }

    if (sourceUnitDef.category !== targetUnitDef.category) {
      throw new Error(
        `Cannot convert ${sourceUnitDef.category} to ${targetUnitDef.category}`
      );
    }

    // If same unit, no conversion needed
    if (this.data.unit === targetUnit) {
      return {
        originalValue: this.data,
        convertedValue: this.data,
        conversionFactor: 1,
        accuracy: 1,
      };
    }

    let convertedValue: number;
    let conversionFactor: number;
    let accuracy: number = 0.999; // Default high accuracy

    // Handle temperature conversions (special case)
    if (sourceUnitDef.category === 'temperature') {
      convertedValue = this.convertTemperature(
        this.data.value,
        this.data.unit,
        targetUnit
      );
      conversionFactor = this.calculateTemperatureConversionFactor(
        this.data.unit,
        targetUnit
      );
      accuracy = 0.999;
    } else {
      // Standard linear conversions
      const baseValue = this.convertToBase(this.data.value, sourceUnitDef);
      convertedValue = this.convertFromBase(baseValue, targetUnitDef);

      const sourceToBase = sourceUnitDef.conversionFactor || 1;
      const baseToTarget = 1 / (targetUnitDef.conversionFactor || 1);
      conversionFactor = sourceToBase * baseToTarget;

      // Calculate accuracy based on precision loss
      accuracy = Math.min(0.999, 1 - Math.abs(conversionFactor - 1) * 0.001);
    }

    // Apply precision to converted value
    const targetPrecision =
      this.data.precision ?? Measurement.getDefaultPrecision(convertedValue);
    const roundedValue = Number(convertedValue.toFixed(targetPrecision));

    const convertedMeasurement = Measurement.create(
      roundedValue,
      targetUnit,
      targetPrecision,
      this.data.metadata
    );

    return {
      originalValue: this.data,
      convertedValue: convertedMeasurement.data,
      conversionFactor,
      accuracy,
    };
  }

  // ✅ FOCUS: Arithmetic operations with unit checking
  add(other: Measurement): Measurement {
    this.ensureCompatibleUnits(other);

    const newValue = this.data.value + other.data.value;
    const resultPrecision = Math.max(
      this.data.precision || 0,
      other.data.precision || 0
    );

    return Measurement.create(
      Number(newValue.toFixed(resultPrecision)),
      this.data.unit,
      resultPrecision,
      this.combineMetadata(other)
    );
  }

  subtract(other: Measurement): Measurement {
    this.ensureCompatibleUnits(other);

    const newValue = this.data.value - other.data.value;
    const resultPrecision = Math.max(
      this.data.precision || 0,
      other.data.precision || 0
    );

    return Measurement.create(
      Number(newValue.toFixed(resultPrecision)),
      this.data.unit,
      resultPrecision,
      this.combineMetadata(other)
    );
  }

  multiply(factor: number): Measurement {
    const newValue = this.data.value * factor;
    const newPrecision =
      this.data.precision ?? Measurement.getDefaultPrecision(newValue);

    return Measurement.create(
      Number(newValue.toFixed(newPrecision)),
      this.data.unit,
      newPrecision,
      this.data.metadata
    );
  }

  divide(divisor: number): Measurement {
    if (divisor === 0) {
      throw new Error('Cannot divide measurement by zero');
    }

    const newValue = this.data.value / divisor;
    const newPrecision =
      this.data.precision ?? Measurement.getDefaultPrecision(newValue);

    return Measurement.create(
      Number(newValue.toFixed(newPrecision)),
      this.data.unit,
      newPrecision,
      this.data.metadata
    );
  }

  // ✅ FOCUS: Comparison operations
  isEqualTo(other: Measurement, tolerance?: number): boolean {
    if (this.data.unit !== other.data.unit) {
      // Try conversion for comparison
      try {
        const converted = other.convertTo(this.data.unit);
        return this.isEqualTo(
          Measurement.create(converted.convertedValue.value, this.data.unit),
          tolerance
        );
      } catch {
        return false;
      }
    }

    const actualTolerance = tolerance ?? this.calculateTolerance(other);
    return Math.abs(this.data.value - other.data.value) <= actualTolerance;
  }

  isGreaterThan(other: Measurement): boolean {
    this.ensureCompatibleUnits(other);
    return this.data.value > other.data.value;
  }

  isLessThan(other: Measurement): boolean {
    this.ensureCompatibleUnits(other);
    return this.data.value < other.data.value;
  }

  // ✅ FOCUS: Range and validation methods
  isWithinRange(min: Measurement, max: Measurement): boolean {
    return this.isGreaterThan(min) && this.isLessThan(max);
  }

  isWithinTolerance(target: Measurement, tolerancePercent: number): boolean {
    this.ensureCompatibleUnits(target);

    const tolerance = Math.abs((target.data.value * tolerancePercent) / 100);
    return Math.abs(this.data.value - target.data.value) <= tolerance;
  }

  getPercentageDifference(other: Measurement): number {
    this.ensureCompatibleUnits(other);

    if (other.data.value === 0) {
      throw new Error('Cannot calculate percentage difference with zero value');
    }

    return ((this.data.value - other.data.value) / other.data.value) * 100;
  }

  // ✅ FOCUS: Statistical and analytical methods
  static calculateAverage(measurements: Measurement[]): Measurement {
    if (measurements.length === 0) {
      throw new Error('Cannot calculate average of empty measurement array');
    }

    const firstUnit = measurements[0].data.unit;
    const convertedValues = measurements.map(m => {
      if (m.data.unit === firstUnit) {
        return m.data.value;
      } else {
        const conversion = m.convertTo(firstUnit);
        return conversion.convertedValue.value;
      }
    });

    const average =
      convertedValues.reduce((sum, value) => sum + value, 0) /
      convertedValues.length;
    const maxPrecision = Math.max(
      ...measurements.map(m => m.data.precision || 0)
    );

    return Measurement.create(
      Number(average.toFixed(maxPrecision)),
      firstUnit,
      maxPrecision
    );
  }

  static calculateStandardDeviation(measurements: Measurement[]): number {
    if (measurements.length < 2) {
      throw new Error('Need at least 2 measurements for standard deviation');
    }

    const average = Measurement.calculateAverage(measurements);
    const firstUnit = measurements[0].data.unit;

    const squaredDifferences = measurements.map(m => {
      const convertedValue =
        m.data.unit === firstUnit
          ? m.data.value
          : m.convertTo(firstUnit).convertedValue.value;

      return Math.pow(convertedValue - average.data.value, 2);
    });

    const variance =
      squaredDifferences.reduce((sum, diff) => sum + diff, 0) /
      (measurements.length - 1);
    return Math.sqrt(variance);
  }

  // ✅ FOCUS: Quality and uncertainty analysis
  getQualityAssessment(): {
    qualityLevel: 'excellent' | 'good' | 'acceptable' | 'poor';
    factors: string[];
    recommendations: string[];
  } {
    const factors: string[] = [];
    const recommendations: string[] = [];
    let qualityScore = 100;

    // Check precision
    const precision = this.data.precision ?? 0;
    if (precision < 2) {
      qualityScore -= 20;
      factors.push('Low measurement precision');
      recommendations.push('Increase measurement precision');
    }

    // Check environmental conditions (if available)
    if (this.data.metadata?.environment) {
      const env = this.data.metadata.environment;

      // Temperature stability
      if (Math.abs(env.temperature - 20) > 10) {
        // Assuming 20°C is optimal
        qualityScore -= 15;
        factors.push('Non-optimal temperature conditions');
        recommendations.push('Control environmental temperature');
      }

      // Humidity impact
      if (env.humidity > 80 || env.humidity < 30) {
        qualityScore -= 10;
        factors.push('Non-optimal humidity levels');
        recommendations.push('Control environmental humidity');
      }

      // Pressure impact (for pressure-sensitive measurements)
      if (env.pressure && this.data.unit.includes('Pa')) {
        if (Math.abs(env.pressure - 101325) > 5000) {
          // Standard atmospheric pressure
          qualityScore -= 10;
          factors.push('Non-standard atmospheric pressure');
        }
      }
    }

    // Check uncertainty
    if (
      this.data.metadata?.uncertainty &&
      this.data.metadata.uncertainty > 0.1
    ) {
      qualityScore -= 25;
      factors.push('High measurement uncertainty');
      recommendations.push('Improve measurement methodology');
    }

    // Check if instrument is specified
    if (!this.data.metadata?.instrument) {
      qualityScore -= 5;
      factors.push('Instrument not specified');
      recommendations.push('Document measurement instrument');
    }

    // Determine quality level
    let qualityLevel: 'excellent' | 'good' | 'acceptable' | 'poor';
    if (qualityScore >= 90) qualityLevel = 'excellent';
    else if (qualityScore >= 75) qualityLevel = 'good';
    else if (qualityScore >= 60) qualityLevel = 'acceptable';
    else qualityLevel = 'poor';

    return { qualityLevel, factors, recommendations };
  }

  // ✅ FOCUS: Display and formatting
  toString(): string {
    const unitDef = Measurement.UNIT_REGISTRY.get(this.data.unit);
    const symbol = unitDef?.symbol || this.data.unit;
    const precision =
      this.data.precision ?? Measurement.getDefaultPrecision(this.data.value);

    return `${this.data.value.toFixed(precision)} ${symbol}`;
  }

  toScientificNotation(): string {
    const unitDef = Measurement.UNIT_REGISTRY.get(this.data.unit);
    const symbol = unitDef?.symbol || this.data.unit;
    return `${this.data.value.toExponential()} ${symbol}`;
  }

  toDetailedString(): string {
    const basic = this.toString();
    const details: string[] = [];

    if (this.data.metadata?.measurementDate) {
      details.push(
        `measured ${this.data.metadata.measurementDate.toLocaleDateString()}`
      );
    }

    if (this.data.metadata?.instrument) {
      details.push(`using ${this.data.metadata.instrument}`);
    }

    if (this.data.metadata?.uncertainty) {
      details.push(`±${(this.data.metadata.uncertainty * 100).toFixed(1)}%`);
    }

    return details.length > 0 ? `${basic} (${details.join(', ')})` : basic;
  }

  // ✅ FOCUS: Getters
  get value(): number {
    return this.data.value;
  }
  get unit(): string {
    return this.data.unit;
  }
  get precision(): number {
    return (
      this.data.precision ?? Measurement.getDefaultPrecision(this.data.value)
    );
  }
  get metadata(): MeasurementMetadata | undefined {
    return this.data.metadata;
  }
  get unitCategory(): MeasurementCategory | undefined {
    return Measurement.UNIT_REGISTRY.get(this.data.unit)?.category;
  }

  // Private helper methods
  private convertToBase(value: number, unitDef: MeasurementUnit): number {
    if (unitDef.conversionFunction) {
      return unitDef.conversionFunction(value);
    }
    return value * (unitDef.conversionFactor || 1);
  }

  private convertFromBase(baseValue: number, unitDef: MeasurementUnit): number {
    if (unitDef.inverseFunction) {
      return unitDef.inverseFunction(baseValue);
    }
    return baseValue / (unitDef.conversionFactor || 1);
  }

  private convertTemperature(
    value: number,
    fromUnit: string,
    toUnit: string
  ): number {
    // Convert to Kelvin first
    let kelvin: number;

    switch (fromUnit) {
      case 'C':
        kelvin = value + 273.15;
        break;
      case 'F':
        kelvin = ((value - 32) * 5) / 9 + 273.15;
        break;
      case 'K':
        kelvin = value;
        break;
      default:
        throw new Error(`Unknown temperature unit: ${fromUnit}`);
    }

    // Convert from Kelvin to target
    switch (toUnit) {
      case 'C':
        return kelvin - 273.15;
      case 'F':
        return ((kelvin - 273.15) * 9) / 5 + 32;
      case 'K':
        return kelvin;
      default:
        throw new Error(`Unknown temperature unit: ${toUnit}`);
    }
  }

  private calculateTemperatureConversionFactor(
    fromUnit: string,
    toUnit: string
  ): number {
    // Temperature conversions are non-linear, so this is approximate
    if (fromUnit === toUnit) return 1;
    if (
      (fromUnit === 'C' && toUnit === 'K') ||
      (fromUnit === 'K' && toUnit === 'C')
    )
      return 1;
    if (fromUnit === 'C' && toUnit === 'F') return 1.8;
    if (fromUnit === 'F' && toUnit === 'C') return 0.556;
    return 1; // Approximate
  }

  private ensureCompatibleUnits(other: Measurement): void {
    const thisCategory = this.unitCategory;
    const otherCategory = other.unitCategory;

    if (thisCategory !== otherCategory) {
      throw new Error(`Cannot compare ${thisCategory} with ${otherCategory}`);
    }
  }

  private calculateTolerance(other: Measurement): number {
    const thisPrecision =
      this.data.precision ?? Measurement.getDefaultPrecision(this.data.value);
    const otherPrecision =
      other.data.precision ?? Measurement.getDefaultPrecision(other.data.value);

    // Use the less precise measurement to determine tolerance
    const minPrecision = Math.min(thisPrecision, otherPrecision);
    return Math.pow(10, -minPrecision);
  }

  private combineMetadata(other: Measurement): MeasurementMetadata | undefined {
    if (!this.data.metadata && !other.data.metadata) return undefined;

    return {
      measurementDate: new Date(),
      instrument: 'calculated',
      operator: 'system',
      environment: this.data.metadata?.environment,
      uncertainty: Math.max(
        this.data.metadata?.uncertainty || 0,
        other.data.metadata?.uncertainty || 0
      ),
    };
  }

  // Static helper methods
  private static getDefaultPrecision(value: number): number {
    if (value === 0) return 1;
    if (Math.abs(value) >= 1000) return 0;
    if (Math.abs(value) >= 100) return 1;
    if (Math.abs(value) >= 10) return 2;
    if (Math.abs(value) >= 1) return 3;
    return 4;
  }

  private static validatePhysicalConstraints(
    value: number,
    unitDef: MeasurementUnit
  ): ValueObjectValidationResult {
    const errors: string[] = [];

    // Temperature absolute zero constraints
    if (unitDef.category === 'temperature') {
      if (unitDef.symbol === 'K' && value < 0) {
        errors.push('Kelvin temperature cannot be negative');
      } else if (unitDef.symbol === '°C' && value < -273.15) {
        errors.push('Celsius temperature cannot be below absolute zero');
      } else if (unitDef.symbol === '°F' && value < -459.67) {
        errors.push('Fahrenheit temperature cannot be below absolute zero');
      }
    }

    // Length constraints (no negative lengths)
    if (unitDef.category === 'length' && value < 0) {
      errors.push('Length measurements cannot be negative');
    }

    // Mass constraints
    if (unitDef.category === 'mass' && value < 0) {
      errors.push('Mass measurements cannot be negative');
    }

    return errors.length > 0
      ? createFailureResult(errors)
      : createSuccessResult();
  }

  private static calculateEnvironmentalUncertainty(
    environment: EnvironmentData,
    unit: string
  ): number {
    let uncertainty = 0.001; // Base uncertainty

    // Temperature impact on measurement uncertainty
    const tempDeviation = Math.abs(environment.temperature - 20); // 20°C as reference
    uncertainty += tempDeviation * 0.0005;

    // Humidity impact
    const optimalHumidity = 50;
    const humidityDeviation = Math.abs(environment.humidity - optimalHumidity);
    uncertainty += humidityDeviation * 0.0002;

    // Pressure impact (mainly for pressure measurements)
    if (unit.includes('Pa') && environment.pressure) {
      const pressureDeviation = Math.abs(environment.pressure - 101325); // Standard pressure
      uncertainty += (pressureDeviation / 101325) * 0.01;
    }

    return Math.min(uncertainty, 0.1); // Cap at 10% uncertainty
  }

  // ✅ FOCUS: Value object equality implementation
  protected isEqualTo(other: Measurement): boolean {
    return (
      this.data.value === other.data.value &&
      this.data.unit === other.data.unit &&
      this.data.precision === other.data.precision
    );
  }
}
```

## Usage Examples

```typescript
// basic-measurement-usage.ts
import { Measurement } from './measurement';

// ✅ Creating measurements
const length1 = Measurement.create(100, 'cm', 1);
const length2 = Measurement.create(1, 'm', 2);

console.log(length1.toString()); // "100.0 cm"
console.log(length2.toString()); // "1.00 m"

// ✅ Unit conversions
const conversion = length1.convertTo('m');
console.log(
  `${length1} = ${conversion.convertedValue.value} ${conversion.convertedValue.unit}`
);
// "100.0 cm = 1.00 m"
console.log(`Conversion accuracy: ${(conversion.accuracy * 100).toFixed(1)}%`);

// ✅ Temperature conversions (special case)
const tempC = Measurement.create(25, 'C');
const tempF = tempC.convertTo('F');
const tempK = tempC.convertTo('K');

console.log(`${tempC} = ${tempF.convertedValue.value.toFixed(1)} °F`); // "25.0 °C = 77.0 °F"
console.log(`${tempC} = ${tempK.convertedValue.value.toFixed(1)} K`); // "25.0 °C = 298.1 K"

// ✅ Arithmetic operations
const totalLength = length1.add(length2.convertTo('cm').convertedValue);
console.log(`Total length: ${totalLength}`); // Adds in same units

const scaledLength = length1.multiply(2.5);
console.log(`Scaled length: ${scaledLength}`);

// ✅ Comparisons
console.log(`Equal lengths: ${length1.isEqualTo(length2)}`); // true (after conversion)
console.log(
  `Length1 > 50cm: ${length1.isGreaterThan(Measurement.create(50, 'cm'))}`
); // true

// ✅ Measurements with environmental context
const labTemp = { temperature: 22, humidity: 45, pressure: 101300 };
const precisionMeasurement = Measurement.createWithEnvironment(
  15.273,
  'mm',
  labTemp,
  'John Smith',
  'Digital Caliper Pro'
);

console.log(precisionMeasurement.toDetailedString());
// "15.273 mm (measured 1/21/2025, using Digital Caliper Pro, ±0.2%)"

const quality = precisionMeasurement.getQualityAssessment();
console.log(`Quality level: ${quality.qualityLevel}`);
console.log(`Recommendations: ${quality.recommendations.join(', ')}`);
```

## Advanced Measurement Operations

```typescript
// advanced-measurement-operations.ts
import { Measurement } from './measurement';

// ✅ Quality control system
class QualityControlSystem {
  private toleranceMap: Map<string, number> = new Map([
    ['critical', 0.5], // ±0.5%
    ['important', 1.0], // ±1.0%
    ['standard', 2.0], // ±2.0%
    ['rough', 5.0], // ±5.0%
  ]);

  validateMeasurement(
    measured: Measurement,
    specification: Measurement,
    toleranceLevel: 'critical' | 'important' | 'standard' | 'rough' = 'standard'
  ): {
    passes: boolean;
    deviation: number;
    deviationPercent: number;
    tolerance: number;
    recommendations: string[];
  } {
    const tolerance = this.toleranceMap.get(toleranceLevel)!;
    const deviation = Math.abs(measured.getPercentageDifference(specification));
    const passes = deviation <= tolerance;

    const recommendations: string[] = [];
    if (!passes) {
      recommendations.push('Measurement outside tolerance');
      recommendations.push('Check calibration');
      recommendations.push('Verify measurement procedure');
    }

    const quality = measured.getQualityAssessment();
    if (quality.qualityLevel === 'poor') {
      recommendations.push('Improve measurement conditions');
    }

    return {
      passes,
      deviation: measured.getPercentageDifference(specification),
      deviationPercent: deviation,
      tolerance,
      recommendations,
    };
  }

  processControlChart(
    measurements: Measurement[],
    target: Measurement
  ): {
    average: Measurement;
    standardDeviation: number;
    controlLimits: { upper: Measurement; lower: Measurement };
    outOfControl: Measurement[];
    trending: 'up' | 'down' | 'stable';
  } {
    const average = Measurement.calculateAverage(measurements);
    const stdDev = Measurement.calculateStandardDeviation(measurements);

    // Calculate control limits (±3 sigma)
    const upperLimit = average.add(
      Measurement.create(3 * stdDev, average.unit)
    );
    const lowerLimit = average.subtract(
      Measurement.create(3 * stdDev, average.unit)
    );

    // Find out-of-control points
    const outOfControl = measurements.filter(
      m => m.isGreaterThan(upperLimit) || m.isLessThan(lowerLimit)
    );

    // Determine trend (simplified)
    const firstHalf = measurements.slice(
      0,
      Math.floor(measurements.length / 2)
    );
    const secondHalf = measurements.slice(Math.floor(measurements.length / 2));

    const firstAvg = Measurement.calculateAverage(firstHalf);
    const secondAvg = Measurement.calculateAverage(secondHalf);

    let trending: 'up' | 'down' | 'stable' = 'stable';
    const trendThreshold = 2; // 2% change considered trending

    const trendPercent = Math.abs(secondAvg.getPercentageDifference(firstAvg));
    if (trendPercent > trendThreshold) {
      trending = secondAvg.isGreaterThan(firstAvg) ? 'up' : 'down';
    }

    return {
      average,
      standardDeviation: stdDev,
      controlLimits: { upper: upperLimit, lower: lowerLimit },
      outOfControl,
      trending,
    };
  }
}

// ✅ Measurement data analysis
class MeasurementAnalyzer {
  static analyzeMeasurementSet(
    measurements: Measurement[],
    title: string = 'Measurement Analysis'
  ): {
    summary: {
      count: number;
      average: Measurement;
      min: Measurement;
      max: Measurement;
      range: Measurement;
      standardDeviation: number;
      coefficientOfVariation: number;
    };
    quality: {
      overallQuality: 'excellent' | 'good' | 'acceptable' | 'poor';
      qualityDistribution: Map<string, number>;
      commonIssues: string[];
    };
    recommendations: string[];
  } {
    if (measurements.length === 0) {
      throw new Error('No measurements to analyze');
    }

    // Basic statistics
    const average = Measurement.calculateAverage(measurements);
    const stdDev = Measurement.calculateStandardDeviation(measurements);
    const coeffVar = (stdDev / average.value) * 100;

    // Find min and max
    let min = measurements[0];
    let max = measurements[0];

    measurements.forEach(m => {
      if (m.isLessThan(min)) min = m;
      if (m.isGreaterThan(max)) max = m;
    });

    const range = max.subtract(min);

    // Quality analysis
    const qualityDistribution = new Map<string, number>();
    const commonIssues = new Set<string>();

    measurements.forEach(m => {
      const quality = m.getQualityAssessment();
      const current = qualityDistribution.get(quality.qualityLevel) || 0;
      qualityDistribution.set(quality.qualityLevel, current + 1);

      quality.factors.forEach(factor => commonIssues.add(factor));
    });

    // Overall quality
    const excellentCount = qualityDistribution.get('excellent') || 0;
    const goodCount = qualityDistribution.get('good') || 0;
    const totalCount = measurements.length;

    let overallQuality: 'excellent' | 'good' | 'acceptable' | 'poor';
    const highQualityPercent = (excellentCount + goodCount) / totalCount;

    if (highQualityPercent >= 0.9) overallQuality = 'excellent';
    else if (highQualityPercent >= 0.7) overallQuality = 'good';
    else if (highQualityPercent >= 0.5) overallQuality = 'acceptable';
    else overallQuality = 'poor';

    // Recommendations
    const recommendations: string[] = [];

    if (coeffVar > 10) {
      recommendations.push(
        'High variability detected - check measurement consistency'
      );
    }

    if (overallQuality === 'poor') {
      recommendations.push('Improve measurement conditions and procedures');
    }

    if (commonIssues.has('Non-optimal temperature conditions')) {
      recommendations.push(
        'Implement temperature control in measurement environment'
      );
    }

    return {
      summary: {
        count: measurements.length,
        average,
        min,
        max,
        range,
        standardDeviation: stdDev,
        coefficientOfVariation: coeffVar,
      },
      quality: {
        overallQuality,
        qualityDistribution,
        commonIssues: Array.from(commonIssues),
      },
      recommendations,
    };
  }
}

// Usage examples
const qc = new QualityControlSystem();

// Quality control validation
const specification = Measurement.create(100.0, 'mm', 3);
const measured = Measurement.create(99.8, 'mm', 3);

const validation = qc.validateMeasurement(measured, specification, 'critical');
console.log(`QC Result: ${validation.passes ? 'PASS' : 'FAIL'}`);
console.log(
  `Deviation: ${validation.deviationPercent.toFixed(2)}% (tolerance: ±${validation.tolerance}%)`
);

// Process control analysis
const processData = [
  Measurement.create(99.9, 'mm'),
  Measurement.create(100.1, 'mm'),
  Measurement.create(99.8, 'mm'),
  Measurement.create(100.2, 'mm'),
  Measurement.create(99.7, 'mm'),
  Measurement.create(100.0, 'mm'),
  Measurement.create(100.3, 'mm'),
  Measurement.create(99.9, 'mm'),
];

const controlChart = qc.processControlChart(processData, specification);
console.log(`Process average: ${controlChart.average}`);
console.log(
  `Control limits: ${controlChart.controlLimits.lower} to ${controlChart.controlLimits.upper}`
);
console.log(`Trending: ${controlChart.trending}`);
console.log(`Out of control points: ${controlChart.outOfControl.length}`);

// Comprehensive measurement analysis
const analysis = MeasurementAnalyzer.analyzeMeasurementSet(
  processData,
  'Production Quality Check'
);
console.log(`\nMeasurement Analysis:`);
console.log(`- Count: ${analysis.summary.count}`);
console.log(`- Average: ${analysis.summary.average}`);
console.log(`- Range: ${analysis.summary.range}`);
console.log(`- Std Dev: ${analysis.summary.standardDeviation.toFixed(3)}`);
console.log(`- CV: ${analysis.summary.coefficientOfVariation.toFixed(1)}%`);
console.log(`- Overall Quality: ${analysis.quality.overallQuality}`);
console.log(`- Recommendations: ${analysis.recommendations.join('; ')}`);
```

## Key Features

- **Comprehensive Unit System**: Support for length, mass, temperature, volume,
  pressure, and more
- **Intelligent Conversions**: Automatic unit conversion with accuracy tracking
- **Environmental Context**: Measurement metadata with environmental conditions
- **Quality Assessment**: Automated quality analysis with recommendations
- **Statistical Operations**: Average, standard deviation, and control chart
  analysis
- **Precision Handling**: Automatic precision calculation and propagation
- **Physical Constraints**: Validation against physical laws (e.g., absolute
  zero)
- **Scientific Notation**: Multiple display formats including scientific
  notation

## Common Pitfalls

- **Unit Category Mixing**: Ensure operations are performed on compatible units
- **Temperature Conversions**: Remember that temperature conversions are
  non-linear
- **Precision Loss**: Be aware of precision degradation in conversion chains
- **Environmental Factors**: Consider environmental impact on measurement
  accuracy
- **Physical Constraints**: Validate measurements against physical laws

## Related Examples

- [Date Range Value Object](./example-1.md) - Range-based calculations and
  validation
- [Money Value Object](../basic/example-1.md) - Precision handling patterns
