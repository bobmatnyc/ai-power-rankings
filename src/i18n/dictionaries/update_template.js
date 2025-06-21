const fs = require('fs');

const updates = {
  'de': {
    // Add your key-value pairs here
    // 'new.key.path': 'German translation',
    // 'another.key': 'Another translation'
  },
  'fr': {
    // 'new.key.path': 'French translation',
    // 'another.key': 'Another translation'
  },
  'ko': {
    // 'new.key.path': 'Korean translation',
    // 'another.key': 'Another translation'
  },
  'jp': {
    // 'new.key.path': 'Japanese translation',
    // 'another.key': 'Another translation'
  },
  'zh': {
    // 'new.key.path': 'Chinese translation',
    // 'another.key': 'Another translation'
  },
  'hr': {
    // 'new.key.path': 'Croatian translation',
    // 'another.key': 'Another translation'
  },
  'it': {
    // 'new.key.path': 'Italian translation',
    // 'another.key': 'Another translation'
  },
  'uk': {
    // 'new.key.path': 'Ukrainian translation',
    // 'another.key': 'Another translation'
  }
  // Add more languages as needed
};

function setNestedProperty(obj, path, value) {
  const keys = path.split('.');
  let current = obj;
  
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }
  
  current[keys[keys.length - 1]] = value;
}

Object.keys(updates).forEach(langCode => {
  const filePath = `${langCode}.json`;
  if (fs.existsSync(filePath)) {
    const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    Object.keys(updates[langCode]).forEach(key => {
      setNestedProperty(existing, key, updates[langCode][key]);
    });
    
    fs.writeFileSync(filePath, JSON.stringify(existing, null, 2));
    console.log(`✅ Updated ${langCode}.json`);
  }
});
