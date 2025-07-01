#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Path to the de.json file
const deFilePath = path.join(__dirname, '../src/i18n/dictionaries/de.json');

// Read the de.json file
const deContent = JSON.parse(fs.readFileSync(deFilePath, 'utf8'));

// Function to detect if a string is primarily English
function isPrimarilyEnglish(str) {
  // Remove [TRANSLATE] prefix if it exists for checking
  const cleanStr = str.replace(/^\[TRANSLATE\]\s*/, '');
  
  // If string is empty or just whitespace, skip
  if (!cleanStr.trim()) return false;
  
  // Common English words that should be translated
  const englishWords = [
    'error', 'retry', 'cancel', 'save', 'delete', 'edit', 'add', 'remove',
    'back to home', 'learn more', 'view all', 'try again', 'loading',
    'search', 'filter', 'sort', 'share', 'explore', 'about', 'home',
    'tools', 'news', 'rankings', 'methodology', 'navigation', 'features',
    'trending', 'categories', 'users', 'user', 'admin', 'settings',
    'profile', 'logout', 'login', 'sign up', 'sign in', 'register',
    'dashboard', 'overview', 'details', 'summary', 'report', 'analytics',
    'create', 'update', 'manage', 'configure', 'install', 'download',
    'upload', 'import', 'export', 'print', 'copy', 'paste', 'cut',
    'undo', 'redo', 'refresh', 'reload', 'reset', 'clear', 'submit',
    'confirm', 'approve', 'reject', 'accept', 'decline', 'enable',
    'disable', 'activate', 'deactivate', 'publish', 'unpublish',
    'draft', 'public', 'private', 'visible', 'hidden', 'active',
    'inactive', 'online', 'offline', 'available', 'unavailable',
    'success', 'warning', 'info', 'danger', 'primary', 'secondary',
    'light', 'dark', 'theme', 'language', 'region', 'timezone',
    'email', 'password', 'username', 'phone', 'address', 'city',
    'country', 'state', 'zip code', 'postal code', 'company',
    'organization', 'team', 'member', 'role', 'permission', 'access',
    'security', 'privacy', 'terms', 'policy', 'help', 'support',
    'contact', 'feedback', 'bug', 'issue', 'feature', 'request',
    'suggestion', 'improvement', 'enhancement', 'fix', 'patch',
    'version', 'release', 'update', 'upgrade', 'downgrade', 'install',
    'uninstall', 'setup', 'configuration', 'options', 'preferences',
    'choose', 'select', 'pick', 'option', 'choice', 'decision',
    'yes', 'no', 'ok', 'okay', 'true', 'false', 'on', 'off',
    'start', 'stop', 'pause', 'resume', 'play', 'record', 'upload',
    'download', 'sync', 'backup', 'restore', 'import', 'export',
    'previous', 'next', 'first', 'last', 'page', 'pages', 'of',
    'total', 'count', 'number', 'amount', 'quantity', 'size',
    'width', 'height', 'length', 'weight', 'price', 'cost',
    'free', 'paid', 'premium', 'basic', 'standard', 'advanced',
    'pro', 'enterprise', 'business', 'personal', 'individual',
    'monthly', 'yearly', 'annually', 'weekly', 'daily', 'hourly',
    'minute', 'second', 'hour', 'day', 'week', 'month', 'year',
    'today', 'yesterday', 'tomorrow', 'now', 'later', 'soon',
    'recent', 'new', 'old', 'latest', 'current', 'upcoming',
    'past', 'future', 'present', 'time', 'date', 'calendar',
    'schedule', 'appointment', 'meeting', 'event', 'notification',
    'alert', 'reminder', 'message', 'note', 'comment', 'review',
    'rating', 'score', 'rank', 'ranking', 'position', 'place',
    'top', 'bottom', 'high', 'low', 'best', 'worst', 'good',
    'bad', 'excellent', 'poor', 'average', 'normal', 'special',
    'custom', 'default', 'automatic', 'manual', 'quick', 'slow',
    'fast', 'speed', 'performance', 'quality', 'quantity', 'level'
  ];
  
  const lowerStr = cleanStr.toLowerCase();
  
  // Check if it contains common English words
  const hasEnglishWords = englishWords.some(word => 
    lowerStr.includes(word.toLowerCase())
  );
  
  // Check if it's mostly ASCII characters (indicating English)
  const asciiChars = cleanStr.match(/[a-zA-Z0-9\s.,!?;:()\-"'/]/g) || [];
  const isAsciiHeavy = asciiChars.length > cleanStr.length * 0.8;
  
  // Check for German umlauts and special characters
  const germanChars = cleanStr.match(/[äöüÄÖÜß]/g) || [];
  const hasGermanChars = germanChars.length > 0;
  
  // If it has German characters, it's likely already translated
  if (hasGermanChars) return false;
  
  // If it contains English words or is ASCII-heavy, it likely needs translation
  return hasEnglishWords || isAsciiHeavy;
}

// Function to add [TRANSLATE] prefix only to English strings
function addTranslatePrefixToEnglish(obj) {
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      // Only add [TRANSLATE] if it's primarily English and doesn't already have the prefix
      if (isPrimarilyEnglish(obj[key]) && !obj[key].startsWith('[TRANSLATE]')) {
        obj[key] = '[TRANSLATE] ' + obj[key];
      }
      // Remove [TRANSLATE] from already-translated German content
      else if (!isPrimarilyEnglish(obj[key]) && obj[key].startsWith('[TRANSLATE]')) {
        obj[key] = obj[key].replace(/^\[TRANSLATE\]\s*/, '');
      }
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      // Recursively process nested objects
      addTranslatePrefixToEnglish(obj[key]);
    }
  }
  return obj;
}

// Process the content
const updatedContent = addTranslatePrefixToEnglish(deContent);

// Write the updated content back to the file
fs.writeFileSync(deFilePath, JSON.stringify(updatedContent, null, 2));

console.log('✅ Successfully updated de.json with smart [TRANSLATE] prefixes');
console.log('   - Added [TRANSLATE] to English strings that need translation');
console.log('   - Removed [TRANSLATE] from already-translated German strings');
console.log(`📁 File updated: ${deFilePath}`);
