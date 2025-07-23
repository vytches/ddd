# Coordinates Value Object - Advanced Example

**Version**: 2025-01-21
**Package**: @vytches-ddd/value-objects  
**Complexity**: Advanced
**Domain**: Geospatial & Location Services
**Patterns**: Geometric Calculations, Distance Functions, Spatial Operations
**Dependencies**: @vytches-ddd/value-objects, @vytches-ddd/domain-primitives

## Description

This example demonstrates creating a **Coordinates** value object for advanced geospatial applications including distance calculations, area computations, and spatial relationships. Shows advanced patterns for geographic value objects with mathematical operations.

## Business Context

Coordinates are essential for mapping services, logistics, location-based services, and geographic analysis. They provide distance calculations, boundary checks, and spatial operations. Critical for delivery routing, geofencing, and location analytics.

## Code Example

```typescript
// coordinates.ts
import { ValueObject } from '@vytches-ddd/value-objects';
import { 
  CoordinatesData, 
  BoundingBox,
  DistanceUnit,
  ValueObjectValidationResult 
} from './types';
import { 
  validateRequired, 
  createSuccessResult,
  createFailureResult,
  combineValidationResults
} from '../shared';

export class Coordinates extends ValueObject<CoordinatesData> {
  // Earth's radius in kilometers
  private static readonly EARTH_RADIUS_KM = 6371;
  private static readonly EARTH_RADIUS_MILES = 3959;

  private constructor(data: CoordinatesData) {
    super(data);
  }

  // ✅ FOCUS: Factory method with validation
  static create(
    latitude: number,
    longitude: number,
    altitude?: number,
    accuracy?: number
  ): Coordinates {
    const data: CoordinatesData = {
      latitude: parseFloat(latitude.toFixed(8)), // Precision to ~1cm
      longitude: parseFloat(longitude.toFixed(8)),
      altitude: altitude ? parseFloat(altitude.toFixed(2)) : undefined,
      accuracy: accuracy ? parseFloat(accuracy.toFixed(2)) : undefined
    };

    const validation = Coordinates.validate(data);
    if (!validation.isValid) {
      throw new Error(`Invalid coordinates: ${validation.errors.join(', ')}`);
    }

    return new Coordinates(data);
  }

  // ✅ FOCUS: Factory from string formats
  static fromString(coordString: string): Coordinates {
    // Support multiple formats: "lat,lng", "lat lng", "lat,lng,alt"
    const cleanString = coordString.trim().replace(/[()]/g, '');
    const parts = cleanString.split(/[,\s]+/).map(s => parseFloat(s));

    if (parts.length < 2 || parts.some(isNaN)) {
      throw new Error(`Invalid coordinate string format: ${coordString}`);
    }

    return Coordinates.create(
      parts[0], // latitude
      parts[1], // longitude
      parts[2], // altitude (optional)
      parts[3]  // accuracy (optional)
    );
  }

  // ✅ FOCUS: Factory from degrees/minutes/seconds
  static fromDMS(
    latDegrees: number,
    latMinutes: number,
    latSeconds: number,
    latDirection: 'N' | 'S',
    lngDegrees: number,
    lngMinutes: number,
    lngSeconds: number,
    lngDirection: 'E' | 'W'
  ): Coordinates {
    const lat = Coordinates.dmsToDecimal(latDegrees, latMinutes, latSeconds, latDirection);
    const lng = Coordinates.dmsToDecimal(lngDegrees, lngMinutes, lngSeconds, lngDirection);

    return Coordinates.create(lat, lng);
  }

  // ✅ FOCUS: Comprehensive validation
  static validate(data: CoordinatesData): ValueObjectValidationResult {
    const errors: string[] = [];

    // Latitude validation (-90 to +90)
    if (data.latitude < -90 || data.latitude > 90) {
      errors.push('Latitude must be between -90 and +90 degrees');
    }

    // Longitude validation (-180 to +180)
    if (data.longitude < -180 || data.longitude > 180) {
      errors.push('Longitude must be between -180 and +180 degrees');
    }

    // Altitude validation (reasonable limits)
    if (data.altitude !== undefined && (data.altitude < -11000 || data.altitude > 9000)) {
      errors.push('Altitude must be between -11,000m and +9,000m');
    }

    // Accuracy validation (must be positive)
    if (data.accuracy !== undefined && data.accuracy < 0) {
      errors.push('Accuracy must be a positive number');
    }

    return errors.length > 0 
      ? { isValid: false, errors }
      : { isValid: true, errors: [] };
  }

  // ✅ FOCUS: Distance calculations using Haversine formula
  distanceTo(other: Coordinates, unit: DistanceUnit = 'km'): number {
    const lat1Rad = this.toRadians(this.data.latitude);
    const lat2Rad = this.toRadians(other.data.latitude);
    const deltaLatRad = this.toRadians(other.data.latitude - this.data.latitude);
    const deltaLngRad = this.toRadians(other.data.longitude - this.data.longitude);

    const a = Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
              Math.cos(lat1Rad) * Math.cos(lat2Rad) *
              Math.sin(deltaLngRad / 2) * Math.sin(deltaLngRad / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const radius = unit === 'miles' ? Coordinates.EARTH_RADIUS_MILES : Coordinates.EARTH_RADIUS_KM;
    const distance = radius * c;

    return parseFloat(distance.toFixed(6));
  }

  // ✅ FOCUS: Bearing calculation
  bearingTo(other: Coordinates): number {
    const lat1Rad = this.toRadians(this.data.latitude);
    const lat2Rad = this.toRadians(other.data.latitude);
    const deltaLngRad = this.toRadians(other.data.longitude - this.data.longitude);

    const x = Math.sin(deltaLngRad) * Math.cos(lat2Rad);
    const y = Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
              Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(deltaLngRad);

    const bearingRad = Math.atan2(x, y);
    const bearingDeg = this.toDegrees(bearingRad);

    return (bearingDeg + 360) % 360; // Normalize to 0-360
  }

  // ✅ FOCUS: Destination point calculation
  destinationPoint(distance: number, bearing: number, unit: DistanceUnit = 'km'): Coordinates {
    const radius = unit === 'miles' ? Coordinates.EARTH_RADIUS_MILES : Coordinates.EARTH_RADIUS_KM;
    const angularDistance = distance / radius;

    const lat1Rad = this.toRadians(this.data.latitude);
    const lng1Rad = this.toRadians(this.data.longitude);
    const bearingRad = this.toRadians(bearing);

    const lat2Rad = Math.asin(
      Math.sin(lat1Rad) * Math.cos(angularDistance) +
      Math.cos(lat1Rad) * Math.sin(angularDistance) * Math.cos(bearingRad)
    );

    const lng2Rad = lng1Rad + Math.atan2(
      Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(lat1Rad),
      Math.cos(angularDistance) - Math.sin(lat1Rad) * Math.sin(lat2Rad)
    );

    const lat2 = this.toDegrees(lat2Rad);
    const lng2 = this.toDegrees(lng2Rad);

    return Coordinates.create(lat2, (lng2 + 540) % 360 - 180); // Normalize longitude
  }

  // ✅ FOCUS: Bounding box operations
  static getBoundingBox(coordinates: Coordinates[]): BoundingBox {
    if (coordinates.length === 0) {
      throw new Error('Cannot create bounding box from empty coordinates array');
    }

    let minLat = coordinates[0].data.latitude;
    let maxLat = coordinates[0].data.latitude;
    let minLng = coordinates[0].data.longitude;
    let maxLng = coordinates[0].data.longitude;

    for (const coord of coordinates) {
      minLat = Math.min(minLat, coord.data.latitude);
      maxLat = Math.max(maxLat, coord.data.latitude);
      minLng = Math.min(minLng, coord.data.longitude);
      maxLng = Math.max(maxLng, coord.data.longitude);
    }

    return {
      southWest: Coordinates.create(minLat, minLng),
      northEast: Coordinates.create(maxLat, maxLng)
    };
  }

  isWithinBoundingBox(boundingBox: BoundingBox): boolean {
    return this.data.latitude >= boundingBox.southWest.data.latitude &&
           this.data.latitude <= boundingBox.northEast.data.latitude &&
           this.data.longitude >= boundingBox.southWest.data.longitude &&
           this.data.longitude <= boundingBox.northEast.data.longitude;
  }

  // ✅ FOCUS: Circle/radius operations
  isWithinRadius(center: Coordinates, radius: number, unit: DistanceUnit = 'km'): boolean {
    const distance = this.distanceTo(center, unit);
    return distance <= radius;
  }

  getPointsWithinRadius(
    points: Coordinates[],
    radius: number,
    unit: DistanceUnit = 'km'
  ): Array<{ coordinates: Coordinates; distance: number }> {
    return points
      .map(point => ({
        coordinates: point,
        distance: this.distanceTo(point, unit)
      }))
      .filter(item => item.distance <= radius)
      .sort((a, b) => a.distance - b.distance);
  }

  // ✅ FOCUS: Polygon operations (simple polygon containment)
  isWithinPolygon(polygonVertices: Coordinates[]): boolean {
    if (polygonVertices.length < 3) {
      throw new Error('Polygon must have at least 3 vertices');
    }

    // Ray casting algorithm
    let inside = false;
    const x = this.data.longitude;
    const y = this.data.latitude;

    for (let i = 0, j = polygonVertices.length - 1; i < polygonVertices.length; j = i++) {
      const xi = polygonVertices[i].data.longitude;
      const yi = polygonVertices[i].data.latitude;
      const xj = polygonVertices[j].data.longitude;
      const yj = polygonVertices[j].data.latitude;

      if (((yi > y) !== (yj > y)) &&
          (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }

    return inside;
  }

  // ✅ FOCUS: Geographic calculations
  static getCenter(coordinates: Coordinates[]): Coordinates {
    if (coordinates.length === 0) {
      throw new Error('Cannot calculate center from empty coordinates array');
    }

    let x = 0, y = 0, z = 0;

    for (const coord of coordinates) {
      const latRad = coord.toRadians(coord.data.latitude);
      const lngRad = coord.toRadians(coord.data.longitude);

      x += Math.cos(latRad) * Math.cos(lngRad);
      y += Math.cos(latRad) * Math.sin(lngRad);
      z += Math.sin(latRad);
    }

    const total = coordinates.length;
    x = x / total;
    y = y / total;
    z = z / total;

    const centralLngRad = Math.atan2(y, x);
    const centralSquareRoot = Math.sqrt(x * x + y * y);
    const centralLatRad = Math.atan2(z, centralSquareRoot);

    return Coordinates.create(
      parseFloat(Coordinates.prototype.toDegrees(centralLatRad).toFixed(8)),
      parseFloat(Coordinates.prototype.toDegrees(centralLngRad).toFixed(8))
    );
  }

  // ✅ FOCUS: Geohashing (simplified)
  getGeohash(precision: number = 12): string {
    const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
    let lat = this.data.latitude;
    let lng = this.data.longitude;
    let latMin = -90, latMax = 90;
    let lngMin = -180, lngMax = 180;
    let geohash = '';
    let bits = 0;
    let even = true;

    while (geohash.length < precision) {
      let ch = 0;
      
      for (let i = 0; i < 5; i++) {
        if (even) {
          // Longitude
          const mid = (lngMin + lngMax) / 2;
          if (lng >= mid) {
            ch |= (1 << (4 - i));
            lngMin = mid;
          } else {
            lngMax = mid;
          }
        } else {
          // Latitude
          const mid = (latMin + latMax) / 2;
          if (lat >= mid) {
            ch |= (1 << (4 - i));
            latMin = mid;
          } else {
            latMax = mid;
          }
        }
        even = !even;
      }
      
      geohash += BASE32[ch];
    }

    return geohash;
  }

  // ✅ FOCUS: Coordinate system conversions
  toMercator(): { x: number; y: number } {
    const x = this.data.longitude * 20037508.34 / 180;
    let y = Math.log(Math.tan((90 + this.data.latitude) * Math.PI / 360)) / (Math.PI / 180);
    y = y * 20037508.34 / 180;

    return {
      x: parseFloat(x.toFixed(2)),
      y: parseFloat(y.toFixed(2))
    };
  }

  toDMS(): {
    latitude: string;
    longitude: string;
  } {
    const formatDMS = (decimal: number, isLatitude: boolean): string => {
      const abs = Math.abs(decimal);
      const degrees = Math.floor(abs);
      const minutes = Math.floor((abs - degrees) * 60);
      const seconds = ((abs - degrees) * 60 - minutes) * 60;
      
      const direction = isLatitude 
        ? (decimal >= 0 ? 'N' : 'S')
        : (decimal >= 0 ? 'E' : 'W');

      return `${degrees}°${minutes}'${seconds.toFixed(2)}"${direction}`;
    };

    return {
      latitude: formatDMS(this.data.latitude, true),
      longitude: formatDMS(this.data.longitude, false)
    };
  }

  // ✅ FOCUS: Utility methods
  normalize(): Coordinates {
    let lat = this.data.latitude;
    let lng = this.data.longitude;

    // Normalize latitude to [-90, 90]
    lat = Math.max(-90, Math.min(90, lat));

    // Normalize longitude to [-180, 180]
    lng = ((lng + 180) % 360) - 180;
    if (lng < -180) lng += 360;
    if (lng > 180) lng -= 360;

    return Coordinates.create(lat, lng, this.data.altitude, this.data.accuracy);
  }

  // ✅ FOCUS: Display methods
  toString(): string {
    let result = `${this.data.latitude.toFixed(6)}, ${this.data.longitude.toFixed(6)}`;
    
    if (this.data.altitude !== undefined) {
      result += `, ${this.data.altitude}m`;
    }
    
    return result;
  }

  toDebugString(): string {
    const mercator = this.toMercator();
    const dms = this.toDMS();
    const geohash = this.getGeohash(8);

    return `Coordinates(
  Decimal: ${this.toString()}
  DMS: ${dms.latitude} ${dms.longitude}
  Mercator: ${mercator.x}, ${mercator.y}
  Geohash: ${geohash}
  Altitude: ${this.data.altitude || 'N/A'}m
  Accuracy: ${this.data.accuracy || 'N/A'}m
)`;
  }

  // Helper methods
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private toDegrees(radians: number): number {
    return radians * (180 / Math.PI);
  }

  private static dmsToDecimal(
    degrees: number,
    minutes: number,
    seconds: number,
    direction: 'N' | 'S' | 'E' | 'W'
  ): number {
    let decimal = degrees + minutes / 60 + seconds / 3600;
    
    if (direction === 'S' || direction === 'W') {
      decimal = -decimal;
    }
    
    return decimal;
  }

  // ✅ FOCUS: Getters
  get latitude(): number { return this.data.latitude; }
  get longitude(): number { return this.data.longitude; }
  get altitude(): number | undefined { return this.data.altitude; }
  get accuracy(): number | undefined { return this.data.accuracy; }

  // ✅ FOCUS: Value object equality
  protected isEqualTo(other: Coordinates): boolean {
    return this.data.latitude === other.data.latitude &&
           this.data.longitude === other.data.longitude &&
           this.data.altitude === other.data.altitude &&
           this.data.accuracy === other.data.accuracy;
  }
}
```

## Usage Examples

```typescript
// basic-coordinates-usage.ts
import { Coordinates } from './coordinates';

