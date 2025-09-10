# VF-001: DDD Compliance Validation Tools

**Priority**: 82/100  
**Category**: DDD Excellence  
**Pillar**: DDD Excellence  
**Estimated Time**: 24 hours  
**Dependencies**: None  
**Status**: Ready for Implementation

## 📋 Context

Library lacks automated DDD compliance validation tools:

- No aggregate boundary validation
- Repository pattern compliance unchecked
- Ubiquitous language consistency not enforced
- Dependency flow validation missing
- Event naming conventions not validated
- No compliance scoring system
- Manual architecture reviews required

**Business Impact**: Automated architecture validation ensures consistent DDD
implementation

## 🎯 Objectives

1. Design and implement compliance rule engine
2. Create aggregate boundary validation
3. Add repository pattern compliance checks
4. Build ubiquitous language validator
5. Implement dependency flow validation
6. Add event naming convention checks
7. Create compliance reporting system
8. Document validation rules and customization

## 📊 Current Validation Gaps

```typescript
// Current: Manual code reviews for DDD compliance
// Missing:
// - Automated boundary checks
// - Pattern compliance validation
// - Naming convention enforcement
// - Dependency flow analysis
// - Compliance scoring
```

## ✅ Implementation Tasks

### Phase 1: Rule Engine Design (4 hours)

#### Task 1.1: Core Validation Framework

```typescript
// packages/ddd-validation-tools/src/core/validation-engine.ts
export interface ValidationRule {
  id: string;
  name: string;
  category: DDDCategory;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  validate(context: ValidationContext): ValidationResult;
}

export class DDDValidationEngine {
  private rules: Map<string, ValidationRule> = new Map();
  private config: ValidationConfig;

  constructor(config: ValidationConfig = defaultConfig) {
    this.config = config;
    this.registerDefaultRules();
  }

  async validateProject(projectPath: string): Promise<ComplianceReport> {
    const context = await this.buildContext(projectPath);
    const results: ValidationResult[] = [];

    for (const rule of this.rules.values()) {
      if (this.shouldRunRule(rule)) {
        const result = await rule.validate(context);
        results.push(result);
      }
    }

    return this.generateReport(results);
  }

  registerRule(rule: ValidationRule): void {
    this.rules.set(rule.id, rule);
  }

  private async buildContext(projectPath: string): Promise<ValidationContext> {
    const ast = await this.parseTypeScriptProject(projectPath);
    const dependencies = await this.analyzeDependencies(projectPath);
    const fileStructure = await this.analyzeFileStructure(projectPath);

    return {
      projectPath,
      ast,
      dependencies,
      fileStructure,
      config: this.config,
    };
  }

  private generateReport(results: ValidationResult[]): ComplianceReport {
    const score = this.calculateComplianceScore(results);
    const violations = results.filter(r => !r.passed);
    const warnings = violations.filter(v => v.severity === 'WARNING');
    const errors = violations.filter(v => v.severity === 'ERROR');

    return {
      score,
      totalRules: results.length,
      passed: results.filter(r => r.passed).length,
      failed: violations.length,
      errors: errors.length,
      warnings: warnings.length,
      violations: violations.map(v => ({
        rule: v.ruleId,
        message: v.message,
        severity: v.severity,
        location: v.location,
        suggestion: v.suggestion,
      })),
      timestamp: new Date(),
      recommendations: this.generateRecommendations(violations),
    };
  }

  private calculateComplianceScore(results: ValidationResult[]): number {
    const weights = {
      ERROR: 10,
      WARNING: 3,
      INFO: 1,
    };

    let totalWeight = 0;
    let earnedPoints = 0;

    for (const result of results) {
      const weight = weights[result.severity];
      totalWeight += weight;

      if (result.passed) {
        earnedPoints += weight;
      }
    }

    return Math.round((earnedPoints / totalWeight) * 100);
  }
}
```

#### Task 1.2: AST Analysis Utilities

