# API Authentication Reference

**Version**: v0.1.3+
**Last Updated**: 2025-10-17
**For**: Backend Developers, API Developers

---

## Overview

This document provides a comprehensive reference for implementing authentication and authorization in API routes using the AI Power Ranking authentication utilities.

### Authentication Utilities Location

**File**: `lib/api-auth.ts`

### Available Functions

1. `requireAuth()` - Require basic authentication
2. `requireAdmin()` - Require admin privileges
3. `optionalAuth()` - Optional authentication (public APIs with user context)

---

## Table of Contents

1. [requireAuth() - Basic Authentication](#requireauth---basic-authentication)
2. [requireAdmin() - Admin Authorization](#requireadmin---admin-authorization)
3. [optionalAuth() - Optional Authentication](#optionalauth---optional-authentication)
4. [Error Handling](#error-handling)
5. [Metadata Structure](#metadata-structure)
6. [Usage Examples](#usage-examples)
7. [Best Practices](#best-practices)
8. [Testing](#testing)

---

## requireAuth() - Basic Authentication

### Purpose

Ensures a user is authenticated before allowing access to an API endpoint. Returns user ID if authenticated, or an error response if not.

### Function Signature

```typescript
async function requireAuth(): Promise<{
  userId: string | null;
  error: NextResponse | null;
}>
```

### Return Values

**Success** (User Authenticated):
```typescript
{
  userId: "user_2abcdef123456",  // Clerk user ID
  error: null
}
```

**Failure** (Not Authenticated):
```typescript
{
  userId: null,
  error: NextResponse  // HTTP 401 Unauthorized response
}
```

### Error Response Format

**HTTP 401 Unauthorized**:
```json
{
  "error": "Unauthorized",
  "message": "Authentication required",
  "code": "AUTH_REQUIRED"
}
```

**HTTP 503 Service Unavailable** (if auth service fails):
```json
{
  "error": "Authentication service unavailable",
  "message": "The authentication service is not properly configured",
  "code": "AUTH_SERVICE_ERROR",
  "details": "Error message (dev only)"
}
```

### Basic Usage

```typescript
// app/api/protected/route.ts
import { requireAuth } from "@/lib/api-auth";
import { NextResponse } from "next/server";

export async function GET() {
  // Require authentication
  const { userId, error } = await requireAuth();
  if (error) return error;

  // User is authenticated, proceed with logic
  return NextResponse.json({
    message: "Success",
    userId,
    data: "Protected data here"
  });
}
```

### When to Use

- ✅ User-specific API endpoints (e.g., `/api/user/profile`)
- ✅ Protected resources requiring authentication
- ✅ Any endpoint that needs to know WHO is making the request
- ✅ Endpoints that should be inaccessible to anonymous users

### When NOT to Use

- ❌ Public API endpoints (use `optionalAuth()` instead)
- ❌ Admin-only endpoints (use `requireAdmin()` instead)
- ❌ Webhooks (use signature verification instead)
- ❌ Health check endpoints

---

## requireAdmin() - Admin Authorization

### Purpose

Ensures a user is authenticated AND has admin privileges. Returns user ID and full user object if authorized, or error response if not.

### Function Signature

```typescript
async function requireAdmin(): Promise<{
  userId: string | null;
  user: User | null;
  error: NextResponse | null;
}>
```

### Return Values

**Success** (Authenticated Admin):
```typescript
{
  userId: "user_2abcdef123456",
  user: {
    id: "user_2abcdef123456",
    privateMetadata: { isAdmin: true },
    emailAddresses: [{ emailAddress: "admin@example.com" }],
    firstName: "John",
    lastName: "Doe",
    // ... other Clerk user properties
  },
  error: null
}
```

**Failure** (Not Authenticated):
```typescript
{
  userId: null,
  user: null,
  error: NextResponse  // HTTP 401 Unauthorized
}
```

**Failure** (Authenticated but Not Admin):
```typescript
{
  userId: null,
  user: null,
  error: NextResponse  // HTTP 403 Forbidden
}
```

### Error Response Formats

**HTTP 401 Unauthorized** (Not Authenticated):
```json
{
  "error": "Unauthorized",
  "message": "Authentication required",
  "code": "AUTH_REQUIRED"
}
```

**HTTP 403 Forbidden** (Not Admin):
```json
{
  "error": "Forbidden",
  "message": "Admin privileges required",
  "code": "ADMIN_REQUIRED",
  "userId": "user_2abcdef123456"
}
```

**HTTP 404 Not Found** (User Not Found):
```json
{
  "error": "User not found",
  "message": "Unable to retrieve user information",
  "code": "USER_NOT_FOUND"
}
```

### Basic Usage

```typescript
// app/api/admin/tools/route.ts
import { requireAdmin } from "@/lib/api-auth";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  // Require admin privileges
  const { userId, user, error } = await requireAdmin();
  if (error) return error;

  // User is admin, proceed with admin operations
  const body = await req.json();

  // Perform admin action
  // ...

  return NextResponse.json({
    success: true,
    message: "Tool created successfully"
  });
}
```

### Advanced Usage (Accessing User Metadata)

```typescript
export async function GET() {
  const { userId, user, error } = await requireAdmin();
  if (error) return error;

  // Access user information
  const adminEmail = user.emailAddresses[0]?.emailAddress;
  const adminName = `${user.firstName} ${user.lastName}`;

  // Log admin action
  console.log(`[AUDIT] Admin ${adminName} (${adminEmail}) accessed sensitive data`);

  return NextResponse.json({
    data: "Sensitive admin data",
    accessedBy: adminEmail
  });
}
```

### When to Use

- ✅ Admin-only API endpoints (e.g., `/api/admin/users`)
- ✅ Endpoints that modify system configuration
- ✅ Endpoints that access sensitive data
- ✅ Administrative operations (delete, bulk updates, etc.)
- ✅ Audit logging (need admin user details)

### When NOT to Use

- ❌ Regular user endpoints (use `requireAuth()`)
- ❌ Public endpoints (use `optionalAuth()` or no auth)
- ❌ If you don't need the full user object (use `requireAuth()`)

---

## optionalAuth() - Optional Authentication

### Purpose

Allows both authenticated and unauthenticated access to an API endpoint. Useful for public APIs that provide different data based on authentication state.

### Function Signature

```typescript
async function optionalAuth(): Promise<{
  userId: string | null;
  error: null;
}>
```

### Return Values

**Authenticated User**:
```typescript
{
  userId: "user_2abcdef123456",
  error: null
}
```

**Unauthenticated User**:
```typescript
{
  userId: null,
  error: null
}
```

**Note**: This function NEVER returns an error response. It gracefully handles both authenticated and unauthenticated states.

### Basic Usage

```typescript
// app/api/public/news/route.ts
import { optionalAuth } from "@/lib/api-auth";
import { NextResponse } from "next/server";

export async function GET() {
  // Check if user is authenticated (but don't require it)
  const { userId } = await optionalAuth();

  if (userId) {
    // User is signed in - return personalized content
    return NextResponse.json({
      news: getPersonalizedNews(userId),
      personalized: true
    });
  } else {
    // User is not signed in - return generic content
    return NextResponse.json({
      news: getGenericNews(),
      personalized: false
    });
  }
}
```

### Advanced Usage (Conditional Features)

```typescript
export async function GET(req: Request) {
  const { userId } = await optionalAuth();

  // Base data available to everyone
  const data = {
    tools: getAllTools(),
    totalCount: 100
  };

  // Add extra features for authenticated users
  if (userId) {
    data.favorites = await getUserFavorites(userId);
    data.recommendations = await getPersonalizedRecommendations(userId);
  }

  return NextResponse.json(data);
}
```

### When to Use

- ✅ Public APIs with optional personalization
- ✅ Endpoints that serve both logged-in and anonymous users
- ✅ Analytics endpoints (track auth vs non-auth usage)
- ✅ Conditional feature access based on authentication
- ✅ Freemium models (different data for authenticated users)

### When NOT to Use

- ❌ Endpoints that MUST be authenticated (use `requireAuth()`)
- ❌ Admin-only endpoints (use `requireAdmin()`)
- ❌ When you need to guarantee user identity

---

## Error Handling

### Error Response Structure

All authentication errors follow this format:

```typescript
{
  error: string;      // Error type
  message: string;    // Human-readable message
  code: string;       // Error code for client handling
  details?: string;   // Additional details (dev only)
  userId?: string;    // User ID (for 403 Forbidden only)
}
```

### HTTP Status Codes

| Status Code | Meaning | When Used |
|-------------|---------|-----------|
| **401 Unauthorized** | Authentication required | No valid session/token |
| **403 Forbidden** | Insufficient privileges | Authenticated but not authorized |
| **404 Not Found** | User not found | User ID exists but user data unavailable |
| **500 Internal Server Error** | Server error | Unexpected authentication failure |
| **503 Service Unavailable** | Auth service down | Clerk SDK unavailable |

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `AUTH_REQUIRED` | 401 | Authentication required |
| `ADMIN_REQUIRED` | 403 | Admin privileges required |
| `USER_NOT_FOUND` | 404 | User not found in system |
| `AUTH_ERROR` | 500 | General authentication error |
| `AUTH_SERVICE_ERROR` | 503 | Clerk service unavailable |
| `AUTH_RUNTIME_ERROR` | 503 | Runtime error (useContext issues) |

### Client-Side Error Handling

```typescript
// Example: Frontend API call with error handling
async function fetchProtectedData() {
  try {
    const response = await fetch('/api/protected');

    if (!response.ok) {
      const error = await response.json();

      switch (error.code) {
        case 'AUTH_REQUIRED':
          // Redirect to sign-in
          window.location.href = '/sign-in';
          break;

        case 'ADMIN_REQUIRED':
          // Show "insufficient permissions" message
          showError("You don't have permission to access this resource");
          break;

        case 'AUTH_SERVICE_ERROR':
          // Show service unavailable message
          showError("Authentication service is temporarily unavailable");
          break;

        default:
          // Generic error handling
          showError(error.message);
      }

      return null;
    }

    return await response.json();
  } catch (err) {
    console.error('API call failed:', err);
    showError('Network error');
    return null;
  }
}
```

---

## Metadata Structure

### User Metadata in Clerk

Clerk provides two types of metadata:

#### 1. Public Metadata (Client-Accessible) ❌ NOT USED FOR AUTH

**Access**: Available client-side and server-side
**Security**: ⚠️ Can be read by client JavaScript
**Use Cases**: User preferences, settings, non-sensitive data

**Structure**:
```typescript
publicMetadata: {
  theme: "dark",
  language: "en",
  notifications: true
  // NEVER store isAdmin here!
}
```

#### 2. Private Metadata (Server-Only) ✅ USED FOR AUTH

**Access**: Server-side only (never exposed to client)
**Security**: ✅ Secure, cannot be tampered with by users
**Use Cases**: Authorization, roles, sensitive flags

**Structure**:
```typescript
privateMetadata: {
  isAdmin: true,           // Admin flag
  role: "super_admin",     // Role designation
  permissions: ["read", "write", "delete"],
  departmentId: "eng_001"
}
```

### Setting Admin Status

**In Clerk Dashboard**:

1. Navigate to: **Users** → Select User → **Metadata** tab
2. Add to **Private Metadata** (NOT Public Metadata):
   ```json
   {
     "isAdmin": true
   }
   ```
3. Click **Save**

**Verification**:
```typescript
// In API route
const { user, error } = await requireAdmin();
if (error) return error;

console.log(user.privateMetadata.isAdmin); // → true
console.log(user.publicMetadata.isAdmin);  // → undefined (correct!)
```

### Accessing Metadata in API Routes

**Private Metadata** (Admin Check):
```typescript
const { user, error } = await requireAdmin();
if (error) return error;

const isAdmin = user.privateMetadata?.isAdmin === true;
const role = user.privateMetadata?.role || "user";
```

**Public Metadata** (User Preferences):
```typescript
const { user, error } = await requireAdmin();
if (error) return error;

const theme = user.publicMetadata?.theme || "light";
const language = user.publicMetadata?.language || "en";
```

---

## Usage Examples

### Example 1: Basic Protected Endpoint

```typescript
// app/api/user/profile/route.ts
import { requireAuth } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  // Require authentication
  const { userId, error } = await requireAuth();
  if (error) return error;

  // Fetch user profile from database
  const profile = await db.userProfile.findUnique({
    where: { clerkUserId: userId }
  });

  if (!profile) {
    return NextResponse.json(
      { error: "Profile not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    profile: {
      name: profile.name,
      email: profile.email,
      bio: profile.bio
    }
  });
}
```

---

### Example 2: Admin-Only CRUD Endpoint

```typescript
// app/api/admin/tools/route.ts
import { requireAdmin } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET all tools (admin view with sensitive data)
export async function GET() {
  const { userId, user, error } = await requireAdmin();
  if (error) return error;

  const tools = await db.tool.findMany({
    include: {
      internalNotes: true,  // Admin-only field
      usage: true           // Admin-only stats
    }
  });

  // Log admin access
  console.log(`[AUDIT] Admin ${user.emailAddresses[0]?.emailAddress} accessed tools list`);

  return NextResponse.json({ tools });
}

// POST create new tool (admin only)
export async function POST(req: Request) {
  const { userId, user, error } = await requireAdmin();
  if (error) return error;

  const body = await req.json();

  // Validate input
  if (!body.name || !body.category) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  // Create tool
  const tool = await db.tool.create({
    data: {
      name: body.name,
      category: body.category,
      createdBy: userId
    }
  });

  // Log admin action
  console.log(`[AUDIT] Admin ${user.emailAddresses[0]?.emailAddress} created tool: ${tool.name}`);

  return NextResponse.json({
    success: true,
    tool
  });
}

// DELETE tool (admin only)
export async function DELETE(req: Request) {
  const { userId, user, error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const toolId = searchParams.get('id');

  if (!toolId) {
    return NextResponse.json(
      { error: "Tool ID required" },
      { status: 400 }
    );
  }

  await db.tool.delete({ where: { id: toolId } });

  // Log admin action
  console.log(`[AUDIT] Admin ${user.emailAddresses[0]?.emailAddress} deleted tool ID: ${toolId}`);

  return NextResponse.json({ success: true });
}
```

---

### Example 3: Public API with Optional Personalization

```typescript
// app/api/rankings/current/route.ts
import { optionalAuth } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  // Optional authentication
  const { userId } = await optionalAuth();

  // Get base rankings (public data)
  const rankings = await db.ranking.findMany({
    where: { published: true },
    include: {
      tool: {
        select: {
          name: true,
          category: true,
          description: true,
          logo: true
        }
      }
    }
  });

  // If user is authenticated, add personalized data
  if (userId) {
    // Get user favorites
    const favorites = await db.favorite.findMany({
      where: { userId },
      select: { toolId: true }
    });

    const favoriteIds = new Set(favorites.map(f => f.toolId));

    // Mark favorites in rankings
    const personalizedRankings = rankings.map(ranking => ({
      ...ranking,
      isFavorite: favoriteIds.has(ranking.toolId)
    }));

    return NextResponse.json({
      rankings: personalizedRankings,
      personalized: true,
      userId
    });
  }

  // Return public rankings for non-authenticated users
  return NextResponse.json({
    rankings,
    personalized: false
  });
}
```

---

### Example 4: Mixed Access Endpoint (Different Data for Admins)

```typescript
// app/api/tools/[id]/route.ts
import { optionalAuth } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser } from "@clerk/nextjs/server";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  // Optional auth (works for everyone)
  const { userId } = await optionalAuth();

  // Get base tool data (public)
  const tool = await db.tool.findUnique({
    where: { id: params.id }
  });

  if (!tool) {
    return NextResponse.json(
      { error: "Tool not found" },
      { status: 404 }
    );
  }

  // Base response
  const response = {
    id: tool.id,
    name: tool.name,
    description: tool.description,
    category: tool.category,
    website: tool.website
  };

  // If authenticated, add user-specific data
  if (userId) {
    const user = await currentUser();
    const isAdmin = user?.privateMetadata?.isAdmin === true;

    // Add authenticated user features
    const favorite = await db.favorite.findFirst({
      where: { userId, toolId: tool.id }
    });

    response.isFavorite = !!favorite;

    // Add admin-only data
    if (isAdmin) {
      response.internalNotes = tool.internalNotes;
      response.usageStats = await db.toolUsage.findMany({
        where: { toolId: tool.id }
      });
      response.createdBy = tool.createdBy;
    }
  }

  return NextResponse.json(response);
}
```

---

## Best Practices

### 1. Choose the Right Auth Function

```typescript
// ✅ GOOD: Use requireAuth for user-specific endpoints
export async function GET() {
  const { userId, error } = await requireAuth();
  if (error) return error;
  // User-specific logic
}

// ❌ BAD: Using requireAdmin when requireAuth is sufficient
export async function GET() {
  const { userId, user, error } = await requireAdmin();  // Overkill!
  if (error) return error;
  // Not using admin privileges
}
```

---

### 2. Always Check for Errors First

```typescript
// ✅ GOOD: Check error immediately
export async function GET() {
  const { userId, error } = await requireAuth();
  if (error) return error;  // ← Return error BEFORE using userId

  // Safe to use userId here
  const data = await fetchUserData(userId);
}

// ❌ BAD: Not checking error
export async function GET() {
  const { userId } = await requireAuth();
  const data = await fetchUserData(userId);  // ← userId might be null!
}
```

---

### 3. Use privateMetadata for Authorization

```typescript
// ✅ GOOD: Admin check using privateMetadata
const { user, error } = await requireAdmin();
if (error) return error;

const isAdmin = user.privateMetadata?.isAdmin === true;

// ❌ BAD: Admin check using publicMetadata (SECURITY ISSUE!)
const isAdmin = user.publicMetadata?.isAdmin === true;  // ❌ Client can see this!
```

---

### 4. Log Admin Actions

```typescript
// ✅ GOOD: Audit logging for admin actions
export async function DELETE(req: Request) {
  const { userId, user, error } = await requireAdmin();
  if (error) return error;

  const adminEmail = user.emailAddresses[0]?.emailAddress;

  // Perform admin action
  await db.tool.delete({ where: { id: toolId } });

  // Log for audit trail
  console.log(`[AUDIT] Admin ${adminEmail} (${userId}) deleted tool ${toolId}`);
}
```

---

### 5. Graceful Error Messages

```typescript
// ✅ GOOD: Helpful error messages
if (!body.name) {
  return NextResponse.json(
    { error: "Tool name is required" },
    { status: 400 }
  );
}

// ❌ BAD: Vague error messages
if (!body.name) {
  return NextResponse.json({ error: "Bad request" }, { status: 400 });
}
```

---

### 6. Use TypeScript Types

```typescript
// ✅ GOOD: Type-safe requests
interface CreateToolRequest {
  name: string;
  category: string;
  description?: string;
}

export async function POST(req: Request) {
  const { userId, error } = await requireAuth();
  if (error) return error;

  const body: CreateToolRequest = await req.json();

  // TypeScript validates structure
  const tool = await db.tool.create({
    data: {
      name: body.name,          // Type-safe
      category: body.category,  // Type-safe
      userId
    }
  });
}
```

---

## Testing

### Manual Testing with cURL

**Test Unauthenticated Access** (should fail):
```bash
curl -X GET http://localhost:3000/api/protected

# Expected: HTTP 401 Unauthorized
# {
#   "error": "Unauthorized",
#   "message": "Authentication required",
#   "code": "AUTH_REQUIRED"
# }
```

**Test Admin Endpoint** (should fail for non-admin):
```bash
curl -X GET http://localhost:3000/api/admin/tools

# Expected: HTTP 401 or 403
```

**Test Authenticated Access**:
```bash
# 1. Sign in via browser
# 2. Copy session cookie from DevTools (Application → Cookies → __session)
# 3. Use in cURL:

curl -X GET http://localhost:3000/api/protected \
  -H "Cookie: __session=YOUR_SESSION_COOKIE_HERE"

# Expected: HTTP 200 OK with data
```

---

### Automated Testing (Playwright/Vitest)

```typescript
// tests/api/auth.test.ts
import { test, expect } from '@playwright/test';

test('protected endpoint requires authentication', async ({ request }) => {
  const response = await request.get('/api/protected');

  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body.code).toBe('AUTH_REQUIRED');
});

test('admin endpoint requires admin privileges', async ({ request }) => {
  const response = await request.get('/api/admin/tools');

  expect(response.status()).toBeGreaterThanOrEqual(401);
  expect(response.status()).toBeLessThanOrEqual(403);
});
```

---

## Related Documentation

- [Complete Authentication Guide](CLERK-AUTHENTICATION-COMPLETE-GUIDE.md) - Full implementation details
- [Security Hardening Report](../security/CLERK-SECURITY-HARDENING-2025-10-17.md) - Security best practices
- [Quick Start Guide](../development/CLERK-AUTHENTICATION-QUICKSTART.md) - Setup guide
- [Deployment Checklist](../deployment/CLERK-AUTHENTICATION-DEPLOYMENT.md) - Production deployment

---

**Last Updated**: 2025-10-17
**Maintained By**: Backend Team
**Review Status**: Production Ready
