#!/bin/bash

PACKAGE_NAME=$1

if [ -z "$PACKAGE_NAME" ]; then
  echo "Usage: $0 <package-name>"
  echo "Example: $0 core"
  exit 1
fi

echo "🔨 Building package: $PACKAGE_NAME"

if [ ! -d "packages/$PACKAGE_NAME" ]; then
  echo "❌ Package not found: packages/$PACKAGE_NAME"
  exit 1
fi

# Build specific package
nx build "$PACKAGE_NAME"
