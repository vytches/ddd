#!/bin/bash

# Analyze VytchesDDD Package for DDD Patterns

PACKAGE="$1"
PACKAGE_DIR="/home/node/projects/vytches-ddd/packages/$PACKAGE"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

if [ ! -d "$PACKAGE_DIR" ]; then
    echo -e "${RED}Package $PACKAGE not found${NC}"
    exit 1
fi

echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo -e "${BLUE}  Analyzing Package: $PACKAGE${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}"

# Count patterns
echo -e "\n${YELLOW}DDD Pattern Analysis:${NC}"

# Aggregates
aggregate_count=$(find "$PACKAGE_DIR/src" -name "*.ts" -exec grep -l "AggregateRoot\|extends.*Aggregate" {} \; 2>/dev/null | wc -l)
echo "  Aggregates: $aggregate_count"

# Value Objects
vo_count=$(find "$PACKAGE_DIR/src" -name "*.ts" -exec grep -l "ValueObject\|extends.*ValueObject" {} \; 2>/dev/null | wc -l)
echo "  Value Objects: $vo_count"

# Domain Services
service_count=$(find "$PACKAGE_DIR/src" -name "*.ts" -exec grep -l "DomainService\|Service" {} \; 2>/dev/null | wc -l)
echo "  Domain Services: $service_count"

# Events
event_count=$(find "$PACKAGE_DIR/src" -name "*.ts" -exec grep -l "DomainEvent\|extends.*Event" {} \; 2>/dev/null | wc -l)
echo "  Domain Events: $event_count"

# Repositories
repo_count=$(find "$PACKAGE_DIR/src" -name "*.ts" -exec grep -l "Repository\|IRepository" {} \; 2>/dev/null | wc -l)
echo "  Repositories: $repo_count"

# Complexity metrics
echo -e "\n${YELLOW}Complexity Metrics:${NC}"
file_count=$(find "$PACKAGE_DIR/src" -name "*.ts" -not -name "*.test.ts" -not -name "*.spec.ts" | wc -l)
line_count=$(find "$PACKAGE_DIR/src" -name "*.ts" -not -name "*.test.ts" -exec wc -l {} \; | awk '{sum+=$1} END {print sum}')
test_count=$(find "$PACKAGE_DIR/tests" -name "*.test.ts" -o -name "*.spec.ts" 2>/dev/null | wc -l)

echo "  Source Files: $file_count"
echo "  Lines of Code: $line_count"
echo "  Test Files: $test_count"

# Dependencies
echo -e "\n${YELLOW}Dependencies:${NC}"
if [ -f "$PACKAGE_DIR/package.json" ]; then
    deps=$(jq -r '.dependencies | keys[]' "$PACKAGE_DIR/package.json" 2>/dev/null | grep "@vytches" | wc -l)
    echo "  Internal Dependencies: $deps"
    jq -r '.dependencies | to_entries[] | select(.key | startswith("@vytches")) | "    - " + .key' "$PACKAGE_DIR/package.json" 2>/dev/null
fi

# Store in knowledge graph
docker exec -i ddd-knowledge-neo4j cypher-shell \
    -u neo4j -p ddd-knowledge-2024 \
    --format plain <<EOF 2>/dev/null
MERGE (p:Library:Package {name: '$PACKAGE'})
SET p.analyzed_at = datetime(),
    p.aggregate_count = $aggregate_count,
    p.value_object_count = $vo_count,
    p.service_count = $service_count,
    p.event_count = $event_count,
    p.repository_count = $repo_count,
    p.file_count = $file_count,
    p.line_count = $line_count,
    p.test_count = $test_count
RETURN p.name as package
EOF

echo -e "\n${GREEN}✓ Analysis complete and stored in knowledge graph${NC}"