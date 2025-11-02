# Algorithm v7.3 - Command Reference

Quick reference for working with Algorithm v7.3.

---

## Essential Commands

### 1. Test the Algorithm (Safe - No Database Changes)

```bash
npx tsx scripts/test-v73-scoring.ts
```

**Output:** Test results showing v7.2 vs v7.3 comparison

**Expected:**
- ✅ 7.8% duplicates (vs 84.3% in v7.2)
- ✅ Top 10 all unique
- ✅ Top 20 all unique
- ✅ 100% deterministic

---

### 2. Generate Rankings (Development Database)

```bash
npx tsx scripts/generate-v73-rankings.ts
```

**What happens:**
- Loads 51 active tools
- Calculates scores with v7.3
- Inserts into rankings table (period: 2025-11)
- Marks as current (is_current = true)

**Database changes:** YES (inserts new ranking period)

---

### 3. Generate Rankings (Production Database)

```bash
# Switch to production first
export DATABASE_URL=$DATABASE_URL_PRODUCTION

# Then generate
npx tsx scripts/generate-v73-rankings.ts
```

**⚠️ WARNING:** This modifies production database

---

## Verification Commands

### Check Current Rankings

```bash
npx tsx -e "
import { getDb } from './lib/db/connection.js';
import { rankings } from './lib/db/schema.js';
import { eq } from 'drizzle-orm';

const db = getDb();
const r = await db.select().from(rankings).where(eq(rankings.isCurrent, true));
const data = r[0];

console.log('Current Rankings:');
console.log('  Period:', data.period);
console.log('  Algorithm:', data.algorithmVersion);
console.log('  Tools:', (data.data as any).length);
console.log('  Published:', data.publishedAt);
"
```

---

### View Top 10 Rankings

```bash
npx tsx -e "
import { getDb } from './lib/db/connection.js';
import { rankings } from './lib/db/schema.js';
import { eq } from 'drizzle-orm';

const db = getDb();
const r = await db.select().from(rankings).where(eq(rankings.isCurrent, true));
const tools = (r[0].data as any).slice(0, 10);

console.log('Top 10 Rankings:\n');
tools.forEach(t => {
  console.log(\`\${t.rank}. \${t.tool_name} - \${t.score.toFixed(3)}\`);
});
"
```

---

### Check for Duplicate Scores

```bash
npx tsx -e "
import { getDb } from './lib/db/connection.js';
import { rankings } from './lib/db/schema.js';
import { eq } from 'drizzle-orm';

const db = getDb();
const r = await db.select().from(rankings).where(eq(rankings.isCurrent, true));
const tools = r[0].data as any;

const scoreMap = new Map();
tools.forEach(t => {
  const existing = scoreMap.get(t.score) || [];
  existing.push(t.tool_name);
  scoreMap.set(t.score, existing);
});

const duplicates = Array.from(scoreMap.entries()).filter(([_, names]) => names.length > 1);

console.log('Duplicate Scores:', duplicates.length);
console.log('Duplicate Tools:', duplicates.reduce((sum, [_, names]) => sum + names.length, 0));
console.log('Duplicate %:', ((duplicates.reduce((sum, [_, names]) => sum + names.length, 0) / tools.length) * 100).toFixed(1) + '%');
"
```

---

## Rollback Commands

### Rollback to v7.2 (Production)

```sql
-- In your SQL client:

-- Step 1: Mark v7.2 as current
UPDATE rankings
SET is_current = true
WHERE algorithm_version = '7.2' AND period = '2025-10';

-- Step 2: Mark v7.3 as not current
UPDATE rankings
SET is_current = false
WHERE algorithm_version = '7.3' AND period = '2025-11';
```

### Verify Rollback

```bash
npx tsx -e "
import { getDb } from './lib/db/connection.js';
import { rankings } from './lib/db/schema.js';
import { eq } from 'drizzle-orm';

const db = getDb();
const r = await db.select().from(rankings).where(eq(rankings.isCurrent, true));

console.log('Current Algorithm:', r[0].algorithmVersion);
console.log('Current Period:', r[0].period);
"
```

---

## Development Commands

### Compare Specific Tool Scores (v7.2 vs v7.3)

```bash
npx tsx -e "
import { getDb } from './lib/db/connection.js';
import { tools } from './lib/db/schema.js';
import { eq } from 'drizzle-orm';
import { RankingEngineV7 } from './lib/ranking-algorithm-v7.js';
import { RankingEngineV73 } from './lib/ranking-algorithm-v73.js';

const db = getDb();
const toolName = 'Cursor'; // Change this

const tool = await db.select().from(tools).where(eq(tools.name, toolName)).limit(1);
const toolData = tool[0].data as any;

const metricsV72 = { tool_id: tool[0].id, name: tool[0].name, category: tool[0].category, status: tool[0].status, info: toolData };
const metricsV73 = { ...metricsV72, slug: tool[0].slug };

const engineV72 = new RankingEngineV7();
const engineV73 = new RankingEngineV73();

const scoreV72 = engineV72.calculateToolScore(metricsV72);
const scoreV73 = engineV73.calculateToolScore(metricsV73);

console.log(\`\${toolName} Score Comparison:\`);
console.log(\`  v7.2: \${scoreV72.overallScore.toFixed(3)}\`);
console.log(\`  v7.3: \${scoreV73.overallScore.toFixed(3)}\`);
console.log(\`  Diff: \${(scoreV73.overallScore - scoreV72.overallScore).toFixed(3)}\`);
"
```

---

### View Tool Data Structure

```bash
npx tsx -e "
import { getDb } from './lib/db/connection.js';
import { tools } from './lib/db/schema.js';
import { eq } from 'drizzle-orm';

const db = getDb();
const tool = await db.select().from(tools).where(eq(tools.slug, 'cursor')).limit(1);

console.log(JSON.stringify(tool[0].data, null, 2));
"
```

---

## File Locations

```bash
# Core Algorithm
lib/ranking-algorithm-v73.ts

# Scripts
scripts/generate-v73-rankings.ts
scripts/test-v73-scoring.ts

# Documentation
docs/ALGORITHM_V73_RELEASE_NOTES.md
ALGORITHM_V73_IMPLEMENTATION_SUMMARY.md
ALGORITHM_V73_QUICKSTART.md
DELIVERY_SUMMARY_V73.md
V73_COMMANDS.md (this file)
```

---

## Common Workflows

### Full Development Test Cycle

```bash
# 1. Test algorithm
npx tsx scripts/test-v73-scoring.ts

# 2. Review results (should see "✅ PASS")

# 3. Generate rankings
npx tsx scripts/generate-v73-rankings.ts

# 4. Verify rankings
npx tsx -e "import {getDb} from './lib/db/connection.js'; import {rankings} from './lib/db/schema.js'; import {eq} from 'drizzle-orm'; const r=await db.select().from(rankings).where(eq(rankings.isCurrent,true)); console.log('Version:', r[0].algorithmVersion);"

# 5. Check duplicate percentage
npx tsx scripts/test-v73-scoring.ts | grep "Duplicate Percentage"
```

---

### Production Deployment

```bash
# 1. Test in dev first
npx tsx scripts/test-v73-scoring.ts

# 2. Switch to production
export DATABASE_URL=$DATABASE_URL_PRODUCTION

# 3. Backup current rankings (optional)
# Use your database backup tool

# 4. Generate rankings
npx tsx scripts/generate-v73-rankings.ts

# 5. Verify on live site
curl https://aipowerranking.com/api/rankings/current | jq '.algorithmVersion'

# 6. Monitor logs
# Check for errors or anomalies
```

---

## Troubleshooting

### "Command not found: tsx"

```bash
# Install tsx globally
npm install -g tsx

# Or use npx
npx tsx scripts/test-v73-scoring.ts
```

---

### "Cannot find module '@/lib/...'"

```bash
# Check you're in project root
pwd
# Should show: /Users/masa/Projects/aipowerranking

# If not, cd to project root
cd /Users/masa/Projects/aipowerranking
```

---

### "Database connection failed"

```bash
# Check DATABASE_URL is set
echo $DATABASE_URL

# If empty, set it
export DATABASE_URL=your_database_url
```

---

### "Algorithm v7.3 not found"

```bash
# Check file exists
ls -la lib/ranking-algorithm-v73.ts

# If missing, regenerate or restore from git
```

---

## Quick References

### Success Criteria

```
✅ < 20% duplicates (target)
✅ Top 10 all unique
✅ Top 20 all unique
✅ 100% deterministic
```

### Test Results

```
v7.2: 84.3% duplicates
v7.3:  7.8% duplicates
Improvement: ↓ 76.5 percentage points
```

### Top 10 Comparison

```
v7.2: 3 tools tied at 60.0 for ranks #1-3
v7.3: All 10 unique (65.056, 64.206, 63.576...)
```

---

**Last Updated:** November 1, 2025
**Algorithm Version:** v7.3
**Status:** Production Ready