// ✅ Creating coordinates
const newYork = Coordinates.create(40.7128, -74.0060);
const london = Coordinates.fromString('51.5074, -0.1278');
const paris = Coordinates.fromDMS(48, 51, 29, 'N', 2, 17, 40, 'E');

console.log(newYork.toString()); // "40.712800, -74.006000"
console.log(london.toDMS()); 
// { latitude: "51°30'26.64\"N", longitude: "0°7'40.08\"W" }

// ✅ Distance calculations
const distance = newYork.distanceTo(london, 'km');
const distanceMiles = newYork.distanceTo(london, 'miles');

console.log(`NYC to London: ${distance.toFixed(0)} km`); // ~5585 km
console.log(`NYC to London: ${distanceMiles.toFixed(0)} miles`); // ~3470 miles

// ✅ Bearing and navigation
const bearing = newYork.bearingTo(london);
console.log(`Bearing from NYC to London: ${bearing.toFixed(1)}°`); // ~51.4°

const destination = newYork.destinationPoint(100, 90, 'km'); // 100km due east
console.log(`100km east of NYC: ${destination.toString()}`);

// ✅ Geospatial operations
const coordinates = [newYork, london, paris];
const center = Coordinates.getCenter(coordinates);
console.log(`Geographic center: ${center.toString()}`);