```typescript
// packages/ddd-validation-tools/src/utils/ast-analyzer.ts
import * as ts from 'typescript';
import { Project, SourceFile, ClassDeclaration } from 'ts-morph';

export class ASTAnalyzer {
  private project: Project;

  constructor(tsConfigPath: string) {
    this.project = new Project({
      tsConfigFilePath: tsConfigPath,
    });
  }

  findAggregates(): ClassDeclaration[] {
    const aggregates: ClassDeclaration[] = [];

    for (const sourceFile of this.project.getSourceFiles()) {
      const classes = sourceFile.getClasses();

      for (const cls of classes) {
        if (this.isAggregate(cls)) {
          aggregates.push(cls);
        }
      }
    }

    return aggregates;
  }

  private isAggregate(cls: ClassDeclaration): boolean {
    // Check if extends AggregateRoot
    const baseClass = cls.getBaseClass();
    if (baseClass?.getName() === 'AggregateRoot') {
      return true;
    }

    // Check for @Aggregate decorator
    const decorators = cls.getDecorators();
    return decorators.some(d => d.getName() === 'Aggregate');
  }

  findRepositories(): ClassDeclaration[] {
    return this.project
      .getSourceFiles()
      .flatMap(sf => sf.getClasses())
      .filter(cls => this.isRepository(cls));
  }

  private isRepository(cls: ClassDeclaration): boolean {
    // Check interface implementation
    const interfaces = cls.getImplements();
    return interfaces.some(
      i =>
        i.getText().includes('Repository') ||
        i.getText().includes('IRepository')
    );
  }

  analyzeDependencies(cls: ClassDeclaration): DependencyInfo[] {
    const dependencies: DependencyInfo[] = [];

    // Analyze constructor parameters
    const constructor = cls.getConstructors()[0];
    if (constructor) {
      for (const param of constructor.getParameters()) {
        const type = param.getType();
        dependencies.push({
          name: param.getName(),
          type: type.getText(),
          source: 'constructor',
        });
      }
    }

    // Analyze imports
    const sourceFile = cls.getSourceFile();
    const imports = sourceFile.getImportDeclarations();

    for (const imp of imports) {
      dependencies.push({
        name: imp.getModuleSpecifierValue(),
        type: 'import',
        source: 'file',
      });
    }

    return dependencies;
  }
}
```

### Phase 2: Aggregate Boundary Validation (4 hours)

#### Task 2.1: Aggregate Boundary Rules

```typescript
// packages/ddd-validation-tools/src/rules/aggregate-boundary-rule.ts
export class AggregateBoundaryRule implements ValidationRule {
  id = 'aggregate-boundary';
  name = 'Aggregate Boundary Validation';
  category = DDDCategory.TACTICAL;
  severity = 'ERROR' as const;

  async validate(context: ValidationContext): Promise<ValidationResult> {
    const violations: Violation[] = [];
    const aggregates = context.ast.findAggregates();

    for (const aggregate of aggregates) {
      // Rule 1: Aggregates should not reference other aggregates directly
      const directReferences = this.findDirectAggregateReferences(aggregate);
      if (directReferences.length > 0) {
        violations.push({
          message: `Aggregate ${aggregate.getName()} directly references other aggregates: ${directReferences.join(', ')}`,
          location: aggregate.getSourceFile().getFilePath(),
          line: aggregate.getStartLineNumber(),
          suggestion:
            'Use domain events or IDs for cross-aggregate communication',
        });
      }

      // Rule 2: Aggregates should have a single root entity
      const entities = this.findEntities(aggregate);
      if (entities.length === 0) {
        violations.push({
          message: `Aggregate ${aggregate.getName()} has no root entity`,
          location: aggregate.getSourceFile().getFilePath(),
          line: aggregate.getStartLineNumber(),
          suggestion: 'Define a root entity for the aggregate',
        });
      }

      // Rule 3: Aggregate methods should not return internal entities
      const leakyMethods = this.findLeakyMethods(aggregate);
      if (leakyMethods.length > 0) {
        violations.push({
          message: `Aggregate ${aggregate.getName()} exposes internal entities through methods: ${leakyMethods.join(', ')}`,
          location: aggregate.getSourceFile().getFilePath(),
          line: aggregate.getStartLineNumber(),
          suggestion:
            'Return value objects or primitive types instead of entities',
        });
      }

      // Rule 4: Consistency boundary check
      const transactionBoundary = this.checkTransactionBoundary(aggregate);
      if (!transactionBoundary.isValid) {
        violations.push({
          message: `Aggregate ${aggregate.getName()} violates transaction boundary: ${transactionBoundary.reason}`,
          location: aggregate.getSourceFile().getFilePath(),
          line: aggregate.getStartLineNumber(),
          suggestion:
            'Ensure all operations within aggregate are transactionally consistent',
        });
      }
    }

    return {
      ruleId: this.id,
      passed: violations.length === 0,
      violations,
      severity: this.severity,
      message:
        violations.length > 0
          ? `Found ${violations.length} aggregate boundary violations`
          : 'All aggregates respect boundaries',
    };
  }

  private findDirectAggregateReferences(aggregate: ClassDeclaration): string[] {
    const references: string[] = [];
    const methods = aggregate.getMethods();

    for (const method of methods) {
      const returnType = method.getReturnType();
      const params = method.getParameters();

      // Check return types
      if (this.isAggregateType(returnType)) {
        references.push(returnType.getText());
      }

      // Check parameters
      for (const param of params) {
        const paramType = param.getType();
        if (this.isAggregateType(paramType)) {
          references.push(paramType.getText());
        }
      }
    }

    return [...new Set(references)];
  }
}
```

