const fs = require('fs');

// Read the aggregate-builder.md file
const content = fs.readFileSync('/home/node/projects/vytches-ddd/docs/examples/domain/aggregates/aggregate-builder.md', 'utf-8');

// Test the regex pattern that's supposed to match build method section
const methodName = 'build';
const methodSectionRegex = new RegExp(`###\\s+${methodName}\\(\\)([\\s\\S]*?)(?=###\\s+\\w+\\(\\)|##\\s+[A-Z]|$)`, 'i');

const methodMatch = content.match(methodSectionRegex);

if (methodMatch) {
    console.log('=== REGEX MATCH FOUND ===');
    console.log('Match index:', methodMatch.index);
    console.log('Match length:', methodMatch[1].length);
    console.log('Method section content:');
    console.log('='.repeat(50));
    console.log(methodMatch[1]);
    console.log('='.repeat(50));
    
    // Now test the extract pattern within this section
    const methodSection = methodMatch[1];
    const extractRegex = /@extract:\s*(\w+):(\w+):(\w+)\s*\n\s*```typescript\s*\n([\s\S]*?)```\s*\n@extract-end/g;
    
    console.log('\n=== EXTRACT BLOCKS FOUND IN SECTION ===');
    let match;
    let extractCount = 0;
    while ((match = extractRegex.exec(methodSection)) !== null) {
        extractCount++;
        const [, extractMethodName, domain, complexity, code] = match;
        console.log(`Extract ${extractCount}:`);
        console.log(`  Method: ${extractMethodName}`);
        console.log(`  Domain: ${domain}`);
        console.log(`  Complexity: ${complexity}`);
        console.log(`  Matches buildWithAllCapabilities: ${extractMethodName === methodName}`);
        console.log(`  Code preview: ${code.substring(0, 50)}...`);
        console.log('---');
    }
    
    console.log(`\nTotal extract blocks found: ${extractCount}`);
} else {
    console.log('No match found for method section regex');
}