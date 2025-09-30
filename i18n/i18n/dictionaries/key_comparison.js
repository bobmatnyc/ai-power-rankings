const fs = require("node:fs");

// Get all available keys from English file
const en = JSON.parse(fs.readFileSync("en.json", "utf8"));

function getAllKeys(obj, prefix = "") {
  let keys = [];
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === "object" && obj[key] !== null) {
      keys = keys.concat(getAllKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

const availableKeys = getAllKeys(en);

// Simple analysis - just show key categories and structure
console.log("📊 Translation Key Analysis");
console.log("==========================");
console.log(`Total keys available: ${availableKeys.length}`);

// Group by top-level category
const categories = {};
availableKeys.forEach((key) => {
  const topLevel = key.split(".")[0];
  if (!categories[topLevel]) {
    categories[topLevel] = [];
  }
  categories[topLevel].push(key);
});

console.log("\nKey categories:");
Object.keys(categories)
  .sort()
  .forEach((cat) => {
    console.log(`  ${cat}: ${categories[cat].length} keys`);
  });

console.log("\nSample keys from each category:");
Object.keys(categories)
  .sort()
  .forEach((cat) => {
    console.log(`\n${cat}:`);
    categories[cat].slice(0, 5).forEach((key) => {
      console.log(`  - ${key}`);
    });
  });
