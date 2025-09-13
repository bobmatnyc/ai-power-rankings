#!/usr/bin/env node

const crypto = require('crypto');

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Get password from command line argument
const password = process.argv[2];

if (!password) {
  console.log('Usage: node generate-admin-password.js <password>');
  console.log('Example: node generate-admin-password.js MySecurePassword123!');
  process.exit(1);
}

const hash = hashPassword(password);

console.log('\n🔐 Admin Password Hash Generator');
console.log('================================');
console.log(`Password: ${password}`);
console.log(`Hash: ${hash}`);
console.log('\nAdd this to your .env file:');
console.log(`ADMIN_PASSWORD_HASH="${hash}"`);
console.log('\n⚠️  Security Notes:');
console.log('- Never commit passwords or hashes to version control');
console.log('- Use a strong, unique password in production');
console.log('- Change the default password immediately after deployment');
console.log('- Consider using environment variables in your hosting platform');