# API Access for Claude Desktop

This guide explains how to set up API access for Claude Desktop to update tool and company content.

## Setup Instructions

### 1. Enable API Key Authentication

API key authentication has been enabled in the Payload CMS configuration. You'll need to:

1. Start your local development server:
   ```bash
   pnpm dev
   ```

2. Navigate to the Payload admin panel:
   ```
   http://localhost:3000/admin
   ```

3. Go to Users collection and edit your user account

4. Generate an API key (you can use any secure random string)

5. Check "Enable API Key" checkbox

6. Save the user

### 2. API Endpoints

Once you have an API key, you can access the Payload REST API:

#### Base URL
- Local: `http://localhost:3000/api`
- Production: `https://aipowerranking.com/api`

#### Authentication
Include your API key in the Authorization header:
```
Authorization: users API-Key YOUR_API_KEY_HERE
```

#### Available Endpoints

**Tools Collection:**
- GET `/api/tools` - List all tools
- GET `/api/tools/:id` - Get specific tool
- POST `/api/tools` - Create new tool
- PATCH `/api/tools/:id` - Update tool
- DELETE `/api/tools/:id` - Delete tool

**Companies Collection:**
- GET `/api/companies` - List all companies
- GET `/api/companies/:id` - Get specific company
- POST `/api/companies` - Create new company
- PATCH `/api/companies/:id` - Update company
- DELETE `/api/companies/:id` - Delete company

### 3. Example Requests

#### Get all tools:
```bash
curl -X GET http://localhost:3000/api/tools \
  -H "Authorization: users API-Key YOUR_API_KEY_HERE"
```

#### Update a tool:
```bash
curl -X PATCH http://localhost:3000/api/tools/TOOL_ID \
  -H "Authorization: users API-Key YOUR_API_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Tool Name",
    "description": "Updated description"
  }'
```

#### Create a new company:
```bash
curl -X POST http://localhost:3000/api/companies \
  -H "Authorization: users API-Key YOUR_API_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Company",
    "website": "https://example.com",
    "description": "Company description"
  }'
```

### 4. Security Considerations

- **API keys are only visible to admin users**
- **Keep your API key secure** - don't commit it to version control
- **Use environment variables** in Claude Desktop to store the API key
- **Local development only** - For production, consider additional security measures

### 5. Payload API Documentation

For more details on the Payload REST API:
- Query parameters: https://payloadcms.com/docs/rest-api/overview#query-parameters
- Filtering: https://payloadcms.com/docs/queries/overview
- Depth parameter: https://payloadcms.com/docs/rest-api/overview#depth

### 6. Troubleshooting

If you get authentication errors:
1. Ensure your API key is correct
2. Check that "Enable API Key" is checked for your user
3. Verify the Authorization header format: `users API-Key YOUR_KEY`
4. Make sure you're using the correct base URL

### 7. Alternative: Custom API Endpoints

If you need more control, you can create custom API endpoints in `/src/app/api/` that:
- Use the existing CRON_SECRET Bearer token authentication
- Implement custom validation and business logic
- Call Payload's local API internally

Example custom endpoint:
```typescript
// /src/app/api/claude/tools/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@/payload.config";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env["CLAUDE_API_SECRET"]}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await getPayload({ config });
  const data = await req.json();
  
  // Custom logic here
  const result = await payload.create({
    collection: "tools",
    data: data,
  });

  return NextResponse.json(result);
}
```