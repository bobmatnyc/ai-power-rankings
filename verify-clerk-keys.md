# 🔐 Clerk Keys Verification Guide

**Status**: Keys are present and formatted correctly
**Issue**: Need to verify they're from the SAME Clerk application

---

## ✅ Current Key Status

Your `.env.local` has:
- ✅ `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_***` (Test environment)
- ✅ `CLERK_SECRET_KEY=sk_test_***` (Test environment)

Both keys are **test keys** (`pk_test_` and `sk_test_`), which is correct for development.

---

## 🔍 Key Verification Steps

### Step 1: Check Clerk Dashboard

1. Go to: https://dashboard.clerk.com
2. Sign in to your Clerk account
3. Select your **AI Power Ranking** application (or whatever it's called)
4. Go to: **Configure → API Keys**

### Step 2: Verify Keys Match

On the API Keys page, you should see:

**Publishable Key (for Client-Side)**:
```
pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Secret Key (for Server-Side)**:
```
sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Step 3: Compare with .env.local

**CRITICAL CHECK**: The keys in Clerk Dashboard MUST match your `.env.local` EXACTLY.

**To check your current keys**:
```bash
# Show your publishable key
grep "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" .env.local

# Show your secret key
grep "CLERK_SECRET_KEY" .env.local
```

**These should match the keys shown in Clerk Dashboard EXACTLY.**

---

## 🚨 Common Key Mismatch Issues

### Issue 1: Keys from Different Applications

**Symptom**: Session cookies exist but `auth()` returns null

**Cause**: You copied:
- Publishable key from Application A
- Secret key from Application B

**How to Check**:
- In Clerk Dashboard, note the **application name** at the top
- Verify BOTH keys are from this SAME application
- Don't mix keys from different apps!

### Issue 2: Old Keys Still in .env.local

**Symptom**: You updated keys in Clerk but app still using old keys

**Cause**: .env.local not updated or server not restarted

**Fix**:
1. Copy BOTH keys from Clerk Dashboard
2. Update .env.local with BOTH keys
3. Restart dev server: `npm run dev`

### Issue 3: Test vs Production Keys Mixed

**Symptom**: Using `pk_test_` with `sk_live_` or vice versa

**Cause**: Copied test key and production key

**Fix**: Use BOTH test keys for development, BOTH production keys for production

---

## 🧪 Quick Verification Test

### Option 1: Check Key Application ID

The keys contain an encoded application ID. If they're from the same app, they should have matching IDs.

**Run this in your terminal**:
```bash
# Extract the application ID from both keys (they should match)
echo "Publishable Key App ID:"
grep "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" .env.local | cut -d'=' -f2 | cut -d'_' -f3 | cut -d'.' -f1

echo "Secret Key App ID:"
grep "CLERK_SECRET_KEY" .env.local | cut -d'=' -f2 | cut -d'_' -f3 | cut -d'.' -f1
```

**If the output is DIFFERENT**, your keys are from different applications!

### Option 2: Test Authentication

**Create a test user in Clerk**:
1. Go to Clerk Dashboard → Users
2. Create a test user manually
3. Try signing in with these credentials
4. Check middleware logs

If middleware still shows `userId: null` after signing in successfully, the keys are mismatched.

---

## 🔧 How to Fix Key Mismatch

### Step 1: Get Fresh Keys from Clerk

1. Go to Clerk Dashboard
2. Select your application
3. Go to Configure → API Keys
4. **Copy the PUBLISHABLE KEY** (starts with `pk_test_`)
5. **Copy the SECRET KEY** (starts with `sk_test_`)

### Step 2: Update .env.local

Open `.env.local` and replace BOTH keys:

```bash
# Update these lines with the keys you copied
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_YOUR_NEW_KEY_HERE
CLERK_SECRET_KEY=sk_test_YOUR_NEW_KEY_HERE
```

**IMPORTANT**: Update BOTH keys at the same time!

### Step 3: Restart Dev Server

```bash
# Kill current server (Ctrl+C)
# Start fresh server
npm run dev
```

### Step 4: Clear Browser Data

1. Open DevTools (F12)
2. Go to Application → Cookies
3. Delete all `localhost` cookies
4. Reload page

### Step 5: Sign In Again

1. Go to: http://localhost:3000/en/sign-in
2. Sign in with your credentials
3. Try accessing: http://localhost:3000/en/admin
4. Check terminal for middleware logs

---

## 📊 Expected Results After Fix

### If Keys Are Correct

**Middleware logs should show**:
```
[middleware] Processing request: /en/admin
[middleware] Auth data: {
  pathname: '/en/admin',
  userId: 'user_2abc123xyz',    ← ACTUAL USER ID (not null)
  sessionId: 'sess_3def456uvw',  ← ACTUAL SESSION ID
  isProtectedRoute: true,
  headers: { cookie: '__clerk_db_jwt=...; __session=...' }
}
[middleware] Allowing access to: /en/admin
```

**You should**:
- ✅ See actual user ID and session ID
- ✅ Be able to access `/admin` without redirect
- ✅ See the admin dashboard

### If Keys Still Mismatched

**Middleware logs will show**:
```
[middleware] Auth data: {
  userId: 'null',       ← Still null
  sessionId: 'null',    ← Still null
  headers: { cookie: '__clerk_db_jwt=...' }  ← Cookies present but can't decrypt
}
[middleware] Protected route without userId, redirecting to sign-in
```

**This means**:
- ❌ Secret key can't decrypt the cookies created by publishable key
- ❌ Keys are from different applications or environments

---

## 🎯 Verification Checklist

Before asking for help, verify:

- [ ] Both keys are from the SAME Clerk application
- [ ] Both keys are from the SAME environment (both test or both production)
- [ ] Keys in .env.local EXACTLY match Clerk Dashboard
- [ ] Dev server restarted after updating keys
- [ ] Browser cookies cleared after key update
- [ ] Signed in with fresh credentials after key update

---

## 🆘 If Still Not Working

If you've verified all the above and it still doesn't work, check:

### 1. Clerk Application Configuration

**In Clerk Dashboard → Configure**:
- **Development Instance**: URL should be `http://localhost:3000`
- **Session Lifetime**: Should be at least 7 days
- **Multi-Session**: Enabled or disabled (doesn't matter for single app)

### 2. Middleware Configuration

**Check middleware.ts**:
- Make sure `clerkMiddleware` is exported as default
- Verify protected routes include `"/(.*)/admin(.*)"`
- Ensure `config.matcher` includes all routes

### 3. Environment Variable Loading

**Verify Next.js is reading .env.local**:
```bash
# This should output "true" if env vars are loaded
npm run dev | head -20 | grep -q "Environments: .env.local" && echo "✅ .env.local loaded" || echo "❌ Not loaded"
```

---

## 📞 What to Share for Debugging

If still stuck, share:

1. **Clerk Application Type**:
   - Is it a "Development" or "Production" instance?
   - What's the application name in Clerk Dashboard?

2. **Key Prefixes** (NOT full keys):
   ```bash
   # Run this and share output
   grep "CLERK" .env.local | grep -E "KEY" | sed 's/\(.*_test_\)[^\.]*\.\(.*\)/\1***.\2/'
   ```

3. **Middleware Logs**:
   - After signing in, attempt to access `/admin`
   - Copy the complete `[middleware]` log output

4. **Browser Console Output**:
   ```javascript
   // Run in browser console after signing in
   {
     clerkUser: window.Clerk?.user?.id,
     clerkSession: window.Clerk?.session?.id,
     hasCookies: document.cookie.includes('clerk')
   }
   ```

---

**Current Status**: Keys formatted correctly, need to verify they're from same application
**Next Step**: Check Clerk Dashboard and compare keys
