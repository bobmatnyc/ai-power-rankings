const fs = require('fs');

const en = JSON.parse(fs.readFileSync('en.json', 'utf8'));

function getAllKeyValuePairs(obj, prefix = '') {
  let pairs = [];
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      pairs = pairs.concat(getAllKeyValuePairs(obj[key], fullKey));
    } else {
      pairs.push({ key: fullKey, value: obj[key] });
    }
  }
  return pairs;
}

const allPairs = getAllKeyValuePairs(en);

// Categorize by priority and context
const categories = {
  homepage: [],
  navigation: [],
  methodology: [],
  rankings: [],
  newsletter: [],
  tools: [],
  categories: [],
  companies: [],
  errors: [],
  ui: [],
  other: []
};

allPairs.forEach(({ key, value }) => {
  if (key.startsWith('home.')) {
    categories.homepage.push({ key, value });
  } else if (key.includes('nav') || key.includes('menu') || key.includes('header') || key.includes('footer')) {
    categories.navigation.push({ key, value });
  } else if (key.startsWith('methodology.')) {
    categories.methodology.push({ key, value });
  } else if (key.startsWith('rankings.')) {
    categories.rankings.push({ key, value });
  } else if (key.startsWith('newsletter.')) {
    categories.newsletter.push({ key, value });
  } else if (key.startsWith('tools.')) {
    categories.tools.push({ key, value });
  } else if (key.startsWith('categories.')) {
    categories.categories.push({ key, value });
  } else if (key.startsWith('companies.')) {
    categories.companies.push({ key, value });
  } else if (key.includes('error') || key.includes('Error')) {
    categories.errors.push({ key, value });
  } else if (key.includes('button') || key.includes('label') || key.includes('placeholder') || key.includes('tooltip')) {
    categories.ui.push({ key, value });
  } else {
    categories.other.push({ key, value });
  }
});

console.log('🔍 Translation Categories Analysis:\n');

Object.keys(categories).forEach(category => {
  const items = categories[category];
  if (items.length > 0) {
    console.log(`📁 ${category.toUpperCase()}: ${items.length} items`);
    
    // Show first few items as examples
    items.slice(0, 3).forEach(({ key, value }) => {
      console.log(`   ${key}: "${value}"`);
    });
    
    if (items.length > 3) {
      console.log(`   ... and ${items.length - 3} more`);
    }
    console.log('');
  }
});

// Create priority order for translation
const priorityOrder = [
  'homepage',
  'navigation', 
  'categories',
  'rankings',
  'methodology',
  'ui',
  'tools',
  'newsletter',
  'companies',
  'errors',
  'other'
];

console.log('🎯 Suggested Translation Priority:\n');
priorityOrder.forEach((category, index) => {
  const items = categories[category];
  if (items.length > 0) {
    const priority = index < 3 ? '🔴 HIGH' : index < 6 ? '🟡 MEDIUM' : '🟢 LOW';
    console.log(`${index + 1}. ${category.toUpperCase()}: ${items.length} items ${priority}`);
  }
});

// Export high-priority items for immediate translation
const highPriorityItems = [
  ...categories.homepage,
  ...categories.navigation,
  ...categories.categories
];

console.log(`\n📤 Exporting ${highPriorityItems.length} high-priority items for translation...`);

// Create translation batch file
const translationBatch = {
  metadata: {
    total_items: highPriorityItems.length,
    priority: 'HIGH',
    categories: ['homepage', 'navigation', 'categories'],
    created: new Date().toISOString()
  },
  items: highPriorityItems.reduce((acc, { key, value }) => {
    acc[key] = value;
    return acc;
  }, {})
};

fs.writeFileSync('high_priority_translation_batch.json', JSON.stringify(translationBatch, null, 2));

console.log('✅ Created high_priority_translation_batch.json');
console.log(`\nNext steps:`);
console.log(`1. Translate the ${highPriorityItems.length} high-priority items`);
console.log(`2. Test with translated high-priority content`);
console.log(`3. Continue with medium-priority items`);
console.log(`4. Complete with low-priority items`);
