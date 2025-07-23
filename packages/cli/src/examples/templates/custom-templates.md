# Custom Templates

**Focus**: Creating and customizing code generation templates
**Use Case**: Adapt generated code to your project's conventions and patterns

## Overview

VytchesDDD CLI uses Handlebars templates to generate code. You can create custom templates to match your project's coding standards, naming conventions, and architectural patterns.

## Template Structure

### Default Template Location
```
.vytches/
└── templates/
    ├── aggregates/
    │   ├── aggregate.hbs
    │   └── aggregate.test.hbs
    ├── commands/
    │   ├── command.hbs
    │   └── command-handler.hbs
    ├── events/
    │   └── domain-event.hbs
    └── value-objects/
        ├── value-object.hbs
        └── value-object.test.hbs
```

### Template Context Variables

**Common Variables Available:**
```handlebars
{{className}}          // PascalCase class name
{{fileName}}           // kebab-case file name  
{{domainName}}         // Domain context name
{{description}}        // Component description
{{author}}            // Author from config
{{timestamp}}         // Generation timestamp
{{imports}}           // Required imports array
{{properties}}        // Component properties
{{methods}}          // Component methods
```

## Creating Custom Templates

### 1. Initialize Template Directory

```bash
# Create template structure
vytches-ddd template init

# Or copy from existing templates
vytches-ddd template init --from-defaults
```

**Generated .vytches/config.json:**
```json
{
  "templates": {
    "directory": ".vytches/templates",
    "defaultTemplate": "enterprise",
    "customTemplates": {
      "enterprise": {
        "path": ".vytches/templates/enterprise",
        "description": "Enterprise patterns with full DDD compliance"
      }
    }
  },
  "codeStyle": {
    "indentation": "2spaces",
    "quotes": "single",
    "semicolons": true,
    "trailingCommas": true
  },
  "naming": {
    "aggregateSuffix": "Aggregate",
    "commandSuffix": "Command", 
    "eventSuffix": "Event",
    "serviceSuffix": "Service"
  }
}
```

### 2. Create Aggregate Template

**.vytches/templates/aggregates/aggregate.hbs:**
```handlebars
{{#if imports}}
{{#each imports}}
import { {{this.name}} } from '{{this.path}}';
{{/each}}

{{/if}}
/**
 * {{description}}
 * 
 * @domain {{domainName}}
 * @aggregate {{className}}
 * @author {{author}}
 * @created {{timestamp}}
 */
export class {{className}} extends AggregateRoot {
  private constructor(
    id: {{idType}},
{{#each properties}}
    private {{name}}: {{type}}{{#unless @last}},{{/unless}}
{{/each}}
  ) {
    super(id);
  }

{{#each methods}}
  /**
   * {{description}}
   {{#if parameters}}
   {{#each parameters}}
   * @param {{name}} {{description}}
   {{/each}}
   {{/if}}
   {{#if returnType}}
   * @returns {{returnType}} {{returnDescription}}
   {{/if}}
   */
  {{#if isStatic}}static {{/if}}{{name}}({{#each parameters}}{{name}}: {{type}}{{#unless @last}}, {{/unless}}{{/each}}){{#if returnType}}: {{returnType}}{{/if}} {
    {{#if isFactory}}
    const {{../aggregateVariable}} = new {{../className}}(
      {{#each ../constructorArgs}}
      {{this}}{{#unless @last}},{{/unless}}
      {{/each}}
    );

    {{#if ../domainEvent}}
    {{../aggregateVariable}}.addDomainEvent(new {{../domainEvent.name}}(
      {{#each ../domainEvent.parameters}}
      {{this}}{{#unless @last}},{{/unless}}
      {{/each}}
    ));
    {{/if}}

    return {{../aggregateVariable}};
    {{else}}
    {{#if businessLogic}}
    // Business logic
    {{businessLogic}}
    {{else}}
    // TODO: Implement {{name}} business logic
    {{/if}}

    {{#if domainEvent}}
    this.addDomainEvent(new {{domainEvent.name}}(
      {{#each domainEvent.parameters}}
      {{this}}{{#unless @last}},{{/unless}}
      {{/each}}
    ));
    {{/if}}
    {{/if}}
  }

{{/each}}
{{#if includePrivateMethods}}
  {{#each privateMethods}}
  private {{name}}({{#each parameters}}{{name}}: {{type}}{{#unless @last}}, {{/unless}}{{/each}}){{#if returnType}}: {{returnType}}{{/if}} {
    {{#if implementation}}
    {{implementation}}
    {{else}}
    // TODO: Implement private method
    {{/if}}
  }

  {{/each}}
{{/if}}
{{#if includeValidation}}
  private static validate{{className}}({{#each properties}}{{name}}: {{type}}{{#unless @last}}, {{/unless}}{{/each}}): void {
    {{#each validationRules}}
    if ({{condition}}) {
      throw new {{errorType}}('{{message}}');
    }
    {{/each}}
  }
{{/if}}
}
```