### Phase 3: Repository Pattern Compliance (4 hours)

#### Task 3.1: Repository Pattern Rules

```typescript
// packages/ddd-validation-tools/src/rules/repository-pattern-rule.ts
export class RepositoryPatternRule implements ValidationRule {
  id = 'repository-pattern';
  name = 'Repository Pattern Compliance';
  category = DDDCategory.TACTICAL;
  severity = 'ERROR' as const;

  async validate(context: ValidationContext): Promise<ValidationResult> {
    const violations: Violation[] = [];
    const repositories = context.ast.findRepositories();

    for (const repo of repositories) {
      // Rule 1: Repository should only return aggregates
      const nonAggregateReturns = this.findNonAggregateReturns(repo);
      if (nonAggregateReturns.length > 0) {
        violations.push({
          message: `Repository ${repo.getName()} returns non-aggregate types: ${nonAggregateReturns.join(', ')}`,
          location: repo.getSourceFile().getFilePath(),
          line: repo.getStartLineNumber(),
          suggestion: 'Repositories should only return aggregate roots',
        });
      }

      // Rule 2: No business logic in repositories
      const businessLogic = this.findBusinessLogic(repo);
      if (businessLogic.length > 0) {
        violations.push({
          message: `Repository ${repo.getName()} contains business logic in methods: ${businessLogic.join(', ')}`,
          location: repo.getSourceFile().getFilePath(),
          line: repo.getStartLineNumber(),
          suggestion: 'Move business logic to domain services or aggregates',
        });
      }

      // Rule 3: Proper method naming
      const poorlyNamedMethods = this.findPoorlyNamedMethods(repo);
      if (poorlyNamedMethods.length > 0) {
        violations.push({
          message: `Repository ${repo.getName()} has poorly named methods: ${poorlyNamedMethods.join(', ')}`,
          location: repo.getSourceFile().getFilePath(),
          line: repo.getStartLineNumber(),
          suggestion:
            'Use ubiquitous language for method names (findBy*, save, delete)',
        });
      }

      // Rule 4: Specification pattern usage
      const hasSpecificationSupport = this.checkSpecificationSupport(repo);
      if (!hasSpecificationSupport) {
        violations.push({
          message: `Repository ${repo.getName()} doesn't support specification pattern`,
          location: repo.getSourceFile().getFilePath(),
          line: repo.getStartLineNumber(),
          suggestion:
            'Add methods that accept specifications for complex queries',
          severity: 'WARNING',
        });
      }
    }

    return {
      ruleId: this.id,
      passed: violations.length === 0,
      violations,
      severity: this.severity,
      message:
        violations.length > 0
          ? `Found ${violations.length} repository pattern violations`
          : 'All repositories follow DDD patterns',
    };
  }

  private findBusinessLogic(repo: ClassDeclaration): string[] {
    const suspiciousMethods: string[] = [];
    const methods = repo.getMethods();

    for (const method of methods) {
      const body = method.getBodyText() || '';

      // Check for business logic indicators
      if (
        body.includes('if (') &&
        !body.includes('if (!entity)') && // Allow null checks
        !body.includes('if (result.') // Allow result checks
      ) {
        suspiciousMethods.push(method.getName());
      }

      // Check for calculations
      if (
        body.match(/[+\-*/]/) &&
        !body.includes('page * size') // Allow pagination
      ) {
        suspiciousMethods.push(method.getName());
      }

      // Check for validation
      if (body.includes('throw') && !body.includes('NotFoundError')) {
        suspiciousMethods.push(method.getName());
      }
    }

    return [...new Set(suspiciousMethods)];
  }
}
```

### Phase 4: Ubiquitous Language Validator (4 hours)

#### Task 4.1: Language Consistency Rules

```typescript
// packages/ddd-validation-tools/src/rules/ubiquitous-language-rule.ts
export class UbiquitousLanguageRule implements ValidationRule {
  id = 'ubiquitous-language';
  name = 'Ubiquitous Language Consistency';
  category = DDDCategory.STRATEGIC;
  severity = 'WARNING' as const;

