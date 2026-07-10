#!/usr/bin/env bash

set -e

# Move into the folder where this script is stored.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Refreshing professor rankings..."
node getProfessorRankings.js