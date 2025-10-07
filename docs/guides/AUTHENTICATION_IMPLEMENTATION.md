# Authentication & Authorization Implementation

This document describes the complete authentication and authorization features implemented for the AI Power Ranking application using Clerk.

## Implementation Date
September 30, 2025

## Overview
Complete authentication and authorization system with user preferences persistence and admin role-based access control.

---

## 1. Database Schema - User Preferences

### Table: `user_preferences`

**Location**: `/lib/db/schema.ts`

Stores user notification preferences linked to Clerk user IDs.

**Columns**:
- `id` (uuid, PK): Auto-generated unique identifier
- `clerk_user_id` (text, unique, not null): Links to Clerk user account
- `email_notifications` (boolean, default: false): Master email notification toggle
- `weekly_digest` (boolean, default: false): Weekly summary emails
- `ranking_updates` (boolean, default: false): Notifications for ranking changes
- `tool_updates` (boolean, default: false): Notifications for tool updates
- `news_alerts` (boolean, default: false): Notifications for news articles
- `created_at` (timestamp, not null): Record creation time
- `updated_at` (timestamp, not null): Last update time

**Indexes**:
- Unique index on `clerk_user_id` for fast lookups

**Migration**: `/lib/db/migrations/0002_add_user_preferences.sql`

---

## 2. API Endpoints - User Preferences

### GET `/api/user/preferences`

**Purpose**: Fetch user preferences, creates default if not exists

**Authentication**: Required (Clerk)

**Response**:
```json
{
  "id": "uuid",
  "clerkUserId": "user_xxx",
  "emailNotifications": false,
  "weeklyDigest": false,
  "rankingUpdates": false,
  "toolUpdates": false,
  "newsAlerts": false,
  "createdAt": "2025-09-30T...",
  "updatedAt": "2025-09-30T..."
}
```

**Status Codes**:
- 200: Success
- 401: Unauthorized
- 500: Server error

---

### PUT `/api/user/preferences`

**Purpose**: Update user preferences

**Authentication**: Required (Clerk)

**Request Body**:
```json
{
  "emailNotifications": true,
  "weeklyDigest": false,
  "rankingUpdates": true,
  "toolUpdates": false,
  "newsAlerts": true
}
```

**Response**: Updated preferences object (same format as GET)

**Status Codes**:
- 200: Success
- 400: Invalid request body
- 401: Unauthorized
- 500: Server error

**Features**:
- Validates only boolean fields
- Auto-creates preferences if they don't exist
- Updates `updatedAt` timestamp automatically
- Allows partial updates (only specified fields)

---

## 3. User Button Integration

### Component: `UserButtonWithAdmin`

**Location**: `/components/auth/user-button-with-admin.tsx`

**Changes**:
- Replaced localStorage with API calls for persistence
- Added loading states during API requests
- Added error handling with user feedback
- Preferences now sync across devices (database-backed)

**Features**:
- **For Regular Users**: Shows "Subscribe for Updates" checkbox
  - Fetches preferences on mount
  - Updates via API on toggle
  - Shows loading state during operations
  - Displays error messages if API fails
  - Optimistic updates with rollback on error

- **For Admin Users**: Shows "Admin Dashboard" link
  - Links to `/[lang]/admin`
  - Icon: Shield icon
  - Only visible when `user.publicMetadata.isAdmin === true`

---

## 4. Admin Access Control

### Enhanced Admin Page

**Location**: `/app/[lang]/admin/page.tsx`

**Changes**:
1. Added `isAdmin()` check from auth helper
2. Redirects to `/[lang]/unauthorized` if not admin
3. Two-layer security:
   - Layer 1: Authentication check (must be signed in)
   - Layer 2: Authorization check (must have admin role)

**Flow**:
```
User → Admin Page
  ↓
Is Authenticated? → No → Redirect to /[lang]/sign-in
  ↓ Yes
Is Admin? → No → Redirect to /[lang]/unauthorized
  ↓ Yes
Show Admin Dashboard
```

---

### Unauthorized Access Page

**Location**: `/app/[lang]/unauthorized/page.tsx`

**Features**:
- Clean, professional design
- Clear error message
- Action buttons:
  - "Go to Home" - Returns to homepage
  - "Go Back" - Browser back navigation
- Helpful information box
- Responsive layout
- Dark mode support

**When Shown**:
- User is authenticated but not an admin
- Tries to access `/[lang]/admin` or other admin routes
- Clear explanation of why access was denied

---

## 5. Authentication Helper Functions

**Location**: `/lib/auth-helper.ts`

**Functions Used**:
- `getAuth()`: Gets user authentication data with metadata
- `isAuthenticated()`: Checks if user is signed in
- `isAdmin()`: Checks if user has admin role

**Admin Role Check**:
```typescript
const isUserAdmin = user.publicMetadata?.isAdmin === true;
```

**Setting Admin Role** (via Clerk Dashboard):
1. Go to Clerk Dashboard
2. Select user
3. Add public metadata:
   ```json
   {
     "isAdmin": true
   }
   ```

---

## 6. Security Features

### Authentication
- Uses Clerk for secure authentication
- Server-side auth checks (not just client-side)
- Protected API routes with `auth()` middleware
- No sensitive data in client-side code

