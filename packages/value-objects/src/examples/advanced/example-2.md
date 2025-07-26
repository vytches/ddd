# Color Value Object - Advanced Example

**Version**: 2025-01-21 **Package**: @vytches/ddd-value-objects  
**Complexity**: Advanced **Domain**: Design Systems & Graphics **Patterns**:
Color Representation, Format Conversion, Color Theory **Dependencies**:
@vytches/ddd-value-objects, @vytches/ddd-domain-primitives

## Description

This example demonstrates creating a **Color** value object that handles
multiple color formats (RGB, HSL, HSV, HEX), color theory calculations, and
accessibility features. Shows advanced patterns for design system value objects
with format conversions.

## Business Context

Color is essential for design systems, theming, accessibility compliance, and
brand management. It provides color format conversions, contrast calculations,
and palette generation. Critical for UI components, design tokens, and
accessibility validation.

## Code Example

```typescript
// color.ts
import { ValueObject } from '@vytches/ddd-value-objects';
import {
  ColorData,
  RGBColor,
  HSLColor,
  HSVColor,
  ColorFormat,
  ValueObjectValidationResult,
} from './types';
import {
  validateRequired,
  createSuccessResult,
  createFailureResult,
  combineValidationResults,
} from '../shared';

export class Color extends ValueObject<ColorData> {
  private constructor(data: ColorData) {
    super(data);
  }

  // ✅ FOCUS: Multiple factory methods for different formats
  static fromRGB(
    red: number,
    green: number,
    blue: number,
    alpha: number = 1
  ): Color {
    const data: ColorData = {
      red: Math.round(Math.max(0, Math.min(255, red))),
      green: Math.round(Math.max(0, Math.min(255, green))),
      blue: Math.round(Math.max(0, Math.min(255, blue))),
      alpha: Math.max(0, Math.min(1, alpha)),
    };

    const validation = Color.validate(data);
    if (!validation.isValid) {
      throw new Error(`Invalid RGB color: ${validation.errors.join(', ')}`);
    }

    return new Color(data);
  }

  static fromHex(hex: string, alpha: number = 1): Color {
    const cleanHex = hex.replace('#', '').toUpperCase();

    if (!/^[0-9A-F]{6}$/.test(cleanHex)) {
      throw new Error(`Invalid hex color format: ${hex}`);
    }

    const red = parseInt(cleanHex.substring(0, 2), 16);
    const green = parseInt(cleanHex.substring(2, 4), 16);
    const blue = parseInt(cleanHex.substring(4, 6), 16);

    return Color.fromRGB(red, green, blue, alpha);
  }

  static fromHSL(
    hue: number,
    saturation: number,
    lightness: number,
    alpha: number = 1
  ): Color {
    // Normalize values
    const h = ((hue % 360) + 360) % 360; // 0-359
    const s = Math.max(0, Math.min(100, saturation)) / 100; // 0-1
    const l = Math.max(0, Math.min(100, lightness)) / 100; // 0-1

    // Convert HSL to RGB
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;

    let r = 0,
      g = 0,
      b = 0;

    if (0 <= h && h < 60) {
      [r, g, b] = [c, x, 0];
    } else if (60 <= h && h < 120) {
      [r, g, b] = [x, c, 0];
    } else if (120 <= h && h < 180) {
      [r, g, b] = [0, c, x];
    } else if (180 <= h && h < 240) {
      [r, g, b] = [0, x, c];
    } else if (240 <= h && h < 300) {
      [r, g, b] = [x, 0, c];
    } else if (300 <= h && h < 360) {
      [r, g, b] = [c, 0, x];
    }

    return Color.fromRGB(
      Math.round((r + m) * 255),
      Math.round((g + m) * 255),
      Math.round((b + m) * 255),
      alpha
    );
  }

  // ✅ FOCUS: Named color factory
  static fromName(colorName: string): Color {
    const namedColors: Record<string, string> = {
      red: '#FF0000',
      green: '#008000',
      blue: '#0000FF',
      white: '#FFFFFF',
      black: '#000000',
      yellow: '#FFFF00',
      cyan: '#00FFFF',
      magenta: '#FF00FF',
      gray: '#808080',
      orange: '#FFA500',
      purple: '#800080',
      brown: '#A52A2A',
    };

    const hex = namedColors[colorName.toLowerCase()];
    if (!hex) {
      throw new Error(`Unknown color name: ${colorName}`);
    }

    return Color.fromHex(hex);
  }

  // ✅ FOCUS: Validation
  static validate(data: ColorData): ValueObjectValidationResult {
    const errors: string[] = [];

    // RGB values must be 0-255
    if (data.red < 0 || data.red > 255 || !Number.isInteger(data.red)) {
      errors.push('Red value must be integer between 0 and 255');
    }
    if (data.green < 0 || data.green > 255 || !Number.isInteger(data.green)) {
      errors.push('Green value must be integer between 0 and 255');
    }
    if (data.blue < 0 || data.blue > 255 || !Number.isInteger(data.blue)) {
      errors.push('Blue value must be integer between 0 and 255');
    }

    // Alpha must be 0-1
    if (data.alpha < 0 || data.alpha > 1) {
      errors.push('Alpha value must be between 0 and 1');
    }

    return errors.length > 0
      ? { isValid: false, errors }
      : { isValid: true, errors: [] };
  }

  // ✅ FOCUS: Format conversion methods
  toRGB(): RGBColor {
    return {
      red: this.data.red,
      green: this.data.green,
      blue: this.data.blue,
      alpha: this.data.alpha,
    };
  }

  toHex(includeAlpha: boolean = false): string {
    const toHex = (value: number): string => {
      const hex = Math.round(value).toString(16).padStart(2, '0');
      return hex.toUpperCase();
    };

    let hex = `#${toHex(this.data.red)}${toHex(this.data.green)}${toHex(this.data.blue)}`;

    if (includeAlpha && this.data.alpha < 1) {
      hex += toHex(this.data.alpha * 255);
    }

    return hex;
  }

  toHSL(): HSLColor {
    const r = this.data.red / 255;
    const g = this.data.green / 255;
    const b = this.data.blue / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;

    // Lightness
    const l = (max + min) / 2;

    let h = 0;
    let s = 0;

    if (diff !== 0) {
      // Saturation
      s = l > 0.5 ? diff / (2 - max - min) : diff / (max + min);

      // Hue
      switch (max) {
        case r:
          h = ((g - b) / diff + (g < b ? 6 : 0)) / 6;
          break;
        case g:
          h = ((b - r) / diff + 2) / 6;
          break;
        case b:
          h = ((r - g) / diff + 4) / 6;
          break;
      }
    }

    return {
      hue: Math.round(h * 360),
      saturation: Math.round(s * 100),
      lightness: Math.round(l * 100),
      alpha: this.data.alpha,
    };
  }

  toCSS(format: ColorFormat = 'hex'): string {
    switch (format) {
      case 'rgb':
        if (this.data.alpha === 1) {
          return `rgb(${this.data.red}, ${this.data.green}, ${this.data.blue})`;
        } else {
          return `rgba(${this.data.red}, ${this.data.green}, ${this.data.blue}, ${this.data.alpha})`;
        }

      case 'hsl':
        const hsl = this.toHSL();
        if (this.data.alpha === 1) {
          return `hsl(${hsl.hue}, ${hsl.saturation}%, ${hsl.lightness}%)`;
        } else {
          return `hsla(${hsl.hue}, ${hsl.saturation}%, ${hsl.lightness}%, ${this.data.alpha})`;
        }

      case 'hex':
      default:
        return this.toHex();
    }
  }

  // ✅ FOCUS: Color theory methods
  getLuminance(): number {
    // Relative luminance calculation for accessibility
    const toLinear = (value: number): number => {
      const normalized = value / 255;
      return normalized <= 0.03928
        ? normalized / 12.92
        : Math.pow((normalized + 0.055) / 1.055, 2.4);
    };

    const r = toLinear(this.data.red);
    const g = toLinear(this.data.green);
    const b = toLinear(this.data.blue);

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  getContrastRatio(otherColor: Color): number {
    const l1 = this.getLuminance();
    const l2 = otherColor.getLuminance();

    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);

    return (lighter + 0.05) / (darker + 0.05);
  }

  // ✅ FOCUS: Accessibility methods
  meetsWCAGContrastAA(
    backgroundColor: Color,
    isLargeText: boolean = false
  ): boolean {
    const contrast = this.getContrastRatio(backgroundColor);
    const requiredContrast = isLargeText ? 3 : 4.5;
    return contrast >= requiredContrast;
  }

  meetsWCAGContrastAAA(
    backgroundColor: Color,
    isLargeText: boolean = false
  ): boolean {
    const contrast = this.getContrastRatio(backgroundColor);
    const requiredContrast = isLargeText ? 4.5 : 7;
    return contrast >= requiredContrast;
  }

  // ✅ FOCUS: Color manipulation methods
  lighten(amount: number): Color {
    const hsl = this.toHSL();
    const newLightness = Math.min(100, hsl.lightness + amount);
    return Color.fromHSL(
      hsl.hue,
      hsl.saturation,
      newLightness,
      this.data.alpha
    );
  }

  darken(amount: number): Color {
    const hsl = this.toHSL();
    const newLightness = Math.max(0, hsl.lightness - amount);
    return Color.fromHSL(
      hsl.hue,
      hsl.saturation,
      newLightness,
      this.data.alpha
    );
  }

  saturate(amount: number): Color {
    const hsl = this.toHSL();
    const newSaturation = Math.min(100, hsl.saturation + amount);
    return Color.fromHSL(
      hsl.hue,
      newSaturation,
      hsl.lightness,
      this.data.alpha
    );
  }

  desaturate(amount: number): Color {
    const hsl = this.toHSL();
    const newSaturation = Math.max(0, hsl.saturation - amount);
    return Color.fromHSL(
      hsl.hue,
      newSaturation,
      hsl.lightness,
      this.data.alpha
    );
  }

  adjustHue(degrees: number): Color {
    const hsl = this.toHSL();
    const newHue = (hsl.hue + degrees) % 360;
    return Color.fromHSL(
      newHue,
      hsl.saturation,
      hsl.lightness,
      this.data.alpha
    );
  }

  withAlpha(alpha: number): Color {
    return Color.fromRGB(this.data.red, this.data.green, this.data.blue, alpha);
  }

  // ✅ FOCUS: Color harmony methods
  getComplementary(): Color {
    return this.adjustHue(180);
  }

  getTriadic(): [Color, Color] {
    return [this.adjustHue(120), this.adjustHue(240)];
  }

  getAnalogous(): [Color, Color] {
    return [this.adjustHue(30), this.adjustHue(-30)];
  }

  getSplitComplementary(): [Color, Color] {
    return [this.adjustHue(150), this.adjustHue(-150)];
  }

  // ✅ FOCUS: Palette generation
  generateShades(count: number = 5): Color[] {
    const shades: Color[] = [];
    const step = 80 / (count - 1); // Spread across 80% darkness range

    for (let i = 0; i < count; i++) {
      const amount = i * step;
      shades.push(this.darken(amount));
    }

    return shades;
  }

  generateTints(count: number = 5): Color[] {
    const tints: Color[] = [];
    const step = 80 / (count - 1); // Spread across 80% lightness range

    for (let i = 0; i < count; i++) {
      const amount = i * step;
      tints.push(this.lighten(amount));
    }

    return tints;
  }

  generateMonochromatic(count: number = 5): Color[] {
    const colors: Color[] = [this];
    const baseHSL = this.toHSL();

    for (let i = 1; i < count; i++) {
      // Vary lightness and saturation slightly
      const lightnessVariation = i * 15 - 30; // -30 to +45
      const saturationVariation = i * 10 - 20; // -20 to +30

      const newLightness = Math.max(
        0,
        Math.min(100, baseHSL.lightness + lightnessVariation)
      );
      const newSaturation = Math.max(
        0,
        Math.min(100, baseHSL.saturation + saturationVariation)
      );

      colors.push(
        Color.fromHSL(baseHSL.hue, newSaturation, newLightness, this.data.alpha)
      );
    }

    return colors;
  }

  // ✅ FOCUS: Color analysis
  isLight(): boolean {
    return this.getLuminance() > 0.5;
  }

  isDark(): boolean {
    return this.getLuminance() <= 0.5;
  }

  isGrayscale(): boolean {
    return (
      this.data.red === this.data.green && this.data.green === this.data.blue
    );
  }

  getDominantChannel(): 'red' | 'green' | 'blue' {
    const { red, green, blue } = this.data;

    if (red >= green && red >= blue) return 'red';
    if (green >= blue) return 'green';
    return 'blue';
  }

  // ✅ FOCUS: Display methods
  toString(): string {
    return this.toHex();
  }

  toDebugString(): string {
    const hsl = this.toHSL();
    return `Color(RGB: ${this.data.red},${this.data.green},${this.data.blue} | HSL: ${hsl.hue}°,${hsl.saturation}%,${hsl.lightness}% | Alpha: ${this.data.alpha})`;
  }

  // ✅ FOCUS: Getters
  get red(): number {
    return this.data.red;
  }
  get green(): number {
    return this.data.green;
  }
  get blue(): number {
    return this.data.blue;
  }
  get alpha(): number {
    return this.data.alpha;
  }

  // ✅ FOCUS: Value object equality
  protected isEqualTo(other: Color): boolean {
    return (
      this.data.red === other.data.red &&
      this.data.green === other.data.green &&
      this.data.blue === other.data.blue &&
      this.data.alpha === other.data.alpha
    );
  }
}
```

## Usage Examples

```typescript
// basic-color-usage.ts
import { Color } from './color';

