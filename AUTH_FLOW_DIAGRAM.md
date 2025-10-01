# Authentication & Authorization Flow Diagram

## Complete System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                           │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌──────────────┐      ┌──────────────┐       ┌──────────────┐
│  Sign In/Up  │      │  User Button │       │  Admin Page  │
│   Component  │      │  Component   │       │   Component  │
└──────────────┘      └──────────────┘       └──────────────┘
        │                       │                       │
        │                       │                       │
        └───────────────────────┼───────────────────────┘
                                │
                                ▼
                    ┌──────────────────────┐
                    │   Clerk Provider     │
                    │  (Authentication)    │
                    └──────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    │                       │
                    ▼                       ▼
        ┌─────────────────────┐   ┌──────────────────┐
        │  Public Metadata    │   │   Session Data   │
        │  { isAdmin: true }  │   │   (userId, etc)  │
        └─────────────────────┘   └──────────────────┘
                    │                       │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌──────────────────────┐
                    │   Server-Side Auth   │
                    │   (getAuth, isAdmin) │
                    └──────────────────────┘
                                │
                ┌───────────────┼───────────────┐
                │               │               │
                ▼               ▼               ▼
        ┌──────────┐    ┌──────────┐   ┌──────────┐
        │   Page   │    │   API    │   │Middleware│
        │  Guards  │    │  Routes  │   │  Checks  │
        └──────────┘    └──────────┘   └──────────┘
                │               │               │
                └───────────────┼───────────────┘
                                │
                                ▼
                    ┌──────────────────────┐
                    │      Database        │
                    │  (PostgreSQL/Neon)   │
                    └──────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    │                       │
                    ▼                       ▼
        ┌─────────────────────┐   ┌──────────────────┐
        │ user_preferences    │   │  Other Tables    │
        │ (notifications)     │   │  (tools, news)   │
        └─────────────────────┘   └──────────────────┘
```

---

## User Flow: Regular User

```
1. User visits site
   │
   ▼
2. Clicks "Sign In"
   │
   ▼
3. Clerk Modal Opens
   │
   ▼
4. User authenticates
   │
   ▼
5. Redirected to home page
   │
   ▼
6. Clicks User Button
   │
   ▼
7. Sees "Subscribe for Updates" checkbox
   │
   ▼
8. Toggles checkbox
   │
   ├─► Frontend: Optimistic update
   │
   ├─► API: PUT /api/user/preferences
   │   │
   │   ├─► Auth check (Clerk)
   │   │
   │   ├─► Database update
   │   │
   │   └─► Response with updated preferences
   │
   └─► UI: Shows loading state → Success feedback
```

---

## User Flow: Admin User

```
1. Admin signs in (same as regular user)
   │
   ▼
2. Clerk returns user with metadata:
   {
     userId: "user_xxx",
     publicMetadata: {
       isAdmin: true
     }
   }
   │
   ▼
3. Clicks User Button
   │
   ▼
4. Sees "Admin Dashboard" link (not subscription)
   │
   ▼
5. Clicks "Admin Dashboard"
   │
   ▼
6. Server-side checks:
   ├─► Is authenticated? ✓
   │
   └─► Is admin? ✓
   │
   ▼
7. Admin page renders with full access
```

---

## User Flow: Unauthorized Access Attempt

```
1. Regular user tries to access /admin
   │
   ▼
2. Server-side checks:
   ├─► Is authenticated? ✓
   │
   └─► Is admin? ✗
   │
   ▼
3. Redirect to /unauthorized page
   │
   ▼
4. Shows professional error message
   │
   ├─► "Go to Home" button
   │
   └─► "Go Back" button
```

---

## API Flow: User Preferences

### GET /api/user/preferences

```
Client Request
   │
   ▼
auth() → Get userId from Clerk
   │
   ├─► No userId? → 401 Unauthorized
   │
   ▼ userId found
   │
Database Query:
   SELECT * FROM user_preferences
   WHERE clerk_user_id = userId
   │
   ├─► Found? → Return preferences
   │
   └─► Not found?
       │
       ▼
       INSERT default preferences
       │
       ▼
       Return new preferences
```

### PUT /api/user/preferences

```
Client Request + JSON Body
   │
   ▼
auth() → Get userId from Clerk
   │
   ├─► No userId? → 401 Unauthorized
   │
   ▼ userId found
   │
Validate Request Body
   │
   ├─► Invalid? → 400 Bad Request
   │
   ▼ Valid
   │
Database Query:
   SELECT * FROM user_preferences
   WHERE clerk_user_id = userId
   │
   ├─► Found? → UPDATE preferences
   │
   └─► Not found? → INSERT preferences
   │
   ▼
Return updated preferences
```

---

## Database Schema Relationships

```
┌────────────────────────────────────────────────┐
│            user_preferences                     │
├────────────────────────────────────────────────┤
│ id (PK)                    uuid                │
│ clerk_user_id (unique)     text    ◄───────────┼─── Links to Clerk
│ email_notifications        boolean             │
│ weekly_digest             boolean             │
│ ranking_updates           boolean             │
│ tool_updates              boolean             │
│ news_alerts               boolean             │
│ created_at                timestamp            │
│ updated_at                timestamp            │
└────────────────────────────────────────────────┘
                    │
                    │ One user can have one preferences record
                    │
                    ▼
        ┌───────────────────────┐
        │    Clerk User         │
        ├───────────────────────┤
        │ userId                │
        │ email                 │
        │ publicMetadata:       │
        │   { isAdmin: bool }   │
        └───────────────────────┘
