# VI-001: CLI Scaffolding Enhancement — **CANCELLED 2026-05-08**

> **Status**: CANCELLED — superseded by REL-001 (LLM-first generation approach).
> User decision (2026-05-08): library does not ship a CLI. Developer onboarding
> flows through AI assistants (Claude Code, Cursor, Copilot) reading
> LLM-optimized context bundles instead. See:
> - `project-orchestration/tasks/REL-001-cli-deprecation-llm-first.md`
> - `project-orchestration/tasks/REL-010-llm-bundle-pipeline.md`
>
> This file is kept as a record of the strategic pivot. **Do not implement.**

---

**Original Priority**: 83/100
**Category**: Developer Experience
**Pillar**: Developer Experience
**Estimated Time**: 16 hours
**Dependencies**: VD-002 (Policies Examples), VD-003 (Domain Services
Examples)
**Status (historical)**: Ready for Implementation
**Status (actual)**: CANCELLED

## 📋 Context

Current CLI has powerful features but suffers from:

- Complex command structure (2300+ line files)
- No progressive disclosure for beginners
- Lack of time estimates and progress feedback
- Missing interactive setup wizards
- No quick-start pathways for common scenarios

**Business Impact**: 80% reduction in initial setup time, faster developer
onboarding

## 🎯 Objectives

1. Implement progressive disclosure pattern in CLI
2. Create <15 minute quick-start experience
3. Add interactive setup wizards with smart defaults
4. Provide real-time progress feedback and time estimates
5. Simplify common workflows with starter templates

## 📊 Current State Analysis

```bash
# Current complex command
vytches-ddd generate aggregate OrderAggregate \
  --domain orders \
  --with-events \
  --with-repository \
  --with-tests \
  --output ./src/domain/orders

# Desired simple experience
vytches-ddd quick-start
# Interactive wizard guides through setup in <15 minutes
```

## ✅ Implementation Tasks

### Phase 1: Progressive Disclosure Design (4 hours)

#### Task 1.1: Create Command Hierarchy

```typescript
export const commands = {
  // Beginner commands (top-level, simple)
  'quick-start': {
    description: 'Get started in under 15 minutes',
    aliases: ['qs', 'start'],
    complexity: 'beginner',
  },
  create: {
    description: 'Create a new project',
    aliases: ['new', 'init'],
    complexity: 'beginner',
  },

  // Intermediate commands
  generate: {
    description: 'Generate DDD components',
    aliases: ['g'],
    complexity: 'intermediate',
    subcommands: {
      aggregate: {},
      service: {},
      policy: {},
    },
  },

  // Advanced commands
  analyze: {
    description: 'Analyze DDD compliance',
    complexity: 'advanced',
  },
  migrate: {
    description: 'Migrate between versions',
    complexity: 'advanced',
  },
};
```

#### Task 1.2: Implement Complexity Levels

```typescript
export class CLIComplexityManager {
  private userLevel: 'beginner' | 'intermediate' | 'advanced' = 'beginner';

  getAvailableCommands(): Command[] {
    return commands.filter(cmd => this.shouldShowCommand(cmd, this.userLevel));
  }

  shouldShowCommand(command: Command, level: string): boolean {
    const complexityOrder = ['beginner', 'intermediate', 'advanced'];
    const cmdIndex = complexityOrder.indexOf(command.complexity);
    const userIndex = complexityOrder.indexOf(level);
    return cmdIndex <= userIndex;
  }
}
```

### Phase 2: Quick-Start Implementation (6 hours)

#### Task 2.1: Create Quick-Start Wizard