// ✅ Creating colors in different formats
const red = Color.fromRGB(255, 0, 0);
const blue = Color.fromHex('#0000FF');
const green = Color.fromHSL(120, 100, 50);
const orange = Color.fromName('orange');

console.log(red.toHex()); // "#FF0000"
console.log(blue.toCSS('rgb')); // "rgb(0, 0, 255)"
console.log(green.toCSS('hsl')); // "hsl(120, 100%, 50%)"

// ✅ Color manipulations
const lightBlue = blue.lighten(30);
const darkRed = red.darken(20);
const fadedGreen = green.withAlpha(0.7);

console.log(lightBlue.toHex()); // Much lighter blue
console.log(fadedGreen.toCSS('hsl')); // "hsla(120, 100%, 50%, 0.7)"

// ✅ Color theory
const complementary = red.getComplementary();
const [triadic1, triadic2] = red.getTriadic();

console.log(`Red complement: ${complementary.toHex()}`); // Cyan-ish
console.log(`Red triadic: ${triadic1.toHex()}, ${triadic2.toHex()}`);

// ✅ Accessibility checking
const background = Color.fromHex('#FFFFFF');
const text = Color.fromHex('#333333');

const contrast = text.getContrastRatio(background);
const meetsAA = text.meetsWCAGContrastAA(background);