### 3. Create Command Template  

**.vytches/templates/commands/command.hbs:**
```handlebars
import { Command } from '@vytches-ddd/cqrs';
{{#each imports}}
import { {{name}} } from '{{path}}';
{{/each}}

/**
 * {{description}}
 * 
 * @command {{className}}
 * @domain {{domainName}}
 */
export class {{className}} extends Command {
  constructor(
{{#each properties}}
    public readonly {{name}}: {{type}}{{#unless @last}},{{/unless}}
{{/each}}
  ) {
    super();
    {{#if validation}}
    this.validate();
    {{/if}}
  }

{{#if validation}}
  private validate(): void {
    {{#each validationRules}}
    if ({{condition}}) {
      throw new ValidationError('{{message}}');
    }
    {{/each}}
  }
{{/if}}

{{#if metadata}}
  getMetadata(): CommandMetadata {
    return {
      domain: '{{domainName}}',
      aggregate: '{{targetAggregate}}',
      operation: '{{operation}}',
      {{#each metadata}}
      {{key}}: {{value}},
      {{/each}}
    };
  }
{{/if}}
}
```

### 4. Create Value Object Template

**.vytches/templates/value-objects/value-object.hbs:**
```handlebars
import { ValueObject } from '@vytches-ddd/core';
{{#each imports}}
import { {{name}} } from '{{path}}';
{{/each}}

/**
 * {{description}}
 * 
 * @valueObject {{className}}
 * @domain {{domainName}}
 */
export class {{className}} extends ValueObject<{{valueType}}> {
  constructor(value: {{valueType}}) {
    super({{className}}.validate(value));
  }

  private static validate(value: {{valueType}}): {{valueType}} {
    {{#each validationRules}}
    if ({{condition}}) {
      throw new {{errorType}}('{{message}}');
    }
    {{/each}}

    return {{transformValue}};
  }

{{#each methods}}
  /**
   * {{description}}
   */
  {{name}}{{#if parameters}}({{#each parameters}}{{name}}: {{type}}{{#unless @last}}, {{/unless}}{{/each}}){{/if}}{{#if returnType}}: {{returnType}}{{/if}} {
    {{implementation}}
  }

{{/each}}
{{#if includeStaticFactories}}
  {{#each staticFactories}}
  /**
   * {{description}}
   */
  static {{name}}({{#each parameters}}{{name}}: {{type}}{{#unless @last}}, {{/unless}}{{/each}}): {{../className}} {
    {{implementation}}
  }

  {{/each}}
{{/if}}

  {{#if includeComparison}}
  equals(other: {{className}}): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return {{toStringImplementation}};
  }
  {{/if}}
}
```

## Using Custom Templates

### 1. Generate with Custom Template

```bash
# Use specific template
vytches-ddd generate aggregate User --template enterprise

# Set default template
vytches-ddd config set defaultTemplate enterprise

# List available templates
vytches-ddd template list
```

### 2. Template Inheritance

**.vytches/templates/enterprise/aggregates/aggregate.hbs:**
```handlebars
{{> ../base/aggregates/aggregate}}

{{#if enterpriseFeatures}}
// Enterprise-specific additions
{{#if auditLogging}}
  private logDomainEvent(event: DomainEvent): void {
    this.auditLogger.log({
      aggregateId: this.id,
      eventType: event.constructor.name,
      timestamp: new Date(),
      userId: event.metadata?.userId,
      correlationId: event.metadata?.correlationId
    });
  }
{{/if}}

{{#if multiTenancy}}
  protected validateTenantAccess(tenantId: string): void {
    if (this.tenantId !== tenantId) {
      throw new UnauthorizedTenantAccessError(
        `Access denied for tenant ${tenantId}`
      );
    }
  }
{{/if}}
{{/if}}
```

