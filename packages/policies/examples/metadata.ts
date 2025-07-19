// Legacy metadata file - this should be replaced with new documentation structure
interface ExampleMetadata {
  version: string;
  releaseDate: Date;
  breaking: boolean;
  examples: any[];
}

export const metadata: ExampleMetadata = {
  version: '0.3.1',
  releaseDate: new Date('2024-01-15'),
  breaking: false,
  examples: [
    {
      id: 'business-policy',
      name: 'Business Policy Validation',
      description: 'E-commerce order validation with VIP customer handling, credit limits, and inventory checks',
      path: 'basic/business-policy',
      complexity: 'beginner',
      patterns: ['business-rules', 'policy-pattern', 'specification-pattern'],
      domain: 'e-commerce',
      package: 'policies',
      tags: ['policy', 'validation', 'business-rules', 'order'],
      dependencies: ['@vytches-ddd/core', '@vytches-ddd/policies'],
      frameworkIntegrations: [
        {
          framework: 'nestjs',
          path: 'frameworks/nestjs/business-policy',
          components: ['service']
        }
      ]
    }
  ]
};