### Authorization
- Role-based access control (RBAC)
- Admin role stored in Clerk public metadata
- Server-side role verification before page render
- Clear separation between authenticated and admin routes

### Data Protection
- User preferences linked to Clerk user ID
- Database-level unique constraints
- API validates all inputs
- Prepared statements prevent SQL injection
- No user can access other users' preferences

---

## 7. Testing

### Manual Testing Checklist

**User Preferences**:
- [ ] Sign in as regular user
- [ ] Click user button, see "Subscribe for Updates"
- [ ] Toggle checkbox, verify it saves
- [ ] Refresh page, verify preference persists
- [ ] Sign out and back in, verify preference persists
- [ ] Check error handling (disconnect network, try toggle)

**Admin Access**:
- [ ] Sign in as admin user
- [ ] Click user button, see "Admin Dashboard" link
- [ ] Click link, verify admin page loads
- [ ] Sign out, try to access `/[lang]/admin` directly
- [ ] Verify redirect to sign-in page

**Unauthorized Access**:
- [ ] Sign in as regular user (non-admin)
- [ ] Try to access `/[lang]/admin`
- [ ] Verify redirect to unauthorized page
- [ ] Click "Go to Home", verify navigation
- [ ] Click "Go Back", verify navigation

### Automated Testing

**Database Tests**:
```bash
npx ts-node scripts/test-user-preferences.ts
```

Tests:
1. Create user preferences
2. Fetch preferences
3. Update preferences
4. Delete preferences (cleanup)

---

## 8. Database Migration

### Running the Migration

**Manual Migration** (if needed):
```sql
-- Run the SQL from /lib/db/migrations/0002_add_user_preferences.sql
```

**Using Drizzle Kit** (if installed):
```bash
npm install -D drizzle-kit
npx drizzle-kit push
```

### Verifying Migration

Check if table exists:
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'user_preferences';
```

Check table structure:
```sql
\d user_preferences
```

---

## 9. API Usage Examples

### Fetching Preferences (Client-Side)

```typescript
const response = await fetch('/api/user/preferences');
if (response.ok) {
  const preferences = await response.json();
  console.log('User preferences:', preferences);
}
```

### Updating Preferences (Client-Side)

```typescript
const response = await fetch('/api/user/preferences', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    emailNotifications: true,
    weeklyDigest: true,
  }),
});

if (response.ok) {
  const updatedPreferences = await response.json();
  console.log('Updated:', updatedPreferences);
}
```

---

## 10. Future Enhancements

### Potential Additions
1. **Email Integration**: Actually send emails based on preferences
2. **Preference Categories**: Group preferences by type
3. **Notification History**: Track what notifications were sent
4. **Frequency Controls**: Allow users to set notification frequency
5. **Preference Presets**: Quick preset configurations
6. **Admin Management UI**: Manage all users' preferences
7. **Audit Logging**: Track preference changes
8. **Bulk Operations**: Update multiple preferences at once
9. **Export/Import**: Allow users to backup/restore preferences
10. **Advanced Permissions**: More granular role system

### Code Improvements
1. Add more comprehensive error types
2. Implement rate limiting on API routes
3. Add request validation with Zod schemas
4. Implement caching for frequently accessed preferences
5. Add pagination for admin user management
6. Create reusable preference hooks
7. Add unit tests for API routes
8. Add E2E tests for auth flows

---

## 11. Troubleshooting

### Common Issues

**Issue**: Preferences not saving
- Check: Is user authenticated? (Check browser console for auth errors)
- Check: Is database connected? (Check server logs)
- Check: Are there any CORS issues? (Check network tab)

**Issue**: Admin redirect loop
- Check: Is `isAdmin` metadata set correctly in Clerk?
- Check: Is middleware properly configured?
- Check: Are cookies enabled?

**Issue**: Unauthorized page showing for admins
- Check: Clerk public metadata for `isAdmin: true`
- Check: Server logs for auth errors
- Check: Environment variables are loaded

**Issue**: API returns 401
- Check: User is signed in
- Check: Clerk is properly initialized
- Check: Session is valid (not expired)

---

## 12. Configuration

### Environment Variables Required

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx

# Database
DATABASE_URL=postgresql://...
DATABASE_URL_DEVELOPMENT=postgresql://... # Optional for dev branch
```

### Clerk Configuration

**Public Metadata Schema** (for admin users):
```json
{
  "isAdmin": true
}
```

**Sign-in/Sign-up URLs**:
- Sign-in: `/[lang]/sign-in`
- Sign-up: `/[lang]/sign-up`
- After sign-in: `/[lang]`
- After sign-up: `/[lang]`

---

## Summary

This implementation provides:
- ✅ Complete user preference system with database persistence
- ✅ Secure API endpoints for preference management
- ✅ Seamless integration with Clerk authentication
- ✅ Role-based admin access control
- ✅ Professional unauthorized access handling
- ✅ Production-ready error handling and loading states
- ✅ Type-safe TypeScript implementation
- ✅ Database migration and schema
- ✅ Testing utilities

All features are production-ready and follow Next.js 14+ best practices with App Router patterns.