  private dictionary: DomainDictionary;

  constructor(dictionaryPath?: string) {
    this.dictionary = dictionaryPath
      ? this.loadDictionary(dictionaryPath)
      : this.buildDefaultDictionary();
  }

  async validate(context: ValidationContext): Promise<ValidationResult> {
    const violations: Violation[] = [];

    // Check class names
    const classes = context.ast.getAllClasses();
    for (const cls of classes) {
      const name = cls.getName();
      if (!this.isValidDomainTerm(name)) {
        violations.push({
          message: `Class name '${name}' doesn't match ubiquitous language`,
          location: cls.getSourceFile().getFilePath(),
          line: cls.getStartLineNumber(),
          suggestion: this.suggestAlternative(name),
        });
      }
    }

    // Check method names
    const methods = context.ast.getAllMethods();
    for (const method of methods) {
      const name = method.getName();
      if (!this.isValidDomainAction(name)) {
        violations.push({
          message: `Method name '${name}' doesn't use domain language`,
          location: method.getSourceFile().getFilePath(),
          line: method.getStartLineNumber(),
          suggestion: this.suggestDomainAction(name),
        });
      }
    }

    // Check for abbreviations
    const abbreviations = this.findAbbreviations(context);
    for (const abbr of abbreviations) {
      violations.push({
        message: `Abbreviation '${abbr.term}' found, use full domain term`,
        location: abbr.location,
        line: abbr.line,
        suggestion: `Use '${this.expandAbbreviation(abbr.term)}' instead`,
      });
    }

    // Check for technical terms in domain layer
    const technicalTerms = this.findTechnicalTerms(context);
    for (const term of technicalTerms) {
      violations.push({
        message: `Technical term '${term.term}' in domain layer`,
        location: term.location,
        line: term.line,
        suggestion: 'Use business language instead of technical terms',
      });
    }

    return {
      ruleId: this.id,
      passed: violations.length === 0,
      violations,
      severity: this.severity,
      message:
        violations.length > 0
          ? `Found ${violations.length} language consistency issues`
          : 'Ubiquitous language is consistently used',
    };
  }

  private buildDefaultDictionary(): DomainDictionary {
    return {
      entities: [
        'Order',
        'Customer',
        'Product',
        'Invoice',
        'Payment',
        'User',
        'Account',
        'Transaction',
        'Shipment',
      ],
      valueObjects: ['Money', 'Address', 'Email', 'PhoneNumber', 'DateRange'],
      actions: [
        'create',
        'update',
        'delete',
        'process',
        'validate',
        'approve',
        'reject',
        'cancel',
        'complete',
        'ship',
      ],
      aggregates: ['OrderAggregate', 'CustomerAggregate', 'ProductCatalog'],
      services: ['PaymentService', 'ShippingService', 'NotificationService'],
      technicalTerms: [
        'database',
        'cache',
        'queue',
        'api',
        'dto',
        'dao',
        'controller',
        'middleware',
        'proxy',
        'adapter',
      ],
      abbreviations: {
        usr: 'user',
        cust: 'customer',
        prod: 'product',
        qty: 'quantity',
        amt: 'amount',
        desc: 'description',
        addr: 'address',
      },
    };
  }

  private findTechnicalTerms(context: ValidationContext): TermLocation[] {
    const terms: TermLocation[] = [];
    const domainFiles = context.fileStructure.filter(
      f => f.path.includes('/domain/') && !f.path.includes('/infrastructure/')
    );

    for (const file of domainFiles) {
      const content = file.content;
      for (const techTerm of this.dictionary.technicalTerms) {
        const regex = new RegExp(`\\b${techTerm}\\b`, 'gi');
        const matches = content.matchAll(regex);

        for (const match of matches) {
          terms.push({
            term: techTerm,
            location: file.path,
            line: this.getLineNumber(content, match.index!),
          });
        }
      }
    }

    return terms;
  }
}
```

### Phase 5: Dependency Flow Validation (4 hours)

#### Task 5.1: Dependency Direction Rules

```typescript
// packages/ddd-validation-tools/src/rules/dependency-flow-rule.ts
export class DependencyFlowRule implements ValidationRule {
  id = 'dependency-flow';
  name = 'Dependency Flow Validation';
  category = DDDCategory.ARCHITECTURE;
  severity = 'ERROR' as const;

