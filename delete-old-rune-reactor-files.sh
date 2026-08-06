#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
echo "Removing obsolete Rune Reactor website files..."
for file in rune-reactor.js rune-reactor.css rune-reactor.sql RUNE-REACTOR-SETUP.txt; do
  if [ -f "$file" ]; then
    rm -f "$file"
    echo "Removed $file"
  else
    echo "Already absent: $file"
  fi
done
echo "Rune Reactor website files have been removed."
