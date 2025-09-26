#!/usr/bin/env node

// Test script to verify imports work correctly
const { resolve } = require('path');
const fs = require('fs');

console.log('🔍 Testing import resolution...\n');

// Check if files exist
const files = [
  'src/i18n/get-dictionary.ts',
  'src/components/ui/button.tsx',
  'src/i18n/dictionaries/en.json'
];

let allGood = true;

files.forEach(file => {
  const fullPath = resolve(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    console.log(`✅ ${file} exists`);
  } else {
    console.log(`❌ ${file} NOT FOUND`);
    allGood = false;
  }
});

// Check tsconfig.json paths
try {
  const tsconfigPath = resolve(process.cwd(), 'tsconfig.json');
  const tsconfigContent = fs.readFileSync(tsconfigPath, 'utf8');

  // Parse tsconfig manually to avoid JSON comments issue
  if (tsconfigContent.includes('"@/*": ["./src/*"]')) {
    console.log('\n✅ tsconfig.json has correct @ alias configuration');
  } else {
    console.log('\n❌ tsconfig.json missing @ alias configuration');
    allGood = false;
  }
} catch (err) {
  console.log('\n❌ Could not read tsconfig.json:', err.message);
  allGood = false;
}

// Summary
console.log('\n' + '='.repeat(50));
if (allGood) {
  console.log('✅ All import paths are correctly configured!');
  console.log('The module resolution should work on Vercel.');
} else {
  console.log('❌ Some issues found with import paths.');
  console.log('Please fix the issues above before deploying.');
}