  async validate(context: ValidationContext): Promise<ValidationResult> {
    const violations: Violation[] = [];
    const layers = this.identifyLayers(context);

    // Rule 1: Domain should not depend on infrastructure
    const domainToInfra = this.findInvalidDependencies(
      layers.domain,
      layers.infrastructure
    );

    for (const dep of domainToInfra) {
      violations.push({
        message: `Domain class ${dep.from} depends on infrastructure ${dep.to}`,
        location: dep.location,
        line: dep.line,
        suggestion: 'Domain layer should be independent of infrastructure',
      });
    }

    // Rule 2: Domain should not depend on application
    const domainToApp = this.findInvalidDependencies(
      layers.domain,
      layers.application
    );

    for (const dep of domainToApp) {
      violations.push({
        message: `Domain class ${dep.from} depends on application layer ${dep.to}`,
        location: dep.location,
        line: dep.line,
        suggestion: 'Domain layer should not depend on application layer',
      });
    }

    // Rule 3: Check for circular dependencies
    const circular = this.findCircularDependencies(context);
    for (const cycle of circular) {
      violations.push({
        message: `Circular dependency detected: ${cycle.join(' -> ')}`,
        location: cycle[0],
        line: 0,
        suggestion: 'Break circular dependency using interfaces or events',
      });
    }

    // Rule 4: Bounded context isolation
    const contextViolations = this.checkBoundedContextIsolation(context);
    for (const violation of contextViolations) {
      violations.push({
        message: `Bounded context ${violation.from} directly references ${violation.to}`,
        location: violation.location,
        line: violation.line,
        suggestion: 'Use ACL or shared kernel for cross-context communication',
      });
    }

    return {
      ruleId: this.id,
      passed: violations.length === 0,
      violations,
      severity: this.severity,
      message:
        violations.length > 0
          ? `Found ${violations.length} dependency flow violations`
          : 'All dependencies follow DDD architecture',
    };
  }

  private identifyLayers(context: ValidationContext): LayerMap {
    return {
      domain: context.fileStructure.filter(
        f => f.path.includes('/domain/') || f.path.includes('/core/')
      ),
      application: context.fileStructure.filter(
        f => f.path.includes('/application/') || f.path.includes('/use-cases/')
      ),
      infrastructure: context.fileStructure.filter(
        f =>
          f.path.includes('/infrastructure/') || f.path.includes('/adapters/')
      ),
      presentation: context.fileStructure.filter(
        f =>
          f.path.includes('/presentation/') ||
          f.path.includes('/api/') ||
          f.path.includes('/controllers/')
      ),
    };
  }

  private findCircularDependencies(context: ValidationContext): string[][] {
    const graph = this.buildDependencyGraph(context);
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        const cycle = this.detectCycle(
          node,
          graph,
          visited,
          recursionStack,
          []
        );

        if (cycle.length > 0) {
          cycles.push(cycle);
        }
      }
    }

    return cycles;
  }
}
```

### Phase 6: Event Naming Conventions (2 hours)

#### Task 6.1: Event Naming Rules

```typescript
// packages/ddd-validation-tools/src/rules/event-naming-rule.ts
export class EventNamingRule implements ValidationRule {
  id = 'event-naming';
  name = 'Event Naming Convention';
  category = DDDCategory.TACTICAL;
  severity = 'WARNING' as const;

