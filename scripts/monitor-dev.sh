#!/bin/bash

# Start dev server
echo "🚀 Starting development server..."
pkill -f "next dev" || true
nohup pnpm dev > dev-server.log 2>&1 &
DEV_PID=$!

# Wait for server to start
sleep 5

# Monitor for errors
echo "👀 Monitoring for errors..."
tail -f dev-server.log | while read line; do
  if [[ $line == *"⨯"* ]] || [[ $line == *"Error:"* ]] || [[ $line == *"error:"* ]]; then
    echo "🚨 ERROR DETECTED: $line"
    echo "📍 Check the code at the indicated location"
    echo "💡 Fix the error and save the file for hot reload"
  fi
  
  if [[ $line == *"✓ Compiled"* ]]; then
    echo "✅ Compilation successful"
  fi
  
  if [[ $line == *"⚠"* ]]; then
    echo "⚠️  WARNING: $line"
  fi
done