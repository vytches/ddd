# Address Value Object - Basic Example

**Version**: 2025-01-21 **Package**: @vytches-ddd/value-objects  
**Complexity**: Basic **Domain**: Geographic & Location **Patterns**: Value
Object, Composite Data, Geographic Coordinates **Dependencies**:
@vytches-ddd/value-objects, @vytches-ddd/domain-primitives

## Description

This example demonstrates creating an **Address** value object that encapsulates
physical addresses with validation, formatting, and geographic coordinates.
Shows composite value object patterns including multi-field validation,
formatted display, and coordinate integration.

## Business Context

Address is a fundamental value object in shipping, logistics, user profiles, and
location-based services. It ensures address consistency, provides standardized
formatting, and enables geographic calculations. Essential for e-commerce
shipping, service delivery, and location-aware applications.

## Code Example

```typescript
// address.ts
import { ValueObject } from '@vytches-ddd/value-objects';
import {
  AddressData,
  GeographicCoordinates,
  AddressValidationResult,
  ValueObjectValidationResult,
} from './types';
import {
  validateRequired,
  validateStringLength,
  formatAddress,
  createSuccessResult,
  createFailureResult,
  combineValidationResults,
} from '../shared';

export class Address extends ValueObject<AddressData> {
  private constructor(data: AddressData) {
    super(data);
  }

  // ✅ FOCUS: Factory method with validation
  static create(
    street: string,
    city: string,
    state: string,
    postalCode: string,
    country: string,
    apartment?: string,
    coordinates?: GeographicCoordinates
  ): Address {
    const data: AddressData = {
      street: street.trim(),
      city: city.trim(),
      state: state.trim(),
      postalCode: postalCode.trim().replace(/\s+/g, '').toUpperCase(),
      country: country.trim().toUpperCase(),
      apartment: apartment?.trim(),
      coordinates,
    };

    const validation = Address.validate(data);
    if (!validation.isValid) {
      throw new Error(`Invalid address: ${validation.errors.join(', ')}`);
    }

    return new Address(data);
  }

  // ✅ FOCUS: Factory with coordinates
  static createWithCoordinates(
    street: string,
    city: string,
    state: string,
    postalCode: string,
    country: string,
    latitude: number,
    longitude: number,
    apartment?: string,
    altitude?: number,
    accuracy?: number
  ): Address {
    const coordinates: GeographicCoordinates = {
      latitude,
      longitude,
      altitude,
      accuracy,
    };

    return Address.create(
      street,
      city,
      state,
      postalCode,
      country,
      apartment,
      coordinates
    );
  }

  // ✅ FOCUS: Comprehensive validation
  static validate(data: AddressData): ValueObjectValidationResult {
    const results: ValueObjectValidationResult[] = [];

    // Required field validations
    results.push(validateRequired(data.street, 'street'));
    results.push(validateRequired(data.city, 'city'));
    results.push(validateRequired(data.state, 'state'));
    results.push(validateRequired(data.postalCode, 'postal code'));
    results.push(validateRequired(data.country, 'country'));

    // Length validations
    results.push(validateStringLength(data.street, 1, 100, 'street'));
    results.push(validateStringLength(data.city, 1, 50, 'city'));
    results.push(validateStringLength(data.state, 1, 50, 'state'));
    results.push(validateStringLength(data.postalCode, 1, 20, 'postal code'));
    results.push(validateStringLength(data.country, 2, 3, 'country'));

    // Apartment validation (optional)
    if (data.apartment) {
      results.push(validateStringLength(data.apartment, 1, 20, 'apartment'));
    }

    // Country code validation
    if (!Address.isValidCountryCode(data.country)) {
      results.push(
        createFailureResult([`Invalid country code: ${data.country}`])
      );
    }

    // Postal code format validation
    const postalValidation = Address.validatePostalCode(
      data.postalCode,
      data.country
    );
    if (!postalValidation.isValid) {
      results.push(postalValidation);
    }

    // Coordinates validation (optional)
    if (data.coordinates) {
      const coordValidation = Address.validateCoordinates(data.coordinates);
      results.push(coordValidation);
    }

    return combineValidationResults(...results);
  }

  // ✅ FOCUS: Update methods returning new instances
  withApartment(apartment: string): Address {
    return new Address({
      ...this.data,
      apartment: apartment.trim(),
    });
  }

  withCoordinates(coordinates: GeographicCoordinates): Address {
    const validation = Address.validateCoordinates(coordinates);
    if (!validation.isValid) {
      throw new Error(`Invalid coordinates: ${validation.errors.join(', ')}`);
    }

    return new Address({
      ...this.data,
      coordinates,
    });
  }

  withoutApartment(): Address {
    return new Address({
      ...this.data,
      apartment: undefined,
    });
  }

  withoutCoordinates(): Address {
    return new Address({
      ...this.data,
      coordinates: undefined,
    });
  }

  // ✅ FOCUS: Geographic operations
  distanceTo(other: Address): number | null {
    if (!this.hasCoordinates() || !other.hasCoordinates()) {
      return null;
    }

    const coord1 = this.data.coordinates!;
    const coord2 = other.data.coordinates!;

    return Address.calculateDistance(coord1, coord2);
  }

  isWithinRadius(center: Address, radiusKm: number): boolean | null {
    const distance = this.distanceTo(center);
    return distance !== null ? distance <= radiusKm : null;
  }

  getBoundingBox(radiusKm: number): {
    northEast: GeographicCoordinates;
    southWest: GeographicCoordinates;
  } | null {
    if (!this.hasCoordinates()) {
      return null;
    }

    const coords = this.data.coordinates!;
    const lat = coords.latitude;
    const lng = coords.longitude;

    // Rough approximation - 1 degree ≈ 111 km
    const latOffset = radiusKm / 111;
    const lngOffset = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));

    return {
      northEast: {
        latitude: lat + latOffset,
        longitude: lng + lngOffset,
      },
      southWest: {
        latitude: lat - latOffset,
        longitude: lng - lngOffset,
      },
    };
  }

  // ✅ FOCUS: Address comparison and matching
  isSameCity(other: Address): boolean {
    return (
      this.data.city.toLowerCase() === other.data.city.toLowerCase() &&
      this.data.state.toLowerCase() === other.data.state.toLowerCase() &&
      this.data.country === other.data.country
    );
  }

  isSameRegion(other: Address): boolean {
    return (
      this.data.state.toLowerCase() === other.data.state.toLowerCase() &&
      this.data.country === other.data.country
    );
  }

  isSameCountry(other: Address): boolean {
    return this.data.country === other.data.country;
  }

  // ✅ FOCUS: Display and formatting
  toString(): string {
    return formatAddress(
      this.data.street,
      this.data.city,
      this.data.state,
      this.data.postalCode,
      this.data.country,
      this.data.apartment
    );
  }

  toOneLine(): string {
    const parts = [this.data.street];

    if (this.data.apartment) {
      parts[0] += `, ${this.data.apartment}`;
    }

    parts.push(this.data.city);
    parts.push(`${this.data.state} ${this.data.postalCode}`);

    if (this.data.country !== 'US') {
      parts.push(this.data.country);
    }

    return parts.join(', ');
  }

  toShippingLabel(): string {
    const lines = [];

    if (this.data.apartment) {
      lines.push(`${this.data.street}, ${this.data.apartment}`);
    } else {
      lines.push(this.data.street);
    }

    lines.push(`${this.data.city}, ${this.data.state} ${this.data.postalCode}`);

    if (this.data.country !== 'US') {
      lines.push(this.data.country);
    }

    return lines.join('\n');
  }

  toGoogleMapsUrl(): string {
    const addressString = encodeURIComponent(this.toOneLine());
    return `https://www.google.com/maps/search/?api=1&query=${addressString}`;
  }

  // ✅ FOCUS: Getters and utility methods
  get street(): string {
    return this.data.street;
  }

  get city(): string {
    return this.data.city;
  }

  get state(): string {
    return this.data.state;
  }

  get postalCode(): string {
    return this.data.postalCode;
  }

  get country(): string {
    return this.data.country;
  }

  get apartment(): string | undefined {
    return this.data.apartment;
  }

  get coordinates(): GeographicCoordinates | undefined {
    return this.data.coordinates;
  }

  hasApartment(): boolean {
    return Boolean(this.data.apartment);
  }

  hasCoordinates(): boolean {
    return Boolean(this.data.coordinates);
  }

  isUSAddress(): boolean {
    return this.data.country === 'US';
  }

  isInternationalAddress(): boolean {
    return this.data.country !== 'US';
  }

  // Private static validation methods
  private static isValidCountryCode(code: string): boolean {
    const validCodes = [
      'US',
      'CA',
      'GB',
      'DE',
      'FR',
      'AU',
      'JP',
      'CN',
      'IN',
      'BR',
    ];
    return validCodes.includes(code);
  }

  private static validatePostalCode(
    postalCode: string,
    country: string
  ): ValueObjectValidationResult {
    const patterns = {
      US: /^\d{5}(-\d{4})?$/,
      CA: /^[A-Z]\d[A-Z]\s*\d[A-Z]\d$/,
      GB: /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/,
      DE: /^\d{5}$/,
      FR: /^\d{5}$/,
      AU: /^\d{4}$/,
      JP: /^\d{3}-\d{4}$/,
    };

    const pattern = patterns[country as keyof typeof patterns];
    if (!pattern) {
      return createSuccessResult(); // Allow any format for unsupported countries
    }

    if (!pattern.test(postalCode)) {
      return createFailureResult([`Invalid postal code format for ${country}`]);
    }

    return createSuccessResult();
  }

  private static validateCoordinates(
    coords: GeographicCoordinates
  ): ValueObjectValidationResult {
    const errors: string[] = [];

    if (coords.latitude < -90 || coords.latitude > 90) {
      errors.push('Latitude must be between -90 and 90 degrees');
    }

    if (coords.longitude < -180 || coords.longitude > 180) {
      errors.push('Longitude must be between -180 and 180 degrees');
    }

    if (coords.altitude !== undefined && coords.altitude < -500) {
      errors.push('Altitude cannot be less than -500 meters');
    }

    if (coords.accuracy !== undefined && coords.accuracy < 0) {
      errors.push('Accuracy cannot be negative');
    }

    return errors.length > 0
      ? createFailureResult(errors)
      : createSuccessResult();
  }

  private static calculateDistance(
    coord1: GeographicCoordinates,
    coord2: GeographicCoordinates
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
    const dLon = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((coord1.latitude * Math.PI) / 180) *
        Math.cos((coord2.latitude * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // ✅ FOCUS: Value object equality implementation
  protected isEqualTo(other: Address): boolean {
    return (
      this.data.street === other.data.street &&
      this.data.city === other.data.city &&
      this.data.state === other.data.state &&
      this.data.postalCode === other.data.postalCode &&
      this.data.country === other.data.country &&
      this.data.apartment === other.data.apartment &&
      this.coordinatesEqual(this.data.coordinates, other.data.coordinates)
    );
  }

  private coordinatesEqual(
    coord1: GeographicCoordinates | undefined,
    coord2: GeographicCoordinates | undefined
  ): boolean {
    if (!coord1 && !coord2) return true;
    if (!coord1 || !coord2) return false;

    return (
      coord1.latitude === coord2.latitude &&
      coord1.longitude === coord2.longitude &&
      coord1.altitude === coord2.altitude &&
      coord1.accuracy === coord2.accuracy
    );
  }
}
```

## Usage Examples

```typescript
// basic-address-usage.ts
import { Address } from './address';

// ✅ Creating address instances
const homeAddress = Address.create(
  '123 Main Street',
  'Springfield',
  'IL',
  '62701',
  'US'
);

const workAddress = Address.create(
  '456 Business Ave',
  'Chicago',
  'IL',
  '60601',
  'US',
  'Suite 200' // Apartment/Suite
);

console.log(homeAddress.toString());
// 123 Main Street
// Springfield, IL 62701

console.log(workAddress.toOneLine());
// "456 Business Ave, Suite 200, Chicago, IL 60601"

// ✅ International addresses
const londonAddress = Address.create(
  '10 Downing Street',
  'London',
  'England',
  'SW1A 2AA',
  'GB'
);

console.log(londonAddress.toString());
// 10 Downing Street
// London, England SW1A 2AA
// GB

// ✅ Adding coordinates
const addressWithCoords = Address.createWithCoordinates(
  '1 Apple Park Way',
  'Cupertino',
  'CA',
  '95014',
  'US',
  37.3347, // latitude
  -122.009 // longitude
);

console.log(addressWithCoords.hasCoordinates()); // true

// ✅ Address modifications
let customerAddress = Address.create(
  '789 Customer Lane',
  'Austin',
  'TX',
  '73301',
  'US'
);

// Add apartment later
customerAddress = customerAddress.withApartment('Apt 5B');
console.log(customerAddress.hasApartment()); // true

// Remove apartment
customerAddress = customerAddress.withoutApartment();
console.log(customerAddress.hasApartment()); // false
```

## Geographic Operations

```typescript
// geographic-operations.ts
import { Address } from './address';

// ✅ Create addresses with coordinates
const officeA = Address.createWithCoordinates(
  '100 Tech Street',
  'San Francisco',
  'CA',
  '94105',
  'US',
  37.7849, // SF coordinates
  -122.4094
);

const officeB = Address.createWithCoordinates(
  '200 Innovation Blvd',
  'Palo Alto',
  'CA',
  '94301',
  'US',
  37.4419, // Palo Alto coordinates
  -122.143
);

// ✅ Calculate distance
const distance = officeA.distanceTo(officeB);
console.log(`Distance: ${distance?.toFixed(2)} km`); // "Distance: 42.68 km"

// ✅ Check if within radius
const isNearby = officeB.isWithinRadius(officeA, 50); // 50km radius
console.log(`Office B is within 50km of Office A: ${isNearby}`); // true

// ✅ Get bounding box for search area
const searchArea = officeA.getBoundingBox(10); // 10km radius
if (searchArea) {
  console.log('Search area:');
  console.log(
    `NE: ${searchArea.northEast.latitude}, ${searchArea.northEast.longitude}`
  );
  console.log(
    `SW: ${searchArea.southWest.latitude}, ${searchArea.southWest.longitude}`
  );
}

// ✅ Address comparison
const sameCity = officeA.isSameCity(officeB); // true (both in CA, US)
const sameRegion = officeA.isSameRegion(officeB); // true (both in CA)
const sameCountry = officeA.isSameCountry(officeB); // true (both in US)

console.log(`Same city: ${sameCity}`); // false (SF vs Palo Alto)
console.log(`Same region: ${sameRegion}`); // true
console.log(`Same country: ${sameCountry}`); // true
```

## Shipping and Display Examples

```typescript
// shipping-address-examples.ts
import { Address } from './address';

// ✅ Shipping addresses
const shipTo = Address.create(
  '1600 Amphitheatre Parkway',
  'Mountain View',
  'CA',
  '94043',
  'US'
);

console.log('Shipping Label:');
console.log(shipTo.toShippingLabel());
// 1600 Amphitheatre Parkway
// Mountain View, CA 94043

console.log('\nGoogle Maps URL:');
console.log(shipTo.toGoogleMapsUrl());
// https://www.google.com/maps/search/?api=1&query=1600%20Amphitheatre%20Parkway%2C%20Mountain%20View%2C%20CA%2094043

// ✅ International shipping
const internationalAddress = Address.create(
  'Champs-Élysées',
  'Paris',
  'Île-de-France',
  '75008',
  'FR'
);

console.log('\nInternational Shipping Label:');
console.log(internationalAddress.toShippingLabel());
// Champs-Élysées
// Paris, Île-de-France 75008
// FR

// ✅ Address collection for delivery route
class DeliveryRoute {
  private addresses: Address[] = [];

  addStop(address: Address): void {
    this.addresses.push(address);
  }

  getRouteDistance(): number | null {
    if (this.addresses.length < 2) return null;

    let totalDistance = 0;
    for (let i = 0; i < this.addresses.length - 1; i++) {
      const distance = this.addresses[i].distanceTo(this.addresses[i + 1]);
      if (distance === null) return null; // Missing coordinates
      totalDistance += distance;
    }

    return totalDistance;
  }

  getAddressesByRegion(): Map<string, Address[]> {
    const regions = new Map<string, Address[]>();

    this.addresses.forEach(addr => {
      const region = `${addr.state}, ${addr.country}`;
      if (!regions.has(region)) {
        regions.set(region, []);
      }
      regions.get(region)!.push(addr);
    });

    return regions;
  }
}

// Usage
const route = new DeliveryRoute();
route.addStop(officeA);
route.addStop(officeB);

const totalDistance = route.getRouteDistance();
console.log(`Total route distance: ${totalDistance?.toFixed(2)} km`);

const regionBreakdown = route.getAddressesByRegion();
regionBreakdown.forEach((addresses, region) => {
  console.log(`${region}: ${addresses.length} stops`);
});
```

## Key Features

- **Composite Structure**: Handles multiple address components with validation
- **Geographic Integration**: Supports coordinates and distance calculations
- **Flexible Formatting**: Multiple display formats for different use cases
- **International Support**: Handles different country postal code formats
- **Immutability**: All modifications return new Address instances
- **Validation**: Comprehensive validation for all address components
- **Comparison Methods**: City, region, and country-level comparisons

## Common Pitfalls

- **Postal Code Formats**: Different countries have different postal code
  patterns
- **Coordinate Precision**: Be aware of GPS accuracy limitations
- **Address Normalization**: Ensure consistent formatting and casing
- **International Addresses**: Handle varying address component orders
- **Validation Rules**: Balance strictness with real-world address variety

## Related Examples

- [Money Value Object](./example-1.md) - Numeric value object with validation
- [Email Value Object](./example-2.md) - String-based value object with format
  validation
