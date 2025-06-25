#!/bin/bash

# Dodaj tagi do package.json files
for pkg in core utils validation policies events cqrs acl projections messaging resilience testing enterprise; do
  jq '.nx.tags = ["scope:'$pkg'", "type:lib"]' packages/$pkg/package.json > tmp.json && mv tmp.json packages/$pkg/package.json
done

# CLI
jq '.nx.tags = ["scope:cli", "type:tool"]' packages/cli/package.json > tmp.json && mv tmp.json packages/cli/package.json

# Examples
for example in simple playground ecommerce banking; do
  if [ -f "examples/$example/package.json" ]; then
    jq '.nx.tags = ["scope:examples", "type:example"]' examples/$example/package.json > tmp.json && mv tmp.json examples/$example/package.json
  fi
done
