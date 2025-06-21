#!/bin/bash

echo "🧹 Cleaning up temporary translation files..."

# Remove batch translation files
rm -f batch_*.json

# Remove translate helper files  
rm -f translate_*.json

echo "✅ Cleanup complete"
echo ""
echo "Remaining files:"
ls -la *.json | grep -E "(en|ko|jp|zh|de|fr|hr|it|uk)\.json$" | awk '{print $9, $5"b"}'