### 3. Framework-Specific Templates

**.vytches/templates/nestjs/controllers/controller.hbs:**
```handlebars
import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
{{#each imports}}
import { {{name}} } from '{{path}}';
{{/each}}

/**
 * {{description}}
 * 
 * @controller {{className}}
 * @domain {{domainName}}
 */
@Controller('{{apiPath}}')
export class {{className}} {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus
  ) {}

{{#each endpoints}}
  @{{httpMethod}}('{{path}}')
  async {{methodName}}(
    {{#each parameters}}
    @{{decorator}}('{{name}}') {{name}}: {{type}}{{#unless @last}},{{/unless}}
    {{/each}}
  ): Promise<{{responseType}}> {
    {{#if isCommand}}
    const command = new {{commandClass}}({{#each commandParameters}}{{this}}{{#unless @last}}, {{/unless}}{{/each}});
    const result = await this.commandBus.execute(command);
    
    return {
      success: result.isSuccess,
      data: result.isSuccess ? result.value : null,
      error: result.isFailure ? result.error.message : null
    };
    {{else}}
    const query = new {{queryClass}}({{#each queryParameters}}{{this}}{{#unless @last}}, {{/unless}}{{/each}});
    return await this.queryBus.execute(query);
    {{/if}}
  }

{{/each}}
}
```

## Template Helpers

### 1. Built-in Helpers

```handlebars
{{!-- String manipulation --}}
{{camelCase "user-name"}}        // userName
{{pascalCase "user-name"}}       // UserName  
{{kebabCase "userName"}}         // user-name
{{snakeCase "userName"}}         // user_name

{{!-- Pluralization --}}
{{pluralize "user"}}             // users
{{singularize "users"}}          // user

{{!-- Conditional logic --}}
{{#if condition}}...{{/if}}
{{#unless condition}}...{{/unless}}
{{#each items}}...{{/each}}

{{!-- Custom domain helpers --}}
{{#isDomainService}}...{{/isDomainService}}
{{#isAggregate}}...{{/isAggregate}}
{{#hasEvents}}...{{/hasEvents}}
```

### 2. Custom Helpers

