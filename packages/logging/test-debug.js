// Simple debug test
console.log('=== Testing Email Pattern ===');

// Test email pattern
const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const testString = 'Contact john@example.com or admin@test.org for help';

console.log('Original string:', testString);
console.log('Pattern:', emailPattern);

// Reset pattern state
emailPattern.lastIndex = 0;
const matches = testString.match(emailPattern);
console.log('Matches found:', matches);

// Test replacement
emailPattern.lastIndex = 0;
const replaced = testString.replace(emailPattern, '[EMAIL]');
console.log('After replacement:', replaced);

console.log('\n=== Testing Custom Pattern ===');
const customPattern = /\b[A-Z]{2}\d{6}\b/g;
const customString = 'Reference AB123456 and CD789012';

customPattern.lastIndex = 0;
const customMatches = customString.match(customPattern);
console.log('Custom matches:', customMatches);

customPattern.lastIndex = 0;
const customReplaced = customString.replace(customPattern, '[CUSTOM]');
console.log('Custom replaced:', customReplaced);

// Test lowercase should not match
const lowercaseString = 'No match here: ab123456';
const lowercasePattern = /\b[A-Z]{2}\d{6}\b/g;
lowercasePattern.lastIndex = 0;
const lowercaseMatches = lowercaseString.match(lowercasePattern);
console.log('Lowercase matches (should be null):', lowercaseMatches);

console.log('\n=== Pattern Tests Complete ===');