  async validate(context: ValidationContext): Promise<ValidationResult> {
    const violations: Violation[] = [];
    const events = context.ast.findDomainEvents();

    for (const event of events) {
      const name = event.getName();

      // Rule 1: Past tense naming
      if (!this.isPastTense(name)) {
        violations.push({
          message: `Event '${name}' should be named in past tense`,
          location: event.getSourceFile().getFilePath(),
          line: event.getStartLineNumber(),
          suggestion: this.convertToPastTense(name),
        });
      }

      // Rule 2: Should end with 'Event'
      if (!name.endsWith('Event')) {
        violations.push({
          message: `Event class '${name}' should end with 'Event'`,
          location: event.getSourceFile().getFilePath(),
          line: event.getStartLineNumber(),
          suggestion: `${name}Event`,
        });
      }

      // Rule 3: Should include aggregate name
      const aggregateName = this.extractAggregateName(event);
      if (!name.includes(aggregateName)) {
        violations.push({
          message: `Event '${name}' should include aggregate name '${aggregateName}'`,
          location: event.getSourceFile().getFilePath(),
          line: event.getStartLineNumber(),
          suggestion: `${aggregateName}${name}`,
        });
      }

      // Rule 4: No technical terms
      if (this.containsTechnicalTerms(name)) {
        violations.push({
          message: `Event '${name}' contains technical terms`,
          location: event.getSourceFile().getFilePath(),
          line: event.getStartLineNumber(),
          suggestion: 'Use business language in event names',
        });
      }
    }

    return {
      ruleId: this.id,
      passed: violations.length === 0,
      violations,
      severity: this.severity,
      message:
        violations.length > 0
          ? `Found ${violations.length} event naming issues`
          : 'All events follow naming conventions',
    };
  }

  private isPastTense(name: string): boolean {
    const pastTensePatterns = [
      /Created$/,
      /Updated$/,
      /Deleted$/,
      /Processed$/,
      /Approved$/,
      /Rejected$/,
      /Completed$/,
      /Started$/,
      /Finished$/,
      /Published$/,
      /Archived$/,
      /ed$/,
    ];

    return pastTensePatterns.some(pattern =>
      pattern.test(name.replace('Event', ''))
    );
  }