**.vytches/helpers/custom-helpers.js:**
```javascript
module.exports = {
  // Generate import statements
  generateImports: function(dependencies) {
    return dependencies.map(dep => 
      `import { ${dep.exports.join(', ')} } from '${dep.path}';`
    ).join('\n');
  },

  // Format JSDoc comments
  formatJSDoc: function(description, params, returns) {
    let jsdoc = `/**\n * ${description}\n`;
    
    if (params && params.length > 0) {
      params.forEach(param => {
        jsdoc += ` * @param ${param.name} ${param.description}\n`;
      });
    }
    
    if (returns) {
      jsdoc += ` * @returns ${returns}\n`;
    }
    
    jsdoc += ' */';
    return jsdoc;
  },

  // Generate validation logic
  generateValidation: function(rules) {
    return rules.map(rule => {
      switch (rule.type) {
        case 'required':
          return `if (!${rule.field}) throw new ValidationError('${rule.field} is required');`;
        case 'email':
          return `if (!isValidEmail(${rule.field})) throw new ValidationError('Invalid email format');`;
        case 'length':
          return `if (${rule.field}.length < ${rule.min} || ${rule.field}.length > ${rule.max}) throw new ValidationError('Invalid length');`;
        default:
          return `// TODO: Add validation for ${rule.field}`;
      }
    }).join('\n    ');
  }
};
```

## Template Configuration

### 1. Template Metadata

**.vytches/templates/metadata.json:**
```json
{
  "name": "Enterprise DDD Templates",
  "version": "1.0.0",
  "description": "Production-ready templates with enterprise patterns",
  "author": "Your Team",
  "templates": {
    "aggregates": {
      "aggregate": {
        "description": "Full aggregate with business logic and events",
        "requiredContext": ["className", "domainName", "properties", "methods"],
        "optionalContext": ["validation", "auditLogging", "multiTenancy"],
        "outputPattern": "{{domainPath}}/aggregates/{{fileName}}.aggregate.ts"
      }
    },
    "commands": {
      "command": {
        "description": "Command with validation and metadata",
        "requiredContext": ["className", "properties"],
        "optionalContext": ["validation", "metadata"],
        "outputPattern": "{{domainPath}}/commands/{{fileName}}.command.ts"
      }
    }
  },
  "helpers": [
    "./helpers/custom-helpers.js",
    "./helpers/domain-helpers.js"
  ],
  "partials": {
    "validation": "./partials/validation.hbs",
    "imports": "./partials/imports.hbs",
    "jsdoc": "./partials/jsdoc.hbs"
  }
}
```

### 2. Global Configuration

**.vytches/config.json:**
```json
{
  "project": {
    "name": "My DDD Project",
    "author": "Development Team",
    "license": "MIT"
  },
  "codeStyle": {
    "indentation": "2spaces",
    "quotes": "single",
    "semicolons": true,
    "trailingCommas": true,
    "maxLineLength": 100
  },
  "naming": {
    "aggregateSuffix": "Aggregate",
    "commandSuffix": "Command",
    "eventSuffix": "Event",
    "serviceSuffix": "Service",
    "repositorySuffix": "Repository"
  },
  "templates": {
    "defaultTemplate": "enterprise",
    "outputPaths": {
      "domain": "src/domain/{{domainName}}",
      "application": "src/application/{{domainName}}",
      "infrastructure": "src/infrastructure/{{domainName}}"
    }
  },
  "features": {
    "enterpriseLogging": true,
    "auditTrail": true,
    "multiTenancy": false,
    "eventSourcing": false
  }
}
```

## Common Template Patterns

### 1. Factory Method Pattern

```handlebars
{{#each factoryMethods}}
/**
 * {{description}}
 */
static {{name}}({{#each parameters}}{{name}}: {{type}}{{#unless @last}}, {{/unless}}{{/each}}): {{../className}} {
  {{#if validation}}
  {{../className}}.validate{{../className}}({{#each parameters}}{{name}}{{#unless @last}}, {{/unless}}{{/each}});
  {{/if}}

  const {{../instanceVariable}} = new {{../className}}(
    {{#each constructorArgs}}
    {{this}}{{#unless @last}},{{/unless}}
    {{/each}}
  );

  {{#if domainEvent}}
  {{../instanceVariable}}.addDomainEvent(new {{domainEvent.name}}(
    {{#each domainEvent.parameters}}
    {{this}}{{#unless @last}},{{/unless}}
    {{/each}}
  ));
  {{/if}}

  return {{../instanceVariable}};
}
{{/each}}
```

### 2. Repository Pattern

```handlebars
export interface I{{className}}Repository {
{{#each repositoryMethods}}
  {{name}}({{#each parameters}}{{name}}: {{type}}{{#unless @last}}, {{/unless}}{{/each}}): Promise<{{returnType}}>;
{{/each}}
}

export class {{implementation}}{{className}}Repository implements I{{className}}Repository {
  constructor(
    {{#each dependencies}}
    private readonly {{name}}: {{type}}{{#unless @last}},{{/unless}}
    {{/each}}
  ) {}

{{#each repositoryMethods}}
  async {{name}}({{#each parameters}}{{name}}: {{type}}{{#unless @last}}, {{/unless}}{{/each}}): Promise<{{returnType}}> {
    {{implementation}}
  }

{{/each}}
}
```

## Testing Templates

### 1. Generate Test Template

```bash
# Test template generation
vytches-ddd template test --template enterprise --component aggregate

# Validate template output
vytches-ddd template validate --template enterprise
```

### 2. Template Unit Tests

```bash
# Generate with test data
vytches-ddd generate aggregate TestUser --template enterprise --dry-run --test-data
```

## Tips & Best Practices

### Template Design
- **Keep templates focused**: One template per component type
- **Use partials**: Reuse common patterns across templates
- **Include metadata**: Document template requirements and outputs
- **Version templates**: Track template changes with your code

### Customization
- **Start with defaults**: Copy and modify existing templates
- **Test thoroughly**: Validate generated code compiles and runs
- **Document changes**: Maintain template documentation
- **Share templates**: Version control custom templates with your project

### Maintenance
- **Regular updates**: Keep templates in sync with framework changes
- **Validate generation**: Run tests after template modifications
- **Monitor usage**: Track which templates are most valuable
- **Gather feedback**: Improve templates based on team usage

## Troubleshooting

**Template not found?**
```bash
vytches-ddd template list --verbose
```

**Generation errors?**
```bash
vytches-ddd generate aggregate User --template custom --debug --dry-run
```

**Helper not working?**
```bash
vytches-ddd template validate --check-helpers
```