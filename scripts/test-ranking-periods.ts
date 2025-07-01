#!/usr/bin/env tsx

import fetch from 'node-fetch';

async function testRankingPeriods() {
  console.log('Testing ranking periods API...\n');
  
  try {
    const response = await fetch('http://localhost:3000/api/admin/ranking-periods');
    
    if (!response.ok) {
      console.error(`Error: ${response.status} ${response.statusText}`);
      const error = await response.text();
      console.error(error);
      return;
    }
    
    const data = await response.json();
    
    console.log('Response:', JSON.stringify(data, null, 2));
    
    if (data.periods && data.periods.length > 0) {
      console.log('\nAvailable periods:');
      data.periods.forEach((period: any) => {
        console.log(`- ${period.period} ${period.is_current ? '(CURRENT)' : ''}`);
      });
      
      const current = data.periods.find((p: any) => p.is_current);
      if (current) {
        console.log(`\nCurrent live ranking: ${current.period}`);
      } else {
        console.log('\nNo current live ranking set');
      }
    }
    
  } catch (error) {
    console.error('Failed to test ranking periods:', error);
  }
}

testRankingPeriods();