/**
 * Demo: Clean Architecture Pattern Implementation
 * Shows how the new system separates metadata loading from output formatting
 */

import { 
  UnifiedAdapter, 
  formatAsJSDoc, 
  formatAsCLI,
  type MetadataConfig 
} from '../adapters/unified-adapter';

/**
 * Example usage of the new clean architecture system
 */
export async function demonstrateCleanArchitecture() {
  console.log('=== Clean Architecture Demo ===\n');

  // Example metadata config
  const config: MetadataConfig = {
    packageName: 'aggregates',
    className: 'AggregateRoot',
    methodName: 'commit'
  };

  console.log('1. Direct facade usage:');
  console.log('   YamlMetadataEngine → JsDocAdapter');
  const jsDocOutput = await formatAsJSDoc(config);
  console.log('   JSDoc Output:', jsDocOutput ? 'Generated' : 'None');
  console.log('');

  console.log('2. Same metadata, different adapter:');
  console.log('   YamlMetadataEngine → CliAdapter');
  const cliOutput = await formatAsCLI(config);
  console.log('   CLI Output:', cliOutput ? 'Generated' : 'None');
  console.log('');

  console.log('3. Using UnifiedAdapter directly:');
  const adapter = new UnifiedAdapter();
  
  // Get raw metadata (single source of truth)
  const rawMetadata = await adapter.getRawMetadata(config);
  console.log('   Raw metadata keys:', rawMetadata ? Object.keys(rawMetadata).join(', ') : 'None');
  
  // Format for different outputs using same metadata
  if (rawMetadata) {
    const jsDoc = await adapter.formatMetadata(config, 'jsdoc');
    const cli = await adapter.formatMetadata(config, 'cli');
    
    console.log('   JSDoc formatted:', jsDoc ? 'Yes' : 'No');
    console.log('   CLI formatted:', cli ? 'Yes' : 'No');
  }
  console.log('');

  console.log('4. Batch processing (performance optimization):');
  const allMethods = await adapter.formatAllMethodsMetadata('aggregates', 'AggregateRoot', 'jsdoc');
  console.log('   Processed methods:', Object.keys(allMethods).join(', '));
  console.log('');

  console.log('=== Architecture Benefits ===');
  console.log('✓ Single metadata loading mechanism (YamlMetadataEngine)');
  console.log('✓ Clean separation of concerns (metadata vs formatting)');
  console.log('✓ Easy to add new output formats (just create new adapter)');
  console.log('✓ No code duplication between formats');
  console.log('✓ Testable components (engine and adapters separately)');
  console.log('✓ Performance optimized (batch loading, caching)');
}

/**
 * Example of extending the system with a new output format
 */
export class JsonOutputAdapter {
  format(metadata: any): string {
    return JSON.stringify(metadata, null, 2);
  }

  formatSummary(metadata: any): string {
    return JSON.stringify({
      description: metadata.description,
      author: metadata.author,
      since: metadata.since
    });
  }
}

/**
 * Extended adapter that supports JSON format
 */
export class ExtendedUnifiedAdapter extends UnifiedAdapter {
  private jsonAdapter = new JsonOutputAdapter();

  async formatMetadata(
    config: MetadataConfig, 
    format: 'jsdoc' | 'cli' | 'json'
  ): Promise<string | null> {
    if (format === 'json') {
      const metadata = await this.getRawMetadata(config);
      return metadata ? this.jsonAdapter.format(metadata) : null;
    }
    
    return super.formatMetadata(config, format as any);
  }
}

/**
 * Demonstrate extensibility
 */
export async function demonstrateExtensibility() {
  console.log('\n=== Extensibility Demo ===');
  
  const extendedAdapter = new ExtendedUnifiedAdapter();
  
  const config: MetadataConfig = {
    packageName: 'aggregates',
    className: 'AggregateRoot',
    methodName: 'getId'
  };
  
  // Same metadata, three different formats
  const jsDoc = await extendedAdapter.formatMetadata(config, 'jsdoc');
  const cli = await extendedAdapter.formatMetadata(config, 'cli');
  const json = await extendedAdapter.formatMetadata(config, 'json');
  
  console.log('JSDoc format:', jsDoc ? 'Generated' : 'None');
  console.log('CLI format:', cli ? 'Generated' : 'None');
  console.log('JSON format:', json ? 'Generated' : 'None');
  
  console.log('\n✓ Easy to extend with new formats!');
  console.log('✓ No changes needed to metadata loading logic!');
}

// Run demo if called directly
if (require.main === module) {
  (async () => {
    await demonstrateCleanArchitecture();
    await demonstrateExtensibility();
  })().catch(console.error);
}