  private convertToPastTense(name: string): string {
    const conversions = {
      Create: 'Created',
      Update: 'Updated',
      Delete: 'Deleted',
      Process: 'Processed',
      Approve: 'Approved',
      Reject: 'Rejected',
      Complete: 'Completed',
      Start: 'Started',
      Finish: 'Finished',
      Publish: 'Published',
      Archive: 'Archived',
    };

    for (const [present, past] of Object.entries(conversions)) {
      if (name.includes(present)) {
        return name.replace(present, past);
      }
    }

    return name + 'ed';
  }
}
```

### Phase 7: Compliance Reporting (2 hours)

#### Task 7.1: Report Generation

```typescript
// packages/ddd-validation-tools/src/reporting/compliance-reporter.ts
export class ComplianceReporter {
  generateHTMLReport(report: ComplianceReport): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <title>DDD Compliance Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .score { font-size: 48px; color: ${this.getScoreColor(report.score)}; }
    .violation { margin: 10px 0; padding: 10px; background: #f5f5f5; }
    .error { border-left: 4px solid #f44336; }
    .warning { border-left: 4px solid #ff9800; }
    .info { border-left: 4px solid #2196f3; }
    .suggestion { color: #4caf50; font-style: italic; }
  </style>
</head>
<body>
  <h1>DDD Compliance Report</h1>
  <div class="score">Score: ${report.score}/100</div>
  
  <h2>Summary</h2>
  <ul>
    <li>Total Rules: ${report.totalRules}</li>
    <li>Passed: ${report.passed}</li>
    <li>Failed: ${report.failed}</li>
    <li>Errors: ${report.errors}</li>
    <li>Warnings: ${report.warnings}</li>
  </ul>
  
  <h2>Violations</h2>
  ${report.violations
    .map(
      v => `
    <div class="violation ${v.severity.toLowerCase()}">
      <strong>${v.rule}</strong>: ${v.message}<br>
      Location: ${v.location}:${v.line}<br>
      <span class="suggestion">Suggestion: ${v.suggestion}</span>
    </div>
  `
    )
    .join('')}
  
  <h2>Recommendations</h2>
  <ol>
    ${report.recommendations.map(r => `<li>${r}</li>`).join('')}
  </ol>
  
  <footer>
    <p>Generated: ${report.timestamp.toISOString()}</p>
  </footer>
</body>
</html>
    `;
  }

  generateMarkdownReport(report: ComplianceReport): string {
    return `
# DDD Compliance Report

## Score: ${report.score}/100

### Summary
- **Total Rules**: ${report.totalRules}
- **Passed**: ${report.passed} ✅
- **Failed**: ${report.failed} ❌
- **Errors**: ${report.errors} 🔴
- **Warnings**: ${report.warnings} 🟡

### Violations

${report.violations
  .map(
    v => `
#### ${v.severity}: ${v.rule}
- **Message**: ${v.message}
- **Location**: \`${v.location}:${v.line}\`
- **Suggestion**: ${v.suggestion}
`
  )
  .join('\n')}

### Recommendations

${report.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}

---
*Generated: ${report.timestamp.toISOString()}*
    `;
  }

  generateJSONReport(report: ComplianceReport): string {
    return JSON.stringify(report, null, 2);
  }
}
```

### Phase 8: CLI Integration (2 hours)

#### Task 8.1: Validation CLI

```typescript
// packages/ddd-validation-tools/src/cli/validate-command.ts
import { Command } from 'commander';
import { DDDValidationEngine } from '../core/validation-engine';
import { ComplianceReporter } from '../reporting/compliance-reporter';

export const validateCommand = new Command('validate')
  .description('Validate DDD compliance')
  .option('-p, --project <path>', 'Project path', process.cwd())
  .option('-c, --config <path>', 'Configuration file')
  .option(
    '-f, --format <type>',
    'Output format (html|markdown|json)',
    'markdown'
  )
  .option('-o, --output <path>', 'Output file')
  .option('--fix', 'Attempt to fix violations')
  .action(async options => {
    const engine = new DDDValidationEngine(
      options.config ? require(options.config) : undefined
    );

    console.log('🔍 Analyzing DDD compliance...');
    const report = await engine.validateProject(options.project);

    const reporter = new ComplianceReporter();
    let output: string;

    switch (options.format) {
      case 'html':
        output = reporter.generateHTMLReport(report);
        break;
      case 'json':
        output = reporter.generateJSONReport(report);
        break;
      default:
        output = reporter.generateMarkdownReport(report);
    }

    if (options.output) {
      await fs.writeFile(options.output, output);
      console.log(`📊 Report saved to ${options.output}`);
    } else {
      console.log(output);
    }

    console.log(`\n✨ Compliance Score: ${report.score}/100`);

    if (options.fix && report.violations.length > 0) {
      console.log('\n🔧 Attempting to fix violations...');
      const fixed = await engine.autoFix(report.violations);
      console.log(`Fixed ${fixed} violations`);
    }

    process.exit(report.score < 80 ? 1 : 0);
  });
```

## 📈 Success Metrics

### Tool Capabilities

- [ ] 20+ validation rules implemented
- [ ] AST-based code analysis
- [ ] Dependency graph analysis
- [ ] Customizable rule configuration
- [ ] Multiple report formats
- [ ] CLI integration
- [ ] Auto-fix for simple violations
- [ ] 98/100 compliance score achievable

### Quality Metrics

- [ ] <5 second analysis for medium project
- [ ] Zero false positives
- [ ] Clear actionable suggestions
- [ ] Comprehensive documentation

## 🔧 Technical Implementation Details

### Rule Categories

1. **Strategic**: Bounded contexts, ubiquitous language
2. **Tactical**: Aggregates, entities, value objects
3. **Architecture**: Layers, dependencies, modules
4. **Patterns**: Repository, factory, specification

### Analysis Techniques

1. **AST Analysis**: TypeScript compiler API
2. **Dependency Graph**: Module resolution
3. **Pattern Matching**: Regular expressions
4. **Static Analysis**: Type checking

## 🚨 Risk Mitigation

### Technical Risks

- **Performance**: Incremental analysis for large codebases
- **False positives**: Configurable rule sensitivity
- **Framework conflicts**: Framework-specific rule sets

### Adoption Risks

- **Learning curve**: Progressive rule introduction
- **Legacy code**: Baseline and improvement tracking
- **Team resistance**: Focus on value, not enforcement

## 📚 References

- [DDD Reference](https://domainlanguage.com/ddd/reference/)
- [TypeScript Compiler API](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API)
- [AST Explorer](https://astexplorer.net/)
- [Architectural Fitness Functions](https://www.thoughtworks.com/insights/articles/fitness-function-driven-development)

## ✅ Definition of Done

- [ ] Core validation engine implemented
- [ ] 20+ rules covering all DDD aspects
- [ ] AST analysis working
- [ ] Report generation in 3 formats
- [ ] CLI tool integrated
- [ ] Documentation complete
- [ ] 95% test coverage