```typescript
export class QuickStartWizard {
  private steps = [
    { name: 'Project Setup', duration: '3 min', completed: false },
    { name: 'Framework Selection', duration: '2 min', completed: false },
    { name: 'Domain Modeling', duration: '5 min', completed: false },
    { name: 'Generate Code', duration: '3 min', completed: false },
    { name: 'Verify Setup', duration: '2 min', completed: false },
  ];

  async run(): Promise<void> {
    console.log(chalk.bold.green('🚀 VytchesDDD Quick Start (15 minutes)\n'));

    for (const [index, step] of this.steps.entries()) {
      await this.showProgress(index + 1, step);
      await this.executeStep(step);
      step.completed = true;
    }

    await this.showCompletion();
  }

  private async showProgress(stepNum: number, step: Step): void {
    const progress = ((stepNum - 1) / this.steps.length) * 100;
    const bar = this.createProgressBar(progress);

    console.log(`\n${bar}`);
    console.log(
      `Step ${stepNum}/${this.steps.length}: ${step.name} (${step.duration})`
    );
  }

  private createProgressBar(percent: number): string {
    const width = 30;
    const filled = Math.floor((percent / 100) * width);
    const empty = width - filled;

    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${percent.toFixed(0)}%`;
  }
}
```

#### Task 2.2: Implement Smart Defaults

```typescript
export class SmartDefaults {
  getDefaults(context: WizardContext): ProjectConfig {
    // Intelligent defaults based on user choices
    if (context.framework === 'nestjs') {
      return {
        structure: 'modular',
        patterns: ['cqrs', 'events', 'repository'],
        testing: 'jest',
        di: '@vytches/ddd-di',
        examples: ['user-management', 'order-processing'],
      };
    }

    if (context.projectType === 'microservice') {
      return {
        structure: 'vertical-slice',
        patterns: ['events', 'messaging', 'acl'],
        testing: 'vitest',
        examples: ['event-driven-communication'],
      };
    }

    // Default for monolith
    return {
      structure: 'layered',
      patterns: ['aggregates', 'repositories', 'services'],
      testing: 'vitest',
      examples: ['basic-crud', 'domain-services'],
    };
  }
}
```

#### Task 2.3: Create Scenario Templates

```typescript
export const scenarioTemplates = {
  'e-commerce': {
    name: 'E-commerce Platform',
    description: 'Order management, inventory, payments',
    aggregates: ['Order', 'Product', 'Customer', 'Payment'],
    services: ['OrderService', 'PaymentService', 'InventoryService'],
    events: ['OrderPlaced', 'PaymentProcessed', 'InventoryUpdated'],
    policies: ['OrderValidation', 'PaymentAuthorization'],
    structure: `
      src/
      ├── domain/
      │   ├── orders/
      │   ├── products/
      │   └── customers/
      ├── application/
      ├── infrastructure/
      └── presentation/
    `,
  },

  'user-management': {
    name: 'User Management System',
    description: 'Authentication, authorization, profiles',
    aggregates: ['User', 'Role', 'Permission'],
    services: ['AuthService', 'UserService', 'RoleService'],
    events: ['UserRegistered', 'RoleAssigned', 'PasswordChanged'],
    policies: ['PasswordPolicy', 'RegistrationPolicy'],
  },

  'blog-platform': {
    name: 'Content Management',
    description: 'Articles, comments, moderation',
    aggregates: ['Article', 'Author', 'Comment'],
    services: ['PublishingService', 'ModerationService'],
    events: ['ArticlePublished', 'CommentPosted'],
    policies: ['ContentModeration', 'PublishingRules'],
  },
};
```

### Phase 3: Interactive Features (4 hours)

#### Task 3.1: Implement Interactive Prompts

```typescript
import inquirer from 'inquirer';
import ora from 'ora';

export class InteractivePrompts {
  async getProjectInfo(): Promise<ProjectInfo> {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'projectName',
        message: 'What is your project name?',
        default: 'my-ddd-app',
        validate: this.validateProjectName,
      },
      {
        type: 'list',
        name: 'framework',
        message: 'Which framework are you using?',
        choices: [
          { name: 'NestJS (Recommended)', value: 'nestjs' },
          { name: 'Express', value: 'express' },
          { name: 'Fastify', value: 'fastify' },
          { name: 'None (Standalone)', value: 'none' },
        ],
      },
      {
        type: 'list',
        name: 'scenario',
        message: 'Choose a starter scenario:',
        choices: [
          { name: '🛍️  E-commerce Platform', value: 'e-commerce' },
          { name: '👤  User Management', value: 'user-management' },
          { name: '📝  Blog Platform', value: 'blog-platform' },
          { name: "🎨  Custom (I'll define my own)", value: 'custom' },
        ],
      },
      {
        type: 'confirm',
        name: 'includeExamples',
        message: 'Include working examples?',
        default: true,
      },
    ]);

    return answers as ProjectInfo;
  }

  async confirmGeneration(summary: GenerationSummary): Promise<boolean> {
    console.log('\n📋 Generation Summary:');
    console.log(`  Project: ${summary.projectName}`);
    console.log(`  Framework: ${summary.framework}`);
    console.log(`  Components: ${summary.componentCount} files`);
    console.log(`  Estimated time: ${summary.estimatedTime}`);

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Proceed with generation?',
        default: true,
      },
    ]);

    return confirm;
  }
}
```

#### Task 3.2: Add Progress Indicators

```typescript
export class ProgressIndicator {
  private spinner: any;

  startTask(message: string): void {
    this.spinner = ora({
      text: message,
      spinner: 'dots',
    }).start();
  }