console.log(`Contrast ratio: ${contrast.toFixed(2)}`);
console.log(`Meets WCAG AA: ${meetsAA}`);

// ✅ Palette generation
const primaryColor = Color.fromHex('#3498DB');
const shades = primaryColor.generateShades(5);
const tints = primaryColor.generateTints(5);

console.log('Shades:');
shades.forEach((shade, i) => {
  console.log(`  ${i}: ${shade.toHex()}`);
});

console.log('Tints:');
tints.forEach((tint, i) => {
  console.log(`  ${i}: ${tint.toHex()}`);
});
```

## Design System Integration

```typescript
// design-system-colors.ts
import { Color } from './color';

class ColorPalette {
  private colors = new Map<string, Color>();

  // ✅ Brand color registration
  registerBrandColor(name: string, color: Color): void {
    this.colors.set(name, color);
  }

  // ✅ Automatic palette generation
  generatePalette(brandColor: Color): ColorPalette {
    const palette = new ColorPalette();

    // Primary colors
    palette.registerBrandColor('primary', brandColor);
    palette.registerBrandColor('primary-light', brandColor.lighten(20));
    palette.registerBrandColor('primary-dark', brandColor.darken(20));

    // Secondary (complementary)
    const secondary = brandColor.getComplementary();
    palette.registerBrandColor('secondary', secondary);
    palette.registerBrandColor('secondary-light', secondary.lighten(20));
    palette.registerBrandColor('secondary-dark', secondary.darken(20));

    // Accent colors (triadic)
    const [accent1, accent2] = brandColor.getTriadic();
    palette.registerBrandColor('accent-1', accent1);
    palette.registerBrandColor('accent-2', accent2);

    // Neutral colors
    const neutral = Color.fromHSL(brandColor.toHSL().hue, 10, 50);
    palette.registerBrandColor('neutral', neutral);
    palette.registerBrandColor('neutral-light', neutral.lighten(30));
    palette.registerBrandColor('neutral-dark', neutral.darken(30));

    // Semantic colors
    palette.registerBrandColor('success', Color.fromHSL(120, 60, 50));
    palette.registerBrandColor('warning', Color.fromHSL(45, 90, 60));
    palette.registerBrandColor('error', Color.fromHSL(0, 80, 55));
    palette.registerBrandColor('info', Color.fromHSL(210, 70, 55));

    return palette;
  }

