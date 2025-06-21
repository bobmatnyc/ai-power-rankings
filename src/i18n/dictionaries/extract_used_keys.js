const fs = require('fs');
const path = require('path');

function findTSXFiles(dir, files = []) {
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
      findTSXFiles(fullPath, files);
    } else if (item.endsWith('.tsx') || item.endsWith('.ts')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

function extractKeysFromFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const regex = /t\(['"`]([^'"`]+)['"`]\)/g;
  const keys = [];
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    keys.push(match[1]);
  }
  
  return keys;
}

const projectRoot = '/Users/masa/Projects/ai-power-rankings';
const tsxFiles = findTSXFiles(projectRoot);
const allKeys = new Set();

tsxFiles.forEach(file => {
  const keys = extractKeysFromFile(file);
  keys.forEach(key => allKeys.add(key));
});

const sortedKeys = Array.from(allKeys).sort();
fs.writeFileSync('used_keys_clean.txt', sortedKeys.join('\n'));

console.log(`Found ${sortedKeys.length} unique i18n keys in codebase`);
console.log('First 10 keys:');
sortedKeys.slice(0, 10).forEach(key => console.log(`  ${key}`));