  updateTask(message: string): void {
    if (this.spinner) {
      this.spinner.text = message;
    }
  }

  completeTask(message: string): void {
    if (this.spinner) {
      this.spinner.succeed(message);
    }
  }

  failTask(message: string): void {
    if (this.spinner) {
      this.spinner.fail(message);
    }
  }

  showDetailedProgress(current: number, total: number, item: string): void {
    const percent = ((current / total) * 100).toFixed(0);
    this.updateTask(`Generating ${item}... [${current}/${total}] ${percent}%`);
  }
}
```

#### Task 3.3: Implement Validation System

```typescript
export class InputValidator {
  validateProjectName(name: string): boolean | string {
    if (!name || name.length < 3) {
      return 'Project name must be at least 3 characters';
    }

    if (!/^[a-z0-9-]+$/.test(name)) {
      return 'Project name can only contain lowercase letters, numbers, and hyphens';
    }

    if (fs.existsSync(path.join(process.cwd(), name))) {
      return `Directory "${name}" already exists`;
    }

    return true;
  }

  validateDomainName(name: string): boolean | string {
    if (!name || name.length < 2) {
      return 'Domain name must be at least 2 characters';
    }

    if (!/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
      return 'Domain name must start with uppercase and be in PascalCase';
    }

    return true;
  }
}
```

### Phase 4: Template System Enhancement (2 hours)

#### Task 4.1: Create Template Engine

```typescript
export class TemplateEngine {
  private templates = new Map<string, Template>();

  async renderTemplate(
    templateName: string,
    context: TemplateContext
  ): Promise<string> {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Template "${templateName}" not found`);
    }

    // Use handlebars or similar for template rendering
    const compiled = handlebars.compile(template.content);
    return compiled(context);
  }

  registerTemplate(name: string, template: Template): void {
    this.templates.set(name, template);
  }

  async loadTemplates(directory: string): Promise<void> {
    const files = await fs.readdir(directory);

    for (const file of files) {
      if (file.endsWith('.hbs')) {
        const content = await fs.readFile(path.join(directory, file), 'utf-8');
        const name = path.basename(file, '.hbs');
        this.registerTemplate(name, { name, content });
      }
    }
  }
}
```

## 📈 Success Metrics

### User Experience Metrics

- [ ] <15 minute time to first working application
- [ ] 90% of users complete quick-start successfully
- [ ] 80% reduction in support questions about setup
- [ ] 4.5/5 developer satisfaction rating

### Technical Metrics

- [ ] Command execution time <2 seconds
- [ ] Zero errors in generated code
- [ ] 100% test coverage for generated components
- [ ] All generated code passes linting

## 🎨 User Experience Design

### Command Flow

```
vytches-ddd
├── quick-start          # 15-minute guided setup
├── create <project>     # Simple project creation
├── generate <type>      # Component generation
│   ├── aggregate
│   ├── service
│   └── policy
├── add <feature>        # Add capabilities
│   ├── messaging
│   ├── event-store
│   └── resilience
└── help                 # Context-aware help
```

### Quick-Start Flow

```
1. Welcome & Time Estimate (30s)
2. Project Setup (3 min)
   - Name, location, package manager
3. Framework Selection (2 min)
   - Framework choice, integration level
4. Domain Modeling (5 min)
   - Scenario selection or custom domain
5. Code Generation (3 min)
   - Generate all components with progress
6. Verification (2 min)
   - Run tests, start dev server
7. Next Steps (30s)
   - Documentation links, tutorials
```

## 🚨 Risk Mitigation

### Complexity Risks

- **Over-simplification**: Maintain advanced features behind flags
- **Hidden Complexity**: Provide verbose mode for transparency
- **Learning Curve**: Include tutorials and examples

### Technical Risks

- **Template Maintenance**: Automated testing for templates
- **Version Compatibility**: Version lock for dependencies
- **Performance**: Lazy load features not immediately needed

## 📚 References

- [CLI UX Best Practices](https://clig.dev/)
- [Progressive Disclosure Pattern](https://www.nngroup.com/articles/progressive-disclosure/)
- [Inquirer.js Documentation](https://github.com/SBoudrias/Inquirer.js)
- [Ora Spinner](https://github.com/sindresorhus/ora)

## ✅ Definition of Done

- [ ] Quick-start completes in <15 minutes
- [ ] All scenarios generate working code
- [ ] Interactive prompts have validation
- [ ] Progress indicators work correctly
- [ ] Documentation updated
- [ ] Tutorial video created
- [ ] User testing completed with 5+ developers
