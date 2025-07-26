# Basic Value Objects - NestJS DI Integration

**Version**: 2025-01-21 **Package**: @vytches/ddd-value-objects  
**Complexity**: Basic **Framework**: NestJS **Focus**: @vytches/ddd-di
integration with enhanced service management **Base Example**:
[Money Value Object](../../../basic/example-1.md)

## Service Implementation

```typescript
// money.service.ts
import { Injectable } from '@nestjs/common';
import { VytchesDDD } from '@vytches/ddd-di';
import { CreateMoneyDto, MoneyResponse, CurrencyConversionDto } from './types'; // From your application

@Injectable()
export class MoneyService {
  private readonly moneyFactory: MoneyFactory;
  private readonly currencyService: CurrencyService;
  private readonly validationService: ValidationService;

  constructor() {
    // ⭐ FOCUS: @vytches/ddd-di integration for enhanced capabilities
    this.moneyFactory = VytchesDDD.resolve<MoneyFactory>('moneyFactory');
    this.currencyService =
      VytchesDDD.resolve<CurrencyService>('currencyService');
    this.validationService =
      VytchesDDD.resolve<ValidationService>('validationService');
  }

  // ✅ FOCUS: Enhanced money creation with DI services
  async createMoney(dto: CreateMoneyDto): Promise<MoneyResponse> {
    try {
      // Validate currency through DI service
      const isValidCurrency = await this.currencyService.isSupported(
        dto.currency
      );
      if (!isValidCurrency) {
        return {
          success: false,
          error: `Unsupported currency: ${dto.currency}`,
        };
      }

      // Create money using factory from DI
      const money = this.moneyFactory.create(dto.amount, dto.currency);

      return {
        success: true,
        data: {
          amount: money.amount,
          currency: money.currency,
          formatted: money.toString(),
          exchangeRate: await this.currencyService.getExchangeRate(
            dto.currency,
            'USD'
          ),
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to create money',
      };
    }
  }

  // ✅ FOCUS: Advanced money operations with validation
  async addMoney(
    money1Dto: CreateMoneyDto,
    money2Dto: CreateMoneyDto
  ): Promise<MoneyResponse> {
    try {
      // Validate both amounts
      const validation1 = await this.validationService.validateMoney(money1Dto);
      const validation2 = await this.validationService.validateMoney(money2Dto);

      if (!validation1.isValid || !validation2.isValid) {
        return {
          success: false,
          error: 'Invalid money values provided',
        };
      }

      const money1 = this.moneyFactory.create(
        money1Dto.amount,
        money1Dto.currency
      );
      const money2 = this.moneyFactory.create(
        money2Dto.amount,
        money2Dto.currency
      );

      // Use currency conversion if currencies differ
      const result =
        money1.currency === money2.currency
          ? money1.add(money2)
          : await this.addWithConversion(money1, money2);

      return {
        success: true,
        data: {
          amount: result.amount,
          currency: result.currency,
          formatted: result.toString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add money',
      };
    }
  }

  // ✅ FOCUS: Currency conversion with DI service
  async convertCurrency(dto: CurrencyConversionDto): Promise<MoneyResponse> {
    try {
      const money = this.moneyFactory.create(dto.amount, dto.fromCurrency);
      const exchangeRate = await this.currencyService.getExchangeRate(
        dto.fromCurrency,
        dto.toCurrency
      );

      const convertedAmount = money.amount * exchangeRate;
      const convertedMoney = this.moneyFactory.create(
        convertedAmount,
        dto.toCurrency
      );

      return {
        success: true,
        data: {
          amount: convertedMoney.amount,
          currency: convertedMoney.currency,
          formatted: convertedMoney.toString(),
          exchangeRate,
          originalAmount: money.amount,
          originalCurrency: money.currency,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Currency conversion failed',
      };
    }
  }

  // ✅ FOCUS: Enhanced formatting with localization
  async formatMoney(dto: CreateMoneyDto, locale?: string): Promise<string> {
    try {
      const money = this.moneyFactory.create(dto.amount, dto.currency);
      const localizationService = VytchesDDD.resolve<LocalizationService>(
        'localizationService'
      );

      if (locale) {
        return await localizationService.formatMoney(money, locale);
      }

      return money.toString();
    } catch (error) {
      throw new Error(
        `Failed to format money: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // ✅ FOCUS: Get supported currencies from DI service
  async getSupportedCurrencies(): Promise<string[]> {
    return await this.currencyService.getSupportedCurrencies();
  }

  // ✅ FOCUS: Advanced money comparison with tolerance
  async compareMoney(
    money1Dto: CreateMoneyDto,
    money2Dto: CreateMoneyDto,
    tolerance?: number
  ): Promise<{
    isEqual: boolean;
    isGreater: boolean;
    isLess: boolean;
    difference?: number;
  }> {
    try {
      const money1 = this.moneyFactory.create(
        money1Dto.amount,
        money1Dto.currency
      );
      const money2 = this.moneyFactory.create(
        money2Dto.amount,
        money2Dto.currency
      );

      // Convert to same currency for comparison if needed
      const normalizedMoney2 =
        money1.currency === money2.currency
          ? money2
          : await this.convertToBaseCurrency(money2);

      const comparisonService =
        VytchesDDD.resolve<ComparisonService>('comparisonService');

      return comparisonService.compareWithTolerance(
        money1,
        normalizedMoney2,
        tolerance
      );
    } catch (error) {
      throw new Error(
        `Failed to compare money: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async addWithConversion(
    money1: Money,
    money2: Money
  ): Promise<Money> {
    const exchangeRate = await this.currencyService.getExchangeRate(
      money2.currency,
      money1.currency
    );

    const convertedAmount = money2.amount * exchangeRate;
    const convertedMoney = this.moneyFactory.create(
      convertedAmount,
      money1.currency
    );

    return money1.add(convertedMoney);
  }

  private async convertToBaseCurrency(money: Money): Promise<Money> {
    const baseCurrency = 'USD'; // Could be configurable
    if (money.currency === baseCurrency) {
      return money;
    }

    const exchangeRate = await this.currencyService.getExchangeRate(
      money.currency,
      baseCurrency
    );

    const convertedAmount = money.amount * exchangeRate;
    return this.moneyFactory.create(convertedAmount, baseCurrency);
  }
}
```

## Enhanced Email Service

```typescript
// email.service.ts
import { Injectable } from '@nestjs/common';
import { VytchesDDD } from '@vytches/ddd-di';
import { CreateEmailDto, EmailResponse } from './types'; // From your application

@Injectable()
export class EmailService {
  private readonly emailFactory: EmailFactory;
  private readonly emailValidationService: EmailValidationService;
  private readonly spamDetectionService: SpamDetectionService;

  constructor() {
    // ⭐ FOCUS: Enhanced email capabilities through DI
    this.emailFactory = VytchesDDD.resolve<EmailFactory>('emailFactory');
    this.emailValidationService = VytchesDDD.resolve<EmailValidationService>(
      'emailValidationService'
    );
    this.spamDetectionService = VytchesDDD.resolve<SpamDetectionService>(
      'spamDetectionService'
    );
  }

  // ✅ FOCUS: Advanced email creation with enhanced validation
  async createEmail(dto: CreateEmailDto): Promise<EmailResponse> {
    try {
      // Pre-validation through DI service
      const validation = await this.emailValidationService.validateAdvanced(
        dto.address
      );
      if (!validation.isValid) {
        return {
          success: false,
          error: `Email validation failed: ${validation.errors.join(', ')}`,
        };
      }

      // Spam/reputation check
      const reputationCheck = await this.spamDetectionService.checkReputation(
        dto.address
      );

      const email = this.emailFactory.create(dto.address, dto.config);

      return {
        success: true,
        data: {
          address: email.address,
          domain: email.domain,
          localPart: email.localPart,
          isValid: email.isValid(),
          reputation: reputationCheck,
          deliverabilityScore: validation.deliverabilityScore,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to create email',
      };
    }
  }

  // ✅ FOCUS: Bulk email processing with DI services
  async processBulkEmails(addresses: string[]): Promise<
    Array<{
      address: string;
      isValid: boolean;
      normalizedAddress?: string;
      deliverabilityScore?: number;
      errors?: string[];
    }>
  > {
    const bulkProcessor =
      VytchesDDD.resolve<BulkEmailProcessor>('bulkEmailProcessor');

    return await bulkProcessor.processEmails(addresses, {
      validateDeliverability: true,
      checkReputation: true,
      normalizeFormat: true,
    });
  }

  // ✅ FOCUS: Enhanced email normalization
  async normalizeEmail(
    address: string,
    options?: NormalizationOptions
  ): Promise<string> {
    try {
      const email = this.emailFactory.create(address);
      const normalizationService = VytchesDDD.resolve<NormalizationService>(
        'normalizationService'
      );

      return await normalizationService.normalize(email, options);
    } catch (error) {
      throw new Error(
        `Failed to normalize email: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
```

## Address Service with Geolocation

```typescript
// address.service.ts
import { Injectable } from '@nestjs/common';
import { VytchesDDD } from '@vytches/ddd-di';
import { CreateAddressDto, AddressResponse } from './types'; // From your application

@Injectable()
export class AddressService {
  private readonly addressFactory: AddressFactory;
  private readonly geocodingService: GeocodingService;
  private readonly addressValidationService: AddressValidationService;

  constructor() {
    // ⭐ FOCUS: Enhanced address capabilities
    this.addressFactory = VytchesDDD.resolve<AddressFactory>('addressFactory');
    this.geocodingService =
      VytchesDDD.resolve<GeocodingService>('geocodingService');
    this.addressValidationService =
      VytchesDDD.resolve<AddressValidationService>('addressValidationService');
  }

  // ✅ FOCUS: Address creation with geocoding
  async createAddress(dto: CreateAddressDto): Promise<AddressResponse> {
    try {
      // Validate address format
      const validation = await this.addressValidationService.validate(dto);
      if (!validation.isValid) {
        return {
          success: false,
          error: `Address validation failed: ${validation.errors.join(', ')}`,
        };
      }

      // Geocode address if coordinates not provided
      let coordinates = dto.coordinates;
      if (!coordinates) {
        const geocodeResult = await this.geocodingService.geocode(dto);
        coordinates = geocodeResult.coordinates;
      }

      const address = this.addressFactory.create(
        dto.street,
        dto.city,
        dto.state,
        dto.postalCode,
        dto.country,
        coordinates
      );

      return {
        success: true,
        data: {
          street: address.street,
          city: address.city,
          state: address.state,
          postalCode: address.postalCode,
          country: address.country,
          coordinates: address.coordinates,
          formatted: address.getFormattedAddress(),
          timezone: validation.detectedTimezone,
          deliveryConfidence: validation.deliveryConfidence,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to create address',
      };
    }
  }

  // ✅ FOCUS: Advanced distance calculation
  async calculateOptimalRoute(
    startDto: CreateAddressDto,
    endDto: CreateAddressDto,
    waypoints?: CreateAddressDto[]
  ): Promise<{
    distance: number;
    duration: number;
    route: any[];
    optimizedOrder?: number[];
  }> {
    try {
      const routingService =
        VytchesDDD.resolve<RoutingService>('routingService');

      const startAddress = this.addressFactory.create(
        startDto.street,
        startDto.city,
        startDto.state,
        startDto.postalCode,
        startDto.country
      );

      const endAddress = this.addressFactory.create(
        endDto.street,
        endDto.city,
        endDto.state,
        endDto.postalCode,
        endDto.country
      );

      return await routingService.calculateOptimalRoute(
        startAddress,
        endAddress,
        waypoints
      );
    } catch (error) {
      throw new Error(
        `Failed to calculate route: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
```

## Module Configuration with DI Setup

```typescript
// app.module.ts
import { Module, OnModuleInit } from '@nestjs/common';
import { VytchesDDD, SimpleContainer } from '@vytches/ddd-di';
import { MoneyModule } from './money/money.module';
import { EmailModule } from './email/email.module';
import { AddressModule } from './address/address.module';

@Module({
  imports: [MoneyModule, EmailModule, AddressModule],
})
export class AppModule implements OnModuleInit {
  async onModuleInit() {
    // ⭐ CRITICAL: Initialize VytchesDDD DI before framework DI
    const container = new SimpleContainer();

    // Register enhanced services
    this.registerMoneyServices(container);
    this.registerEmailServices(container);
    this.registerAddressServices(container);

    await VytchesDDD.configure(container);
  }

  private registerMoneyServices(container: SimpleContainer) {
    // Register money-related services
    container.registerInstance('moneyFactory', new MoneyFactory());
    container.registerInstance('currencyService', new CurrencyService());
    container.registerInstance('validationService', new ValidationService());
    container.registerInstance(
      'localizationService',
      new LocalizationService()
    );
    container.registerInstance('comparisonService', new ComparisonService());
  }

  private registerEmailServices(container: SimpleContainer) {
    // Register email-related services
    container.registerInstance('emailFactory', new EmailFactory());
    container.registerInstance(
      'emailValidationService',
      new EmailValidationService()
    );
    container.registerInstance(
      'spamDetectionService',
      new SpamDetectionService()
    );
    container.registerInstance('bulkEmailProcessor', new BulkEmailProcessor());
    container.registerInstance(
      'normalizationService',
      new NormalizationService()
    );
  }

  private registerAddressServices(container: SimpleContainer) {
    // Register address-related services
    container.registerInstance('addressFactory', new AddressFactory());
    container.registerInstance('geocodingService', new GeocodingService());
    container.registerInstance(
      'addressValidationService',
      new AddressValidationService()
    );
    container.registerInstance('routingService', new RoutingService());
  }
}
```

## Usage Example

```typescript
// order.service.ts
@Injectable()
export class OrderService {
  constructor(
    private readonly moneyService: MoneyService,
    private readonly addressService: AddressService,
    private readonly emailService: EmailService
  ) {}

  async processAdvancedOrder(orderDto: CreateOrderDto) {
    // Enhanced email validation
    const emailResult = await this.emailService.createEmail({
      address: orderDto.customerEmail,
      config: { strictValidation: true },
    });

    if (!emailResult.success || emailResult.data?.deliverabilityScore < 0.7) {
      throw new Error('Customer email has low deliverability score');
    }

    // Currency conversion if needed
    let orderTotal = await this.moneyService.createMoney({
      amount: orderDto.totalAmount,
      currency: orderDto.currency,
    });

    if (orderDto.preferredCurrency !== orderDto.currency) {
      const convertedTotal = await this.moneyService.convertCurrency({
        amount: orderDto.totalAmount,
        fromCurrency: orderDto.currency,
        toCurrency: orderDto.preferredCurrency,
      });
      orderTotal = convertedTotal;
    }

    // Enhanced address validation with geocoding
    const addressResult = await this.addressService.createAddress(
      orderDto.shippingAddress
    );
    if (
      !addressResult.success ||
      addressResult.data?.deliveryConfidence < 0.8
    ) {
      throw new Error('Shipping address may not be deliverable');
    }

    return {
      orderId: 'order-123',
      total: orderTotal.data,
      customerEmail: emailResult.data,
      shippingAddress: addressResult.data,
      estimatedDelivery: this.calculateDeliveryTime(addressResult.data),
    };
  }

  private calculateDeliveryTime(address: any): Date {
    // Enhanced delivery calculation using address data
    const baseDeliveryDays = address.timezone ? 2 : 5;
    return new Date(Date.now() + baseDeliveryDays * 24 * 60 * 60 * 1000);
  }
}
```

## Key Points

- **@vytches/ddd-di Integration**: Uses service locator pattern for enhanced
  capabilities
- **Enterprise Services**: Advanced validation, geocoding, currency conversion
- **Service Composition**: Rich functionality through composed DI services
- **Enhanced Validation**: Multi-layer validation with deliverability scoring
- **Performance**: Bulk operations and optimized processing
- **Flexibility**: Configurable services and business rules

## Benefits

- **Enhanced Capabilities**: Access to advanced features through DI services
- **Centralized Services**: Shared business logic across the application
- **Testability**: Easy mocking and testing of DI services
- **Scalability**: Service composition enables complex business requirements
- **Maintainability**: Clear separation of concerns with service boundaries