```

---

## Security Layers

```
Layer 1: Client-Side
┌─────────────────────────────────────────────┐
│ - Clerk React components                     │
│ - Conditional rendering based on auth state  │
│ - Not for security, just UX                  │
└─────────────────────────────────────────────┘
                    │
                    ▼
Layer 2: Middleware
┌─────────────────────────────────────────────┐
│ - Clerk middleware intercepts requests      │
│ - Sets up authentication context            │
│ - Protects API routes automatically         │
└─────────────────────────────────────────────┘
                    │
                    ▼
Layer 3: Server Components
┌─────────────────────────────────────────────┐
│ - auth() checks in page components          │
│ - getAuth() for full user data             │
│ - isAdmin() for role verification           │
│ - Redirects before rendering                │
└─────────────────────────────────────────────┘
                    │
                    ▼
Layer 4: API Routes
┌─────────────────────────────────────────────┐
│ - auth() at route handler level             │
│ - Validate all inputs                        │
│ - Check permissions before DB operations    │
│ - Return appropriate status codes           │
└─────────────────────────────────────────────┘
                    │
                    ▼
Layer 5: Database
┌─────────────────────────────────────────────┐
│ - Unique constraints on clerk_user_id       │
│ - Prepared statements (SQL injection safe)  │
│ - Row-level security (if needed)            │
└─────────────────────────────────────────────┘
```

---

## Component Interaction Map

```
┌────────────────────────────────────────────────────────────┐
│                      App Layout                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Clerk Provider                          │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │           Navigation Bar                       │  │  │
│  │  │  ┌─────────────────────────────────────────┐  │  │  │
│  │  │  │      UserButtonWithAdmin               │  │  │  │
│  │  │  │  ┌───────────────────────────────────┐ │  │  │  │
│  │  │  │  │   Clerk UserButton Component     │ │  │  │  │
│  │  │  │  │   ┌────────────────────────────┐ │ │  │  │  │
│  │  │  │  │   │  Menu Items:              │ │ │  │  │  │
│  │  │  │  │   │                           │ │ │  │  │  │
│  │  │  │  │   │  Admin:                   │ │ │  │  │  │
│  │  │  │  │   │  - Admin Dashboard Link   │ │ │  │  │  │
│  │  │  │  │   │                           │ │ │  │  │  │
│  │  │  │  │   │  Regular User:            │ │ │  │  │  │
│  │  │  │  │   │  - Subscribe Checkbox     │ │ │  │  │  │
│  │  │  │  │   │    (SubscriptionMenuItem) │ │ │  │  │  │
│  │  │  │  │   │                           │ │ │  │  │  │
│  │  │  │  │   └────────────────────────────┘ │ │  │  │  │
│  │  │  │  └───────────────────────────────────┘ │  │  │  │
│  │  │  └─────────────────────────────────────────┘  │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  │                                                        │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │              Page Content                      │  │  │
│  │  │                                                 │  │  │
│  │  │  Protected Route: /[lang]/admin                │  │  │
│  │  │  ┌──────────────────────────────────────────┐ │  │  │
│  │  │  │  1. getAuth() → userId                  │ │  │  │
│  │  │  │  2. isAdmin() → check metadata          │ │  │  │
│  │  │  │  3. Render or redirect                  │ │  │  │
│  │  │  └──────────────────────────────────────────┘ │  │  │
│  │  │                                                 │  │  │
│  │  │  Public Route: /[lang]/unauthorized            │  │  │
│  │  │  ┌──────────────────────────────────────────┐ │  │  │
│  │  │  │  - Error message                        │ │  │  │
│  │  │  │  - Navigation buttons                   │ │  │  │
│  │  │  └──────────────────────────────────────────┘ │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

---

## Error Handling Flow

```
User Action (Toggle preference)
   │
   ▼
Optimistic Update (UI changes immediately)
   │
   ▼
API Call (/api/user/preferences)
   │
   ├─► Success (200)
   │   └─► Keep optimistic update
   │
   ├─► Auth Error (401)
   │   ├─► Revert UI change
   │   ├─► Show error message
   │   └─► Suggest sign-in
   │
   ├─► Server Error (500)
   │   ├─► Revert UI change
   │   ├─► Show error message
   │   └─► Log for debugging
   │
   └─► Network Error
       ├─► Revert UI change
       ├─► Show "Failed to update"
       └─► User can retry
```

---

## State Management

```
┌────────────────────────────────────────────┐
│         SubscriptionMenuItem               │
├────────────────────────────────────────────┤
│ State:                                      │
│  - isSubscribed: boolean                   │
│  - isLoading: boolean                      │
│  - error: string | null                    │
│                                             │
│ Effects:                                    │
│  - useEffect on mount → fetchPreferences() │
│                                             │
│ Handlers:                                   │
│  - handleToggle() → API call              │
│    ├─► Optimistic update                   │
│    ├─► API call                            │
│    └─► Revert on error                     │
└────────────────────────────────────────────┘
```

---

## Summary

This architecture provides:
- ✅ Multi-layer security
- ✅ Clean separation of concerns
- ✅ Optimistic UI updates
- ✅ Proper error handling
- ✅ Role-based access control
- ✅ Database persistence
- ✅ Cross-device sync
- ✅ Type-safe implementation
- ✅ Production-ready code
