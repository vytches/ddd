#!/bin/bash

# Quick script to develop specific package
PACKAGE_NAME=$1

if [ -z "$PACKAGE_NAME" ]; then
  echo "Usage: $0 <package-name>"
  echo "Example: $0 core"
  exit 1
fi

echo "🔄 Starting development for package: $PACKAGE_NAME"

# Start package development with dependencies
pnpm dev --packages="$PACKAGE_NAME"
