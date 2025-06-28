---
id: T-013
title: Convert all newsletter/subscriber endpoints to JSON
status: completed
priority: high
assignee: bobmatnyc
created: 2025-01-28
updated: 2025-01-28
labels: [backend, api, migration]
depends_on: [T-012]
---

# Convert all newsletter/subscriber endpoints to JSON

## Description
Convert all newsletter and subscriber management endpoints from Payload CMS to JSON repository with temporary storage strategy:
- **Development**: Local file directory storage
- **Production**: Vercel Blob storage (temporary measure)
- **Future**: Will move back to database later

## Affected Endpoints
- `/api/newsletter/subscribe/route.ts`
- `/api/newsletter/unsubscribe/route.ts`
- `/api/newsletter/verify/[token]/route.ts`
- `/api/admin/subscribers/route.ts`
- `/api/admin/subscribers/export/route.ts`
- `/api/admin/subscribers/[id]/test-email/route.ts`

## Storage Strategy
```typescript
// Development: Local files
const isDev = process.env.NODE_ENV === 'development';
const storage = isDev ? 'local' : 'blob';
```

## Tasks
- [x] Update SubscribersRepository to support blob storage in production
- [x] Update subscribe endpoint to use SubscribersRepository
- [x] Update unsubscribe endpoint
- [x] Update verification endpoint
- [x] Update admin list/manage endpoints
- [x] Update export functionality
- [x] Update test email functionality

## Completed Work
✅ **COMPLETED** - All newsletter/subscriber endpoints converted to JSON repository with hybrid storage:

### Updated Endpoints
- `/api/newsletter/subscribe/route.ts` - Uses SubscribersRepository.create() with metadata storage
- `/api/newsletter/unsubscribe/route.ts` - Uses SubscribersRepository for token-based unsubscribe
- `/api/newsletter/verify/[token]/route.ts` - Uses SubscribersRepository.verifyWithToken()
- `/api/admin/subscribers/route.ts` - Uses SubscribersRepository.getAll() and getStatistics()
- `/api/admin/subscribers/export/route.ts` - Uses SubscribersRepository.exportToCsv()
- `/api/admin/subscribers/[id]/test-email/route.ts` - Uses SubscribersRepository.getById()

### Storage Implementation
- **Development**: Local JSON files in `/data/json/subscribers/`
- **Production**: Vercel Blob storage (temporary measure)
- **Schema**: Extended to support firstName/lastName in metadata
- **Features**: Email validation, verification tokens, statistics, CSV export

### Key Improvements
- Zero Payload CMS dependency for subscriber management
- Hybrid storage strategy for development/production
- Maintained all existing email verification functionality
- Preserved CSV export format
- Added proper TypeScript typing throughout

## Implementation Notes
- Maintain existing email sending functionality
- Preserve verification token logic
- Keep CSV export format unchanged
- Use Vercel Blob for production as temporary measure