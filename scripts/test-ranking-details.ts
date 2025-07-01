#!/usr/bin/env tsx

import fetch from 'node-fetch';

async function testRankingDetails() {
  console.log('Testing ranking details API...\n');
  
  const period = '2025-06';
  
  try {
    const response = await fetch(`http://localhost:3000/api/admin/rankings/${period}`);
    
    if (!response.ok) {
      console.error(`Error: ${response.status} ${response.statusText}`);
      const error = await response.text();
      console.error(error);
      return;
    }
    
    const data = await response.json();
    
    console.log('Response structure:');
    console.log('- Has period:', !!data.period);
    console.log('- Period.rankings length:', data.period?.rankings?.length || 0);
    console.log('- _source:', data._source);
    
    if (data.period?.rankings && data.period.rankings.length > 0) {
      console.log('\nFirst ranking:');
      const first = data.period.rankings[0];
      console.log(`- Tool: ${first.tool_name}`);
      console.log(`- Position: ${first.position}`);
      console.log(`- Score: ${first.score}`);
      console.log(`- Has factor_scores: ${!!first.factor_scores}`);
      if (first.factor_scores) {
        console.log(`  - Agentic: ${first.factor_scores.agentic_capability}`);
        console.log(`  - Technical: ${first.factor_scores.technical_performance}`);
      }
    }
    
  } catch (error) {
    console.error('Failed to test ranking details:', error);
  }
}

testRankingDetails();