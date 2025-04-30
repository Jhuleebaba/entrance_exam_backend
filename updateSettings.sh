#!/bin/bash

# Compile the TypeScript script
echo "Compiling TypeScript script..."
npx tsc src/scripts/updateSettings.ts --outDir dist/scripts --esModuleInterop true --resolveJsonModule true --skipLibCheck true --module CommonJS --target ES2020

# Run the compiled script
echo "Running the update script..."
node dist/scripts/updateSettings.js

echo "Script execution completed." 