#!/bin/bash

# Security audit script for VytchesDDD monorepo

echo "🛡️  Running Security Audit..."
echo "============================="

# Default audit level
AUDIT_LEVEL=${1:-moderate}

echo "Audit level: $AUDIT_LEVEL"
echo ""

# Run pnpm audit
if pnpm audit --audit-level "$AUDIT_LEVEL"; then
    echo ""
    echo "✅ No vulnerabilities found at $AUDIT_LEVEL level or above!"
else
    EXIT_CODE=$?
    echo ""
    echo "⚠️  Vulnerabilities found! Exit code: $EXIT_CODE"
    echo ""
    echo "💡 Tips:"
    echo "  - Run 'pnpm outdated' to see available updates"
    echo "  - Update specific packages: 'pnpm update <package-name> -D'"
    echo "  - Update all dependencies: 'pnpm update'"
    echo ""
    echo "📋 To check specific packages:"
    echo "  - cd packages/<package-name> && pnpm outdated"
    
    # Return non-zero for CI
    exit $EXIT_CODE
fi