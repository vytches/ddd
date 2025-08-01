const fs = require('fs');

// Read the markdown file
const mdPath = '/home/node/projects/vytches-ddd/docs/examples/domain/aggregates/aggregate-builder.md';
const content = fs.readFileSync(mdPath, 'utf8');

// Test the regex for buildWithAllCapabilities
const methodName = 'buildWithAllCapabilities';
const regex = new RegExp(`###\\s+${methodName}\\(\\)([\\s\\S]*?)(?=###\\s+\\w+\\(\\)|##\\s+[A-Z]|$)`, 'g');
const matches = content.match(regex);

console.log('=== BUILDWITHALLCAPABILITIES REGEX TEST ===');
console.log('Method:', methodName);
console.log('Regex pattern:', regex.toString());
console.log('Matches found:', matches ? matches.length : 0);

if (matches) {
  matches.forEach((match, i) => {
    console.log(`\n--- Match ${i + 1} ---`);
    console.log(match.substring(0, 500) + '...');
    
    // Count extract blocks in this match
    const extractPattern = /@extract:[^@]*@extract-end/gs;
    const extractMatches = match.match(extractPattern);
    console.log('Extract blocks found:', extractMatches ? extractMatches.length : 0);
    if (extractMatches) {
      extractMatches.forEach((extract, j) => {
        console.log(`Extract ${j + 1}:`, extract.substring(0, 100) + '...');
      });
    }
  });
}

// Let's also check what section headers exist
console.log('\n=== ALL SECTION HEADERS ===');
const headerRegex = /###\s+(\w+)\(\)/g;
let headerMatch;
while ((headerMatch = headerRegex.exec(content)) !== null) {
  console.log('Found method section:', headerMatch[1]);
}

// Let's also check if the issue is in the class name mapping
console.log('\n=== CLASS NAME MAPPING TEST ===');
const testPath = 'packages/aggregates/dist/core/aggregate-root.builder.d.ts';
console.log('Input path:', testPath);

// Simulate extractClassNameFromPath logic
const parts = testPath.split('/');
const filename = parts[parts.length - 1]; // 'aggregate-root.builder.d.ts'
const withoutExt = filename.replace(/\.d\.ts$/, ''); // 'aggregate-root.builder'

const classNameMappings = {
  'aggregate-root.builder': 'aggregate-builder',
  'aggregate-root': 'aggregate-root'
};

const finalClassName = classNameMappings[withoutExt] || withoutExt;
console.log('Filename:', filename);
console.log('Without extension:', withoutExt);
console.log('Final class name:', finalClassName);
console.log('Expected file:', `${finalClassName}.md`);