const boundingBox = Coordinates.getBoundingBox(coordinates);
console.log(`Bounding box: ${boundingBox.southWest} to ${boundingBox.northEast}`);

// ✅ Geohashing
const geohash = newYork.getGeohash(8);
console.log(`NYC geohash: ${geohash}`); // e.g., "dr5regw3"
```

## Advanced Geospatial System

```typescript
// geospatial-service.ts
import { Coordinates } from './coordinates';

interface Location {
  id: string;
  name: string;
  coordinates: Coordinates;
  category: string;
}

class GeospatialService {
  private locations: Location[] = [];

  addLocation(location: Location): void {
    this.locations.push(location);
  }

  // ✅ Find nearby locations
  findNearby(
    center: Coordinates,
    radiusKm: number,
    category?: string,
    limit?: number
  ): Array<Location & { distance: number }> {
    let results = this.locations
      .filter(location => {
        if (category && location.category !== category) {
          return false;
        }
        return center.distanceTo(location.coordinates) <= radiusKm;
      })
      .map(location => ({
        ...location,
        distance: center.distanceTo(location.coordinates)
      }))
      .sort((a, b) => a.distance - b.distance);

    if (limit) {
      results = results.slice(0, limit);
    }

    return results;
  }

  // ✅ Find locations within polygon
  findWithinArea(polygonVertices: Coordinates[], category?: string): Location[] {
    return this.locations.filter(location => {
      if (category && location.category !== category) {
        return false;
      }
      return location.coordinates.isWithinPolygon(polygonVertices);
    });
  }

