# Rate Limiting Documentation

## Overview

The AI Power Rankings platform implements rate limiting for the contact form to prevent spam submissions and ensure system stability. This document describes the implementation, configuration, and management of rate limiting features.

## Implementation Details

### Core Components

1. **Rate Limiting Library** (`src/lib/rate-limit.ts`)
   - Implements rate limiting logic using Upstash Ratelimit
   - Uses Vercel KV for storage
   - Supports IP-based and email-based rate limiting

2. **Contact API Integration** (`src/app/api/contact/route.ts`)
   - Checks rate limits before processing contact form submissions
   - Returns appropriate HTTP status codes and headers
   - Includes rate limit information in responses

3. **Admin Management API** (`src/app/api/admin/rate-limit/route.ts`)
   - Provides endpoints for monitoring and managing rate limits
   - Supports analytics and rate limit resets

4. **Frontend Integration** (`src/components/contact/contact-form.tsx`)
   - Handles rate limit errors gracefully
   - Displays user-friendly error messages
   - Disables form submission when rate limited

### Rate Limit Configuration

#### Default Limits

- **Normal Rate Limit**: 5 submissions per hour per IP address
- **Strict Rate Limit**: 2 submissions per 10 minutes per IP address (for repeat offenders)

#### Admin Bypass

Users with admin email addresses (`bob@matsuoka.com`) can bypass all rate limits.

#### Escalation Policy

When a user exceeds the normal rate limit, they are automatically moved to strict rate limiting for 1 hour.

## API Endpoints

### Contact Form Endpoint

**POST** `/api/contact`

Rate limiting is automatically applied to this endpoint.

**Response Headers:**
- `X-RateLimit-Limit`: Maximum number of requests allowed
- `X-RateLimit-Remaining`: Number of requests remaining in the current window
- `X-RateLimit-Reset`: Timestamp when the rate limit resets
- `Retry-After`: Seconds to wait before retrying (only when rate limited)

**Rate Limited Response (429):**
```json
{
  "error": "Too many requests",
  "message": "You have exceeded the rate limit for contact form submissions. Please try again later.",
  "retryAfter": 3600,
  "limit": 5,
  "reset": "2025-07-01T12:00:00.000Z"
}
```

### Admin Management Endpoints

#### Get Rate Limit Analytics

**GET** `/api/admin/rate-limit?action=analytics`

**Headers:**
```
Authorization: Bearer YOUR_ADMIN_API_KEY
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalRequests": 150,
    "blockedRequests": 12,
    "uniqueIPs": 45
  }
}
```

#### Get Rate Limit Status

**GET** `/api/admin/rate-limit?action=status&ip=192.168.1.1&email=user@example.com`

**Headers:**
```
Authorization: Bearer YOUR_ADMIN_API_KEY
```

**Response:**
```json
{
  "success": true,
  "data": {
    "ip": "192.168.1.1",
    "email": "user@example.com",
    "rateLimit": {
      "success": true,
      "limit": 5,
      "remaining": 3,
      "reset": "2025-07-01T13:00:00.000Z"
    }
  }
}
```

#### Reset Rate Limit

**POST** `/api/admin/rate-limit?action=reset`

**Headers:**
```
Authorization: Bearer YOUR_ADMIN_API_KEY
```

**Body:**
```json
{
  "ip": "192.168.1.1"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Rate limit reset for IP: 192.168.1.1",
  "data": {
    "ip": "192.168.1.1"
  }
}
```

## Environment Variables

### Required

- `KV_URL`: Vercel KV database URL
- `KV_REST_API_URL`: Vercel KV REST API URL
- `KV_REST_API_TOKEN`: Vercel KV REST API token
- `KV_REST_API_READ_ONLY_TOKEN`: Vercel KV read-only token

### Optional

- `ADMIN_API_KEY`: API key for admin endpoints (required for admin functionality)

## Monitoring and Analytics

### Rate Limit Headers

All responses from the contact API include rate limit headers:

- `X-RateLimit-Limit`: Current rate limit
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset timestamp

### Logging

Rate limiting events are logged with the following information:
- IP address
- Email address (if provided)
- Rate limit status
- Timestamp
- Action taken

### Analytics

The admin API provides basic analytics:
- Total requests processed
- Number of blocked requests
- Unique IP addresses

## User Experience

### Normal Operation

Users can submit up to 5 contact form messages per hour without any restrictions.

### Rate Limited

When rate limited, users see:
1. Clear error message explaining the situation
2. Information about when they can try again
3. Disabled submit button
4. Educational message about spam prevention

### Admin Users

Admin users (configured email addresses) bypass all rate limits and can always submit messages.

## Troubleshooting

### Common Issues

1. **Rate limits not working**
   - Check Vercel KV configuration
   - Verify environment variables
   - Check network connectivity to KV

2. **False positives**
   - Users behind shared IP addresses may hit limits faster
   - Consider implementing session-based rate limiting

3. **Admin bypass not working**
   - Verify admin email configuration
   - Check email case sensitivity

### Debugging

Enable debug logging by setting `DEBUG=true` in environment variables.

Check rate limit status for specific IP:
```bash
curl -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  "https://your-domain.com/api/admin/rate-limit?action=status&ip=192.168.1.1"
```

Reset rate limit for specific IP:
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"ip":"192.168.1.1"}' \
  "https://your-domain.com/api/admin/rate-limit?action=reset"
```

## Security Considerations

1. **Admin API Key**: Keep the admin API key secure and rotate regularly
2. **IP Spoofing**: Rate limiting is based on IP addresses which can be spoofed
3. **Distributed Attacks**: Consider implementing additional protection for distributed attacks
4. **Privacy**: IP addresses are temporarily stored for rate limiting purposes

## Future Enhancements

1. **CAPTCHA Integration**: Add CAPTCHA for repeat offenders
2. **Geolocation Blocking**: Block requests from specific countries/regions
3. **Machine Learning**: Implement ML-based spam detection
4. **Session-based Limits**: Add session-based rate limiting alongside IP-based
5. **Dynamic Configuration**: Allow runtime configuration changes
6. **Advanced Analytics**: More detailed analytics and reporting
