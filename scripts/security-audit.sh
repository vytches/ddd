#!/bin/bash

# Security audit script for VytchesDDD monorepo

echo "🛡️  Running Security Audit..."
echo "============================="

# Default audit level
AUDIT_LEVEL=${1:-moderate}

echo "Audit level: $AUDIT_LEVEL"
echo ""

# Known dev-only vulnerabilities that cannot be overridden without breaking:
# - path-to-regexp: NestJS requires older version with different API
# - ajv: @eslint/eslintrc requires ajv v6, override to v8 breaks eslint
KNOWN_DEV_ONLY="path-to-regexp|ajv"

# Run pnpm audit, filtering known dev-only issues
AUDIT_OUTPUT=$(pnpm audit --audit-level "$AUDIT_LEVEL" 2>&1)
AUDIT_EXIT=$?

echo "$AUDIT_OUTPUT"

if [ $AUDIT_EXIT -eq 0 ]; then
    echo ""
    echo "✅ No vulnerabilities found at $AUDIT_LEVEL level or above!"
elif echo "$AUDIT_OUTPUT" | grep -E "Package.*($KNOWN_DEV_ONLY)" > /dev/null; then
    # Check if ALL vulnerabilities are in the known dev-only list
    NON_KNOWN=$(echo "$AUDIT_OUTPUT" | grep "│ Package" | grep -vE "$KNOWN_DEV_ONLY" | wc -l)
    if [ "$NON_KNOWN" -eq 0 ]; then
        echo ""
        echo "⚠️  Only known dev-only vulnerabilities found (path-to-regexp, ajv) — safe to proceed."
        echo "✅ No actionable vulnerabilities!"
        exit 0
    fi
    echo ""
    echo "⚠️  Vulnerabilities found! Exit code: $AUDIT_EXIT"
else
    EXIT_CODE=$AUDIT_EXIT
    echo ""
    echo "⚠️  Vulnerabilities found! Exit code: $EXIT_CODE"
    echo ""
    echo "💡 Tips:"
    echo "  - Run 'pnpm outdated' to see available updates"
    echo "  - Update specific packages: 'pnpm update <package-name> -D'"
    echo "  - Update all dependencies: 'pnpm update'"
    echo ""
    echo "🔧 For transitive dependency vulnerabilities:"
    echo "  - Add to package.json pnpm.overrides: { \"vulnerable-package\": \">=safe-version\" }"
    echo "  - Example: { \"esbuild\": \">=0.25.0\" }"
    echo ""
    echo "📋 To check specific packages:"
    echo "  - cd packages/<package-name> && pnpm outdated"
    
    # Return non-zero for CI
    exit $EXIT_CODE
fi