  // ✅ Route optimization (simple nearest neighbor)
  optimizeRoute(start: Coordinates, waypoints: Location[]): {
    route: Location[];
    totalDistance: number;
  } {
    if (waypoints.length === 0) {
      return { route: [], totalDistance: 0 };
    }

    const route: Location[] = [];
    let current = start;
    let remaining = [...waypoints];
    let totalDistance = 0;

    while (remaining.length > 0) {
      // Find nearest unvisited location
      let nearestIndex = 0;
      let nearestDistance = current.distanceTo(remaining[0].coordinates);

      for (let i = 1; i < remaining.length; i++) {
        const distance = current.distanceTo(remaining[i].coordinates);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = i;
        }
      }

      // Add to route
      const nearest = remaining[nearestIndex];
      route.push(nearest);
      totalDistance += nearestDistance;
      current = nearest.coordinates;

      // Remove from remaining
      remaining.splice(nearestIndex, 1);
    }

    return {
      route,
      totalDistance: parseFloat(totalDistance.toFixed(2))
    };
  }

  // ✅ Create delivery zones
  createDeliveryZones(
    hubs: Coordinates[],
    serviceRadius: number
  ): Array<{
    hub: Coordinates;
    serviceArea: Coordinates[];
    locations: Location[];
  }> {
    return hubs.map(hub => {
      // Create circular service area (simplified)
      const serviceArea: Coordinates[] = [];
      const locations = this.findNearby(hub, serviceRadius);

      // Generate circle points for visualization
      for (let angle = 0; angle < 360; angle += 30) {
        const point = hub.destinationPoint(serviceRadius, angle);
        serviceArea.push(point);
      }

      return {
        hub,
        serviceArea,
        locations: locations.map(l => ({
          id: l.id,
          name: l.name,
          coordinates: l.coordinates,
          category: l.category
        }))
      };
    });
  }

  // ✅ Geospatial clustering
  clusterByProximity(maxDistance: number): Array<{
    center: Coordinates;
    locations: Location[];
    radius: number;
  }> {
    const clusters: Array<{
      center: Coordinates;
      locations: Location[];
      radius: number;
    }> = [];
    
    const processed = new Set<string>();

    for (const location of this.locations) {
      if (processed.has(location.id)) continue;

      const cluster: Location[] = [location];
      processed.add(location.id);

      // Find all locations within max distance
      for (const other of this.locations) {
        if (processed.has(other.id)) continue;

        const distance = location.coordinates.distanceTo(other.coordinates);
        if (distance <= maxDistance) {
          cluster.push(other);
          processed.add(other.id);
        }
      }

      if (cluster.length > 0) {
        const clusterCoords = cluster.map(l => l.coordinates);
        const center = Coordinates.getCenter(clusterCoords);
        
        // Calculate cluster radius
        const distances = clusterCoords.map(c => center.distanceTo(c));
        const radius = Math.max(...distances);

        clusters.push({ center, locations: cluster, radius });
      }
    }

    return clusters;
  }
}