  // ✅ Accessibility validation
  validatePalette(backgroundColor: Color = Color.fromHex('#FFFFFF')): {
    validColors: string[];
    invalidColors: Array<{ name: string; contrast: number; required: number }>;
  } {
    const validColors: string[] = [];
    const invalidColors: Array<{
      name: string;
      contrast: number;
      required: number;
    }> = [];

    this.colors.forEach((color, name) => {
      const contrast = color.getContrastRatio(backgroundColor);
      const requiredContrast = 4.5; // WCAG AA standard text

      if (contrast >= requiredContrast) {
        validColors.push(name);
      } else {
        invalidColors.push({
          name,
          contrast: parseFloat(contrast.toFixed(2)),
          required: requiredContrast,
        });
      }
    });

    return { validColors, invalidColors };
  }

  // ✅ Export color tokens
  toCSSVariables(): string {
    let css = ':root {\n';

    this.colors.forEach((color, name) => {
      const varName = `--color-${name.replace(/\s+/g, '-').toLowerCase()}`;
      css += `  ${varName}: ${color.toHex()};\n`;

      // Also include RGB values for alpha manipulation
      const rgb = color.toRGB();
      css += `  ${varName}-rgb: ${rgb.red}, ${rgb.green}, ${rgb.blue};\n`;
    });

    css += '}';
    return css;
  }

