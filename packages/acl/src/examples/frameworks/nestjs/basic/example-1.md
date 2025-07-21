# NestJS ACL Integration - Manual Setup

**Version**: 1.0.0  
**Package**: @vytches-ddd/acl  
**Framework**: NestJS  
**Complexity**: Basic  
**Focus**: Manual ACL integration with standard NestJS patterns

## Description

This example demonstrates basic Anti-Corruption Layer integration with NestJS using manual setup and standard dependency injection patterns, providing a clean interface to external customer management systems.

## Business Context

A NestJS e-commerce application needs to integrate with a legacy CRM system while protecting the domain model from external data structure changes and maintaining clean architecture principles.

## Code Example

```typescript
// customer-acl.service.ts - Core ACL implementation
import { Injectable } from '@nestjs/common';
import { AntiCorruptionLayer, IDataTranslator } from '@vytches-ddd/acl';
import { Result } from '@vytches-ddd/utils';
import { Customer, ExternalCustomerData } from '../types'; // From your application

// Data translator for customer conversion
export class CustomerDataTranslator implements IDataTranslator<ExternalCustomerData, Customer> {
  translate(external: ExternalCustomerData): Result<Customer, Error> {
    try {
      const customer: Customer = {
        id: external.customer_id,
        name: external.full_name,
        email: external.email_address,
        status: this.mapAccountStatus(external.account_status),
        registrationDate: new Date(external.created_timestamp * 1000),
        preferences: {
          currency: external.settings.preferred_currency,
          language: external.settings.locale,
          notifications: external.settings.email_notifications,
          marketingConsent: external.settings.marketing_opt_in
        }
      };

      return Result.success(customer);
    } catch (error) {
      return Result.failure(new Error(`Customer translation failed: ${error.message}`));
    }
  }

  private mapAccountStatus(externalStatus: string): Customer['status'] {
    switch (externalStatus.toLowerCase()) {
      case 'active':
      case 'verified':
        return 'active';
      case 'suspended':
      case 'blocked':
        return 'suspended';
      default:
        return 'inactive';
    }
  }
}

// NestJS service implementing ACL
@Injectable()
export class CustomerACLService extends AntiCorruptionLayer<ExternalCustomerData, Customer> {
  constructor(private externalCustomerAPI: ExternalCustomerAPI) {
    super(new CustomerDataTranslator());
  }

  async getCustomer(customerId: string): Promise<Result<Customer, Error>> {
    try {
      const externalData = await this.externalCustomerAPI.getCustomer(customerId);
      return this.translateData(externalData);
    } catch (error) {
      return Result.failure(new Error(`Failed to get customer: ${error.message}`));
    }
  }

  async updateCustomer(customer: Customer): Promise<Result<Customer, Error>> {
    try {
      const externalData = this.convertToExternalFormat(customer);
      const updatedData = await this.externalCustomerAPI.updateCustomer(externalData);
      return this.translateData(updatedData);
    } catch (error) {
      return Result.failure(new Error(`Failed to update customer: ${error.message}`));
    }
  }

  async syncAllCustomers(): Promise<Result<Customer[], Error>> {
    try {
      const externalCustomers = await this.externalCustomerAPI.getAllCustomers();
      const customers: Customer[] = [];
      const errors: string[] = [];

      for (const externalCustomer of externalCustomers) {
        const result = this.translateData(externalCustomer);
        if (result.isSuccess()) {
          customers.push(result.value);
        } else {
          errors.push(`Customer ${externalCustomer.customer_id}: ${result.error.message}`);
        }
      }

      if (customers.length === 0 && errors.length > 0) {
        return Result.failure(new Error(`All customers failed: ${errors.join(', ')}`));
      }

      return Result.success(customers);
    } catch (error) {
      return Result.failure(new Error(`Sync failed: ${error.message}`));
    }
  }

  private convertToExternalFormat(customer: Customer): ExternalCustomerData {
    return {
      customer_id: customer.id,
      full_name: customer.name,
      email_address: customer.email,
      account_status: customer.status,
      created_timestamp: Math.floor(customer.registrationDate.getTime() / 1000),
      settings: {
        preferred_currency: customer.preferences.currency,
        locale: customer.preferences.language,
        email_notifications: customer.preferences.notifications,
        marketing_opt_in: customer.preferences.marketingConsent
      }
    };
  }
}

// customer.controller.ts - NestJS controller
import { Controller, Get, Put, Post, Param, Body } from '@nestjs/common';
import { CustomerACLService } from './customer-acl.service';
import { UpdateCustomerDto, CustomerDto } from './dto'; // From your application

@Controller('customers')
export class CustomerController {
  constructor(private readonly customerACL: CustomerACLService) {}

  @Get(':id')
  async getCustomer(@Param('id') customerId: string) {
    const result = await this.customerACL.getCustomer(customerId);
    
    if (result.isFailure()) {
      throw new Error(result.error.message);
    }
    
    return {
      success: true,
      data: result.value
    };
  }

  @Put(':id')
  async updateCustomer(
    @Param('id') customerId: string,
    @Body() updateDto: UpdateCustomerDto
  ) {
    try {
      // Get current customer
      const currentResult = await this.customerACL.getCustomer(customerId);
      if (currentResult.isFailure()) {
        return { success: false, error: currentResult.error.message };
      }

      // Apply updates
      const updatedCustomer = {
        ...currentResult.value,
        ...updateDto
      };

      // Save through ACL
      const result = await this.customerACL.updateCustomer(updatedCustomer);
      
      return result.isSuccess()
        ? { success: true, data: result.value }
        : { success: false, error: result.error.message };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  @Post('sync')
  async syncCustomers() {
    const result = await this.customerACL.syncAllCustomers();
    
    return result.isSuccess()
      ? { success: true, data: result.value, count: result.value.length }
      : { success: false, error: result.error.message };
  }
}

// customer.module.ts - NestJS module configuration
import { Module } from '@nestjs/common';
import { CustomerController } from './customer.controller';
import { CustomerACLService } from './customer-acl.service';
import { ExternalCustomerAPI } from './external-customer.api';

@Module({
  controllers: [CustomerController],
  providers: [
    CustomerACLService,
    {
      provide: ExternalCustomerAPI,
      useFactory: () => {
        // Manual configuration of external API
        return new ExternalCustomerAPI({
          baseUrl: process.env.EXTERNAL_CRM_URL,
          apiKey: process.env.EXTERNAL_CRM_API_KEY,
          timeout: 10000
        });
      }
    }
  ],
  exports: [CustomerACLService]
})
export class CustomerModule {}

// external-customer.api.ts - External API client
import { Injectable } from '@nestjs/common';
import { ExternalCustomerData } from '../types'; // From your application

@Injectable()
export class ExternalCustomerAPI {
  constructor(private config: ExternalAPIConfig) {}

  async getCustomer(customerId: string): Promise<ExternalCustomerData> {
    const response = await fetch(
      `${this.config.baseUrl}/customers/${customerId}`,
      {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(this.config.timeout)
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get customer: ${response.statusText}`);
    }

    return response.json();
  }

  async updateCustomer(customerData: ExternalCustomerData): Promise<ExternalCustomerData> {
    const response = await fetch(
      `${this.config.baseUrl}/customers/${customerData.customer_id}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(customerData),
        signal: AbortSignal.timeout(this.config.timeout)
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to update customer: ${response.statusText}`);
    }

    return response.json();
  }

  async getAllCustomers(): Promise<ExternalCustomerData[]> {
    const response = await fetch(
      `${this.config.baseUrl}/customers`,
      {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(this.config.timeout)
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get customers: ${response.statusText}`);
    }

    const data = await response.json();
    return data.customers || [];
  }
}

// Configuration interface
interface ExternalAPIConfig {
  baseUrl: string;
  apiKey: string;
  timeout: number;
}
```

## Key Features

- **Manual Setup**: Direct instantiation without complex DI frameworks
- **Clean Integration**: Standard NestJS dependency injection patterns
- **Error Handling**: Comprehensive error management with Result pattern
- **Data Protection**: Domain model protected from external system changes

## Common Pitfalls

- **Direct Dependencies**: Avoid tight coupling to external API structures
- **Error Propagation**: Don't expose external system errors to controllers
- **Validation**: Always validate external data before translation

## Related Examples

- [Advanced NestJS Integration](/packages/acl/src/examples/frameworks/nestjs/intermediate/example-1.md)
- [Basic ACL Patterns](/packages/acl/src/examples/basic/example-1.md)