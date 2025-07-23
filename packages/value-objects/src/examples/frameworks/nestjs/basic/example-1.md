# Basic Value Objects - NestJS Manual Setup

**Version**: 2025-01-21
**Package**: @vytches-ddd/value-objects  
**Complexity**: Basic
**Framework**: NestJS
**Focus**: Manual value object integration with standard NestJS patterns
**Base Example**: [Money Value Object](../../../basic/example-1.md)

## Service Implementation

```typescript
// money.service.ts
import { Injectable } from '@nestjs/common';
import { Money } from '@vytches-ddd/value-objects';
import { 
  CreateMoneyDto, 
  MoneyResponse, 
  CurrencyConversionDto 
} from './types'; // From your application

@Injectable()
export class MoneyService {
  private readonly supportedCurrencies = ['USD', 'EUR', 'GBP', 'JPY'];

  // ✅ FOCUS: Create money with validation
  createMoney(dto: CreateMoneyDto): MoneyResponse {
    try {
      const money = Money.create(dto.amount, dto.currency);
      
      return {
        success: true,
        data: {
          amount: money.amount,
          currency: money.currency,
          formatted: money.toString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create money'
      };
    }
  }

  // ✅ FOCUS: Money operations
  addMoney(money1Dto: CreateMoneyDto, money2Dto: CreateMoneyDto): MoneyResponse {
    try {
      const money1 = Money.create(money1Dto.amount, money1Dto.currency);
      const money2 = Money.create(money2Dto.amount, money2Dto.currency);
      
      const result = money1.add(money2);
      
      return {
        success: true,
        data: {
          amount: result.amount,
          currency: result.currency,
          formatted: result.toString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add money'
      };
    }
  }

  // ✅ FOCUS: Validation helper
  validateCurrency(currency: string): boolean {
    return this.supportedCurrencies.includes(currency.toUpperCase());
  }

  // ✅ FOCUS: Money formatting
  formatMoney(dto: CreateMoneyDto, locale?: string): string {
    try {
      const money = Money.create(dto.amount, dto.currency);
      
      if (locale) {
        return money.toLocaleString(locale);
      }
      
      return money.toString();
    } catch (error) {
      throw new Error(`Failed to format money: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ✅ FOCUS: Get supported currencies
  getSupportedCurrencies(): string[] {
    return [...this.supportedCurrencies];
  }

  // ✅ FOCUS: Money comparison
  compareMoney(money1Dto: CreateMoneyDto, money2Dto: CreateMoneyDto): {
    isEqual: boolean;
    isGreater: boolean;
    isLess: boolean;
  } {
    try {
      const money1 = Money.create(money1Dto.amount, money1Dto.currency);
      const money2 = Money.create(money2Dto.amount, money2Dto.currency);
      
      return {
        isEqual: money1.equals(money2),
        isGreater: money1.isGreaterThan(money2),
        isLess: money1.isLessThan(money2)
      };
    } catch (error) {
      throw new Error(`Failed to compare money: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
```

## Controller Integration

```typescript
// money.controller.ts
import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { MoneyService } from './money.service';
import { CreateMoneyDto, CurrencyConversionDto } from './types'; // From your application

@Controller('money')
export class MoneyController {
  constructor(private readonly moneyService: MoneyService) {}

  @Post('create')
  createMoney(@Body() dto: CreateMoneyDto) {
    return this.moneyService.createMoney(dto);
  }

  @Post('add')
  addMoney(@Body() body: { money1: CreateMoneyDto; money2: CreateMoneyDto }) {
    return this.moneyService.addMoney(body.money1, body.money2);
  }

  @Post('compare')
  compareMoney(@Body() body: { money1: CreateMoneyDto; money2: CreateMoneyDto }) {
    return this.moneyService.compareMoney(body.money1, body.money2);
  }

  @Get('currencies')
  getSupportedCurrencies() {
    return {
      currencies: this.moneyService.getSupportedCurrencies()
    };
  }

  @Get('format')
  formatMoney(
    @Query('amount') amount: number,
    @Query('currency') currency: string,
    @Query('locale') locale?: string
  ) {
    return {
      formatted: this.moneyService.formatMoney({ amount, currency }, locale)
    };
  }
}
```

## Module Configuration

```typescript
// money.module.ts
import { Module } from '@nestjs/common';
import { MoneyController } from './money.controller';
import { MoneyService } from './money.service';

@Module({
  controllers: [MoneyController],
  providers: [MoneyService],
  exports: [MoneyService], // Export for use in other modules
})
export class MoneyModule {}
```

## Email Service Example

```typescript
// email.service.ts
import { Injectable } from '@nestjs/common';
import { Email } from '@vytches-ddd/value-objects';
import { CreateEmailDto, EmailResponse } from './types'; // From your application

@Injectable()
export class EmailService {
  // ✅ FOCUS: Email creation and validation
  createEmail(dto: CreateEmailDto): EmailResponse {
    try {
      const email = Email.create(dto.address, dto.config);
      
      return {
        success: true,
        data: {
          address: email.address,
          domain: email.domain,
          localPart: email.localPart,
          isValid: email.isValid()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create email'
      };
    }
  }

  // ✅ FOCUS: Email validation
  validateEmail(address: string): boolean {
    try {
      const email = Email.create(address);
      return email.isValid();
    } catch (error) {
      return false;
    }
  }

  // ✅ FOCUS: Email normalization
  normalizeEmail(address: string): string {
    try {
      const email = Email.create(address);
      return email.normalize().toString();
    } catch (error) {
      throw new Error(`Failed to normalize email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ✅ FOCUS: Bulk email validation
  validateBulkEmails(addresses: string[]): Array<{
    address: string;
    isValid: boolean;
    normalizedAddress?: string;
    error?: string;
  }> {
    return addresses.map(address => {
      try {
        const email = Email.create(address);
        return {
          address,
          isValid: true,
          normalizedAddress: email.normalize().toString()
        };
      } catch (error) {
        return {
          address,
          isValid: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });
  }
}
```

## Address Service Example

```typescript
// address.service.ts
import { Injectable } from '@nestjs/common';
import { Address } from '@vytches-ddd/value-objects';
import { CreateAddressDto, AddressResponse } from './types'; // From your application

@Injectable()
export class AddressService {
  // ✅ FOCUS: Address creation with validation
  createAddress(dto: CreateAddressDto): AddressResponse {
    try {
      const address = Address.create(
        dto.street,
        dto.city,
        dto.state,
        dto.postalCode,
        dto.country,
        dto.coordinates
      );
      
      return {
        success: true,
        data: {
          street: address.street,
          city: address.city,
          state: address.state,
          postalCode: address.postalCode,
          country: address.country,
          formatted: address.getFormattedAddress()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create address'
      };
    }
  }

  // ✅ FOCUS: Address formatting
  formatAddress(dto: CreateAddressDto, format: 'us' | 'international' = 'us'): string {
    try {
      const address = Address.create(
        dto.street,
        dto.city,
        dto.state,
        dto.postalCode,
        dto.country
      );
      
      return address.getFormattedAddress(format);
    } catch (error) {
      throw new Error(`Failed to format address: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ✅ FOCUS: Distance calculation between addresses
  calculateDistance(
    address1Dto: CreateAddressDto,
    address2Dto: CreateAddressDto,
    unit: 'km' | 'miles' = 'km'
  ): number | null {
    try {
      const address1 = Address.create(
        address1Dto.street,
        address1Dto.city,
        address1Dto.state,
        address1Dto.postalCode,
        address1Dto.country,
        address1Dto.coordinates
      );
      
      const address2 = Address.create(
        address2Dto.street,
        address2Dto.city,
        address2Dto.state,
        address2Dto.postalCode,
        address2Dto.country,
        address2Dto.coordinates
      );
      
      return address1.distanceTo(address2, unit);
    } catch (error) {
      throw new Error(`Failed to calculate distance: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // ✅ FOCUS: Address validation
  validateAddress(dto: CreateAddressDto): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    
    try {
      Address.create(
        dto.street,
        dto.city,
        dto.state,
        dto.postalCode,
        dto.country,
        dto.coordinates
      );
      
      return { isValid: true, errors: [] };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown validation error');
      return { isValid: false, errors };
    }
  }
}
```

## Application Module Integration

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { MoneyModule } from './money/money.module';
import { EmailModule } from './email/email.module';
import { AddressModule } from './address/address.module';

@Module({
  imports: [
    MoneyModule,
    EmailModule,
    AddressModule,
  ],
})
export class AppModule {}
```

## Usage Examples

```typescript
// Example usage in another service
@Injectable()
export class OrderService {
  constructor(
    private readonly moneyService: MoneyService,
    private readonly addressService: AddressService,
    private readonly emailService: EmailService
  ) {}

  async processOrder(orderDto: CreateOrderDto) {
    // Validate customer email
    const isValidEmail = this.emailService.validateEmail(orderDto.customerEmail);
    if (!isValidEmail) {
      throw new Error('Invalid customer email');
    }

    // Create order total
    const totalResponse = this.moneyService.createMoney({
      amount: orderDto.totalAmount,
      currency: orderDto.currency
    });

    if (!totalResponse.success) {
      throw new Error(totalResponse.error);
    }

    // Validate shipping address
    const addressValidation = this.addressService.validateAddress(orderDto.shippingAddress);
    if (!addressValidation.isValid) {
      throw new Error(`Invalid shipping address: ${addressValidation.errors.join(', ')}`);
    }

    return {
      orderId: 'order-123',
      total: totalResponse.data,
      customerEmail: orderDto.customerEmail,
      shippingAddress: orderDto.shippingAddress
    };
  }
}
```

## Key Points

- **Standard NestJS Patterns**: Uses familiar NestJS decorators and dependency injection
- **Manual Value Object Creation**: Direct instantiation of value objects in services
- **Error Handling**: Proper try/catch blocks with meaningful error messages
- **Type Safety**: Leverages TypeScript for compile-time safety
- **Service Layer**: Business logic encapsulated in dedicated service classes
- **Simple Integration**: Minimal setup required, works with existing NestJS applications

## Benefits

- **Easy to Understand**: Straightforward implementation using standard patterns
- **Quick Setup**: No additional configuration or dependencies required
- **Full Control**: Complete control over value object lifecycle and error handling
- **Framework Familiarity**: Follows standard NestJS conventions developers know