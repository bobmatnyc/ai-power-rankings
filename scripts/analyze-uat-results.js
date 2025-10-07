const fs = require('fs');

// Count evidence files
const evidenceDir = 'test-results/uat-staging/evidence';
const evidenceFiles = fs.existsSync(evidenceDir) ? fs.readdirSync(evidenceDir) : [];

console.log('=== UAT EXECUTION SUMMARY ===\n');
console.log(`Evidence Screenshots Captured: ${evidenceFiles.length}`);
console.log(`Test Artifacts Directory: test-results/uat-staging/artifacts\n`);

// Parse JUnit results
const junitXml = fs.readFileSync('test-results/uat-staging/junit.xml', 'utf8');

// Extract test counts
const testsMatch = junitXml.match(/tests="(\d+)"/);
const failuresMatch = junitXml.match(/failures="(\d+)"/);
const timeMatch = junitXml.match(/time="([\d.]+)"/);

const totalTests = testsMatch ? parseInt(testsMatch[1]) : 0;
const failures = failuresMatch ? parseInt(failuresMatch[1]) : 0;
const passed = totalTests - failures;
const duration = timeMatch ? parseFloat(timeMatch[1]) : 0;

console.log('=== TEST EXECUTION STATS ===');
console.log(`Total Tests Attempted: ${totalTests}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failures}`);
console.log(`Pass Rate: ${totalTests > 0 ? Math.round((passed/totalTests)*100) : 0}%`);
console.log(`Total Duration: ${duration.toFixed(2)}s\n`);

// Extract error details
const errorMatches = junitXml.match(/Received array:\s*\[(.*?)\]/g);
if (errorMatches) {
  console.log('=== CRITICAL ISSUES FOUND ===');
  errorMatches.forEach((match, i) => {
    console.log(`Error ${i+1}: ${match}`);
  });
  console.log();
}

// List evidence categories
const evidenceCategories = {};
evidenceFiles.forEach(file => {
  const prefix = file.split('-')[0];
  evidenceCategories[prefix] = (evidenceCategories[prefix] || 0) + 1;
});

console.log('=== EVIDENCE COLLECTED ===');
Object.entries(evidenceCategories).sort((a,b) => b[1] - a[1]).forEach(([cat, count]) => {
  console.log(`${cat}: ${count} screenshots`);
});

