# 404 Error Fix Checklist

**Priority Order**: Fix in this sequence to restore authentication

---

## 🔴 CRITICAL - Fix Immediately (Breaks Authentication)

### 1. Restore Clerk Sign-In Route
```bash
mkdir -p app/[lang]/sign-in/[[...sign-in]]
```

Create file: `/app/[lang]/sign-in/[[...sign-in]]/page.tsx`
```typescript
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn />
    </div>
  );
}
```

### 2. Restore Clerk Sign-Up Route
```bash
mkdir -p app/[lang]/sign-up/[[...sign-up]]
```

Create file: `/app/[lang]/sign-up/[[...sign-up]]/page.tsx`
```typescript
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignUp />
    </div>
  );
}
```

### 3. Verify Environment Variables
Check `.env.local` and `.env.production` have:
```bash
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/admin
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/admin
```

### 4. Test Authentication Flow
- [ ] Visit `/en/sign-in` - should show Clerk sign-in form
- [ ] Visit `/en/sign-up` - should show Clerk sign-up form  
- [ ] Visit `/en/admin` (not logged in) - should redirect to sign-in
- [ ] Sign in successfully - should redirect to admin dashboard
- [ ] Visit `/ja/sign-in` - should work for Japanese locale

---

## 🟡 MEDIUM - Verify Production Behavior

### 5. Test Trending Page
- [ ] Visit `/en/trending` - verify page loads without errors
- [ ] Check that historical trends data displays correctly
- [ ] If broken, either fix or remove sidebar link (line 234 in app-sidebar.tsx)

### 6. Test Contact Redirect
- [ ] Visit `/en/contact` - should redirect to `/en/contact/default`
- [ ] Verify contact form displays correctly
- [ ] Test form submission works
- [ ] If redirect causes issues, consider simplifying contact/page.tsx

---

## 🟢 LOW - Documentation Cleanup

### 7. Update Documentation
- [ ] Search docs for references to deleted test routes
- [ ] Update authentication setup guides
- [ ] Archive outdated troubleshooting docs
- [ ] Create migration guide for route changes

---

## Verification Commands

```bash
# Check sign-in route exists
ls -la app/[lang]/sign-in/[[...sign-in]]/page.tsx

# Check sign-up route exists  
ls -la app/[lang]/sign-up/[[...sign-up]]/page.tsx

# Verify environment variables
grep CLERK_SIGN_IN_URL .env.local

# Check for any remaining broken links
grep -r "href=.*sign-in" components/ app/
```

---

## Success Criteria

✅ **Authentication Working**
- Unauthenticated users can access sign-in page
- Sign-in redirects to admin after authentication
- Admin page is protected and accessible to authenticated users
- No 404 errors on auth routes

✅ **Navigation Working**  
- All sidebar links resolve to valid pages
- Footer links work correctly
- Contact form flow completes successfully

✅ **Production Clean**
- No 404 errors in Vercel logs
- All middleware routes resolve correctly
- Documentation is up-to-date

---

**Next Steps After Fix**: 
1. Deploy to production
2. Monitor 404 rates in Vercel Analytics
3. Run E2E auth tests
4. Update route testing checklist