  toDesignTokens(): Record<string, any> {
    const tokens: Record<string, any> = {};

    this.colors.forEach((color, name) => {
      const tokenName = name.replace(/\s+/g, '-').toLowerCase();
      tokens[tokenName] = {
        value: color.toHex(),
        type: 'color',
        rgb: color.toRGB(),
        hsl: color.toHSL(),
        luminance: color.getLuminance(),
      };
    });

    return tokens;
  }

  getColor(name: string): Color | undefined {
    return this.colors.get(name);
  }

  getAllColors(): Map<string, Color> {
    return new Map(this.colors);
  }
}

// ✅ Theme builder
class ThemeBuilder {
  static createLightTheme(primaryColor: Color): ColorPalette {
    const palette = new ColorPalette();

    // Generate base palette
    const generated = palette.generatePalette(primaryColor);

    // Add theme-specific colors
    generated.registerBrandColor('background', Color.fromHex('#FFFFFF'));
    generated.registerBrandColor('surface', Color.fromHex('#F8F9FA'));
    generated.registerBrandColor('text-primary', Color.fromHex('#212529'));
    generated.registerBrandColor('text-secondary', Color.fromHex('#6C757D'));
    generated.registerBrandColor('border', Color.fromHex('#E9ECEF'));

    return generated;
  }

  static createDarkTheme(primaryColor: Color): ColorPalette {
    const palette = new ColorPalette();

    // Generate base palette (colors work in dark theme)
    const generated = palette.generatePalette(primaryColor);

    // Add dark theme-specific colors
    generated.registerBrandColor('background', Color.fromHex('#121212'));
    generated.registerBrandColor('surface', Color.fromHex('#1E1E1E'));
    generated.registerBrandColor('text-primary', Color.fromHex('#FFFFFF'));
    generated.registerBrandColor('text-secondary', Color.fromHex('#B3B3B3'));
    generated.registerBrandColor('border', Color.fromHex('#333333'));

    return generated;
  }
}

// Usage example
const brandBlue = Color.fromHex('#007BFF');

const lightTheme = ThemeBuilder.createLightTheme(brandBlue);
const darkTheme = ThemeBuilder.createDarkTheme(brandBlue);

// Validate accessibility
const lightValidation = lightTheme.validatePalette(
  lightTheme.getColor('background')!
);
console.log('Light theme validation:', lightValidation);

const darkValidation = darkTheme.validatePalette(
  darkTheme.getColor('background')!
);
console.log('Dark theme validation:', darkValidation);

// Export CSS variables
console.log('Light theme CSS:');
console.log(lightTheme.toCSSVariables());

// Export design tokens
const tokens = lightTheme.toDesignTokens();
console.log('Design tokens:', JSON.stringify(tokens, null, 2));
```

## Key Features

- **Multi-Format Support**: RGB, HSL, HSV, HEX, and named color formats
- **Color Theory**: Complementary, triadic, analogous color relationships
- **Accessibility**: WCAG contrast ratio calculations and compliance checking
- **Color Manipulation**: Lighten, darken, saturate, hue adjustments
- **Palette Generation**: Automatic shade, tint, and monochromatic palette
  creation
- **Design System Integration**: CSS variables, design tokens, theme generation

## Common Pitfalls

- **Color Space Precision**: Floating-point precision issues in conversions
- **Accessibility Assumptions**: Always test actual contrast in target
  environments
- **Color Perception**: Consider color blindness and different display devices
- **Performance**: Color calculations can be expensive for large datasets

## Related Examples

- [Money Value Object](../basic/example-1.md) - Precision handling patterns
- [Date Range](../intermediate/example-1.md) - Complex calculation methods
