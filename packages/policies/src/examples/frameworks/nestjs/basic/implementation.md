# Basic NestJS Implementation Patterns

**Version**: 2.0.0  
**Package**: @vytches-ddd/policies  
**Complexity**: basic  
**Domain**: Framework Integration  
**Framework**: NestJS  
**Patterns**: manual-setup, service-integration, basic-validation

## Overview

Basic implementation patterns for integrating @vytches-ddd/policies with NestJS applications using manual setup and straightforward service injection. This approach provides clear, understandable policy integration suitable for most application scenarios.

## Core Implementation Concepts

This section covers two basic patterns demonstrated in separate examples:

### 1. Basic Policy Usage (Example 1)
Simple policy creation and validation in NestJS services with manual instantiation, focusing on essential business rule enforcement and clear integration patterns for common validation scenarios.

**Key Features:**
- **Manual Policy Setup**: Direct policy instantiation in service constructors
- **Service Integration**: Standard NestJS Injectable service patterns
- **Basic Validation**: Essential business rule validation with clear error handling
- **Type Safety**: Full TypeScript integration with application types

### 2. Policy Specification Integration (Example 2)
Specification pattern integration for reusable business rules and flexible validation logic composition, enabling modular and maintainable policy structures.

**Key Features:**
- **Specification Pattern**: Reusable business rule components
- **Rule Composition**: Flexible combination of validation logic
- **Modular Design**: Independent specifications for different business concerns
- **Policy Building**: Specification-based policy construction

## Integration Benefits

### **Simplicity and Clarity**
- **Manual Setup**: Clear, explicit policy configuration without hidden dependencies
- **Direct Integration**: Straightforward service patterns following NestJS conventions
- **Easy Understanding**: Simple patterns suitable for developers new to policy-driven development

### **Flexibility and Control**
- **Custom Configuration**: Full control over policy setup and validation behavior
- **Error Handling**: Standard TypeScript/NestJS error handling patterns
- **Business Logic**: Direct expression of business rules without abstraction overhead

### **Development Experience**
- **Quick Start**: Minimal setup required to start using policy validation
- **Type Safety**: Full TypeScript support with application-specific types
- **Testing**: Easy unit testing with standard NestJS testing patterns

## Common Pitfalls

- **❌ Static Policy Instances**: Consider policy reusability and configuration flexibility
- **❌ Missing Error Context**: Always provide meaningful error messages and context
- **❌ No Validation Caching**: For high-frequency operations, consider result caching
- **❌ Tight Coupling**: Keep policies independent of specific controller implementations