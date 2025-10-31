# Quick Test Guide - Verify Goose Logo & Company Fix

## 🚀 Quick Verification (30 seconds)

### Test 1: Check API Response
```bash
curl -s http://localhost:3007/api/tools/goose/json | jq '{
  name: .tool.name,
  logo: .tool.logo_url,
  company: .tool.info.company.name
}'
```

**Expected Output:**
```json
{
  "name": "Goose",
  "logo": "/tools/goose.png",
  "company": "Block (Open Source)"
}
```

### Test 2: Verify Logo File Exists
```bash
ls -lh /Users/masa/Projects/aipowerranking/public/tools/goose.png
```

**Expected Output:**
```
-rw-r--r--@ 1 masa  staff   9.9K Oct 30 13:41 .../public/tools/goose.png
```

### Test 3: Check Other Open Source Tools
```bash
curl -s http://localhost:3007/api/tools/aider/json | jq '.tool.info.company.name'
```

**Expected Output:**
```
"Open Source"
```

---

## 🌐 Browser Testing

### Test Goose Tool Page
1. Open browser: http://localhost:3007/en/tools/goose
2. ✅ Verify logo displays (black goose logo)
3. ✅ Verify company shows "Block (Open Source)" (not "N/A")

### Test Other Open Source Tools
1. Aider: http://localhost:3007/en/tools/aider
2. Qwen Code: http://localhost:3007/en/tools/qwen-code
3. ✅ All should show "Open Source" instead of "N/A"

---

## 🔧 Re-run Updates (if needed)

```bash
# If you need to re-apply the fixes
npx tsx scripts/update-goose-company.ts
npx tsx scripts/fix-open-source-companies.ts
```

---

## 📊 Full Verification Suite

```bash
# Run comprehensive verification
npx tsx scripts/verify-open-source-tools.ts
```

**Expected Output:**
```
✅ Goose (goose)
   Company: Block (Open Source)
   Logo URL: /tools/goose.png

✅ Aider (aider)
   Company: Open Source
   Logo URL: N/A

✅ Google Gemini CLI (google-gemini-cli)
   Company: Open Source
   Logo URL: N/A

✅ Qwen Code (qwen-code)
   Company: Open Source
   Logo URL: N/A

✨ Verification complete
```

---

## ❌ Troubleshooting

### Logo not displaying
1. Clear browser cache
2. Verify file exists: `ls public/tools/goose.png`
3. Check permissions: `chmod 644 public/tools/goose.png`

### Company showing "N/A"
1. Check database: `npx tsx scripts/verify-goose-data.ts`
2. Re-run update: `npx tsx scripts/update-goose-company.ts`
3. Restart dev server (if caching)

### API returns null
1. Check dev server is running: `lsof -ti:3007`
2. Verify database connection
3. Check API route for errors

---

## 🎯 Success Criteria

- [x] Goose logo file at `/public/tools/goose.png`
- [x] API returns logo_url: `/tools/goose.png`
- [x] API returns company: `"Block (Open Source)"`
- [x] 4 open source tools updated (Goose, Aider, Google Gemini CLI, Qwen Code)
- [x] No "N/A" showing for open source tool companies

---

## 📝 One-Liner Complete Test

```bash
echo "=== GOOSE LOGO & COMPANY FIX VERIFICATION ===" && \
ls -lh public/tools/goose.png > /dev/null 2>&1 && echo "✅ Logo file exists" || echo "❌ Logo file missing" && \
curl -s http://localhost:3007/api/tools/goose/json | jq -e '.tool.logo_url == "/tools/goose.png"' > /dev/null && echo "✅ Logo URL correct" || echo "❌ Logo URL incorrect" && \
curl -s http://localhost:3007/api/tools/goose/json | jq -e '.tool.info.company.name == "Block (Open Source)"' > /dev/null && echo "✅ Company correct" || echo "❌ Company incorrect" && \
curl -s http://localhost:3007/api/tools/aider/json | jq -e '.tool.info.company.name == "Open Source"' > /dev/null && echo "✅ Aider company correct" || echo "❌ Aider company incorrect"
```

**Expected Output:**
```
=== GOOSE LOGO & COMPANY FIX VERIFICATION ===
✅ Logo file exists
✅ Logo URL correct
✅ Company correct
✅ Aider company correct
```
