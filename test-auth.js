#!/usr/bin/env node
const crypto = require('crypto');

// Your password
const password = "SuperSecure2025!@#";

// Generate hash
const hash = crypto.createHash('sha256').update(password).digest('hex');

console.log("Password:", password);
console.log("SHA-256 Hash:", hash);
console.log("\n✅ Add this to Vercel Environment Variables:");
console.log("ADMIN_PASSWORD_HASH =", hash);

// Test authentication locally
const testAuth = async () => {
  console.log("\n🔍 Testing authentication locally...");

  try {
    const response = await fetch('http://localhost:3001/api/admin/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password })
    });

    const data = await response.json();

    if (response.ok) {
      console.log("✅ Authentication successful!");
      console.log("Response:", data);
    } else {
      console.log("❌ Authentication failed!");
      console.log("Status:", response.status);
      console.log("Error:", data);
    }
  } catch (error) {
    console.log("❌ Request failed:", error.message);
  }
};

// Also test with environment variable
console.log("\n📋 To test with forced auth in dev:");
console.log(`FORCE_AUTH_IN_DEV=true ADMIN_PASSWORD_HASH=${hash} npm run dev`);

// Run the test
testAuth();