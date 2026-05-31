#!/bin/bash
# Append ANTHROPIC_TOKEN to all flicktek profile .envs
set -a
source /Users/kingfaisal/.hermes/.env 2>/dev/null
set +a

if [ -z "$ANTHROPIC_TOKEN" ]; then
    echo "ERROR: ANTHROPIC_TOKEN not set"
    exit 1
fi

for p in flicktek-pm flicktek-webdev flicktek-aidev flicktek-automation flicktek-security flicktek-designer flicktek-qa; do
    ENVFILE="/Users/kingfaisal/.hermes/profiles/$p/.env"
    # Remove our previous append if exists
    if grep -q "ANTHROPIC_TOKEN" "$ENVFILE" 2>/dev/null; then
        true # already has it from our earlier (broken) attempt
    else
        echo "" >> "$ENVFILE"
        echo "# Anthropic API Key for kanban workers" >> "$ENVFILE"
        echo "ANTHROPIC_TOKEN=$ANTHROPIC_TOKEN" >> "$ENVFILE"
    fi
    echo "Updated: $p"
done

echo "All done."
