#!/usr/bin/env tsx
/**
 * Helper script to clear all data from Payload CMS collections
 * USE WITH CAUTION - This will delete all data!
 * 
 * Usage: pnpm tsx scripts/payload-migration/clear-payload-data.ts
 */

import { getPayload, BasePayload } from 'payload'
import config from '../../payload.config'
import dotenv from 'dotenv'
import path from 'path'
import readline from 'readline'

type PayloadInstance = BasePayload

// Load environment variables
dotenv.config({ path: path.resolve('.env.local') })

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

function askQuestion(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer)
    })
  })
}

async function clearCollection(payload: PayloadInstance, collection: string) {
  console.log(`\n🗑️  Clearing ${collection}...`)
  
  try {
    // Get all documents
    const result = await payload.find({
      collection,
      limit: 1000,
      depth: 0,
    })
    
    const total = result.totalDocs
    console.log(`Found ${total} documents to delete`)
    
    // Delete in batches
    let deleted = 0
    while (deleted < total) {
      const batch = await payload.find({
        collection,
        limit: 100,
        depth: 0,
      })
      
      for (const doc of batch.docs) {
        await payload.delete({
          collection,
          id: doc.id,
        })
        deleted++
        
        if (deleted % 10 === 0) {
          process.stdout.write(`\rDeleted ${deleted}/${total} documents`)
        }
      }
    }
    
    console.log(`\n✅ Cleared ${deleted} documents from ${collection}`)
  } catch (error) {
    console.error(`❌ Error clearing ${collection}:`, error)
  }
}

async function main() {
  console.log('⚠️  WARNING: This will DELETE all data from Payload CMS!')
  console.log('='.repeat(50))
  
  const answer = await askQuestion('Are you sure you want to continue? Type "yes" to confirm: ')
  
  if (answer.toLowerCase() !== 'yes') {
    console.log('❌ Operation cancelled')
    rl.close()
    process.exit(0)
  }
  
  try {
    // Initialize Payload
    console.log('\n🚀 Initializing Payload...')
    const payload = await getPayload({ config })
    
    // Clear collections in reverse order of dependencies
    const collections = ['rankings', 'metrics', 'news', 'tools', 'companies']
    
    for (const collection of collections) {
      await clearCollection(payload, collection)
    }
    
    console.log('\n✅ All collections cleared!')
    rl.close()
    process.exit(0)
  } catch (error) {
    console.error('\n❌ Operation failed:', error)
    rl.close()
    process.exit(1)
  }
}

// Run the script
main().catch(console.error)