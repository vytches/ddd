const ts = require('typescript');
const fs = require('fs');
const path = require('path');

function analyzePackage(packageName) {
  const distPath = path.join('packages', packageName, 'dist');
  if (!fs.existsSync(distPath)) return null;

  const stats = {
    interfaces: { documented: 0, undocumented: [] },
    classes: { documented: 0, undocumented: [] },
    functions: { documented: 0, undocumented: [] },
    types: { documented: 0, undocumented: [] },
    enums: { documented: 0, undocumented: [] },
  };

  function analyzeFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);

    function hasJsDoc(node) {
      // Check if node has JSDoc comments attached
      const leadingComments = ts.getLeadingCommentRanges(sourceFile.text, node.pos);
      if (leadingComments) {
        return leadingComments.some(comment => {
          const commentText = sourceFile.text.substring(comment.pos, comment.end);
          return commentText.startsWith('/**');
        });
      }
      return false;
    }

    function visit(node) {
      // Skip non-exported declarations
      if (!node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
        ts.forEachChild(node, visit);
        return;
      }

      const name = node.name?.text || 'anonymous';
      const hasDoc = hasJsDoc(node);
      const fileName = path.basename(filePath);

      if (ts.isInterfaceDeclaration(node)) {
        if (hasDoc) stats.interfaces.documented++;
        else stats.interfaces.undocumented.push({ name, file: fileName });
      } else if (ts.isClassDeclaration(node)) {
        if (hasDoc) stats.classes.documented++;
        else stats.classes.undocumented.push({ name, file: fileName });
      } else if (ts.isFunctionDeclaration(node)) {
        if (hasDoc) stats.functions.documented++;
        else stats.functions.undocumented.push({ name, file: fileName });
      } else if (ts.isTypeAliasDeclaration(node)) {
        if (hasDoc) stats.types.documented++;
        else stats.types.undocumented.push({ name, file: fileName });
      } else if (ts.isEnumDeclaration(node)) {
        if (hasDoc) stats.enums.documented++;
        else stats.enums.undocumented.push({ name, file: fileName });
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
  }

  // Process all .d.ts files
  function processDirectory(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        processDirectory(fullPath);
      } else if (
        file.endsWith('.d.ts') &&
        !file.endsWith('.spec.d.ts') &&
        !file.endsWith('.test.d.ts')
      ) {
        analyzeFile(fullPath);
      }
    });
  }

  processDirectory(distPath);
  return stats;
}

const stats = analyzePackage('aggregates');
if (stats) {
  console.log('📦 Aggregates Package Analysis:');
  console.log('================================');

  Object.entries(stats).forEach(([type, data]) => {
    const total = data.documented + data.undocumented.length;
    const percentage = total > 0 ? Math.round((data.documented / total) * 100) : 0;
    console.log(`\n${type.toUpperCase()}:`);
    console.log(`  ✅ Documented: ${data.documented}/${total} (${percentage}%)`);
    if (data.undocumented.length > 0) {
      console.log(`  ❌ Missing JSDoc:`);
      data.undocumented.forEach(item => {
        console.log(`     - ${item.name} (${item.file})`);
      });
    }
  });

  // Summary
  console.log('\n📊 SUMMARY:');
  const totalElements = Object.values(stats).reduce(
    (acc, s) => acc + s.documented + s.undocumented.length,
    0
  );
  const totalDocumented = Object.values(stats).reduce((acc, s) => acc + s.documented, 0);
  console.log(
    `Total coverage: ${totalDocumented}/${totalElements} (${Math.round((totalDocumented / totalElements) * 100)}%)`
  );
}