// Usage example
const geoService = new GeospatialService();

// Add some sample locations
geoService.addLocation({
  id: '1',
  name: 'Central Park',
  coordinates: Coordinates.create(40.7829, -73.9654),
  category: 'park'
});

geoService.addLocation({
  id: '2',
  name: 'Times Square',
  coordinates: Coordinates.create(40.7580, -73.9855),
  category: 'attraction'
});

geoService.addLocation({
  id: '3',
  name: 'Brooklyn Bridge',
  coordinates: Coordinates.create(40.7061, -73.9969),
  category: 'landmark'
});

// Find locations near Times Square
const userLocation = Coordinates.create(40.7580, -73.9855);
const nearby = geoService.findNearby(userLocation, 5, undefined, 10);

console.log(`Found ${nearby.length} locations within 5km:`);
nearby.forEach(location => {
  console.log(`- ${location.name}: ${location.distance.toFixed(2)}km away`);
});

// Optimize delivery route
const deliveryStart = Coordinates.create(40.7500, -74.0000);
const deliveryPoints = geoService.findNearby(deliveryStart, 10);
const optimizedRoute = geoService.optimizeRoute(deliveryStart, deliveryPoints);

console.log(`Optimized route covers ${optimizedRoute.totalDistance}km:`);
optimizedRoute.route.forEach((stop, i) => {
  console.log(`${i + 1}. ${stop.name}`);
});
```

## Key Features

- **Distance Calculations**: Haversine formula for accurate earth distances
- **Bearing & Navigation**: Cardinal directions and destination point calculations
- **Geospatial Operations**: Bounding boxes, polygon containment, radius queries
- **Coordinate Conversions**: DMS, Mercator projection, geohashing support
- **Advanced Analytics**: Center calculation, clustering, route optimization
- **Format Support**: Multiple input/output formats for coordinates

## Common Pitfalls

- **Earth Curvature**: Haversine formula assumes spherical earth (not perfectly accurate)
- **Datum Differences**: GPS coordinates may use different reference systems
- **Precision Limits**: Floating-point precision affects very small distances
- **Performance**: Complex polygon operations can be computationally expensive
- **Edge Cases**: Poles, dateline crossing, and extreme coordinates need special handling

## Related Examples

- [Money Value Object](../basic/example-1.md) - Precision and rounding patterns
- [Time Period](./example-1.md) - Complex calculations and business logic