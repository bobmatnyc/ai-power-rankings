# Admin Panel Authentication Setup

## 🔒 Security Overview

The AI Power Rankings admin panel now includes password-based authentication with secure session management. This protects sensitive administrative functions in production.

## ✅ Implementation Features

- **Password-based authentication** with SHA-256 hashing
- **Secure session tokens** with 24-hour expiry
- **HttpOnly cookies** to prevent XSS attacks
- **Automatic session cleanup** for expired sessions
- **Development mode bypass** for easier local development
- **Production-ready security** with proper cookie flags

## 🚀 Production Setup (CRITICAL)

### Step 1: Generate Password Hash

Choose a strong, unique password and generate its SHA-256 hash:

```bash
# On macOS/Linux:
echo -n "your-secure-password-here" | sha256sum

# On Windows (PowerShell):
[System.BitConverter]::ToString(
  [System.Security.Cryptography.SHA256]::Create().ComputeHash(
    [System.Text.Encoding]::UTF8.GetBytes("your-secure-password-here")
  )
).Replace("-","").ToLower()
```

### Step 2: Set Environment Variable on Vercel

1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add the following variable:

```
Name: ADMIN_PASSWORD_HASH
Value: [your-generated-hash-from-step-1]
Environment: ✅ Production
```

⚠️ **NEVER** commit the password or hash to your repository!

### Step 3: Deploy

Deploy your application to Vercel:

```bash
pnpm run pre-deploy
vercel deploy --prod
```

### Step 4: Verify

After deployment, verify authentication is working:

1. Navigate to `https://aipowerranking.com/admin`
2. You should be redirected to `/admin/auth/signin`
3. Enter your password (the original password, not the hash)
4. Verify you can access the admin panel

## 🔧 Local Development

### Default Development Mode

By default, authentication is **bypassed** in local development for convenience:

```bash
pnpm run dev:pm2 start
# Admin panel accessible without login at http://localhost:3001/admin
```

### Testing Authentication Locally

To test authentication in development:

```bash
# Set environment variable to force authentication
FORCE_AUTH_IN_DEV=true pnpm run dev:pm2 start

# Or create a .env.local file:
echo "FORCE_AUTH_IN_DEV=true" >> .env.local
echo "ADMIN_PASSWORD_HASH=your-hash-here" >> .env.local
```

Default development password: `AIPowerRankings2025!`
⚠️ **NEVER use this password in production!**

## 🛡️ Security Architecture

### Session Management

- Sessions are stored in-memory with automatic cleanup
- Each session has a unique cryptographically secure token
- Sessions expire after 24 hours of inactivity
- Session validation occurs on every protected request

### Cookie Security

Production cookies include:
- `HttpOnly`: Prevents JavaScript access (XSS protection)
- `Secure`: HTTPS-only transmission (automatic on Vercel)
- `SameSite=lax`: CSRF protection
- `Path=/`: Scoped to entire application

### Protected Routes

All `/admin` routes are protected:
- `/admin` - Main admin dashboard
- `/api/admin/*` - All admin API endpoints

## 📊 Testing Authentication

Run the included test scripts:

```bash
# Basic authentication test
node test-admin-auth.js

# Production simulation test
node test-prod-auth.js
```

## 🚨 Security Recommendations

### Required for Production

1. **Set strong password**: Minimum 16 characters with mixed case, numbers, symbols
2. **Use unique password**: Never reuse passwords from other services
3. **Set ADMIN_PASSWORD_HASH**: Required environment variable
4. **Enable HTTPS**: Automatic on Vercel, required for secure cookies
5. **Regular password rotation**: Change password every 90 days

### Additional Security Measures (Recommended)

1. **Rate limiting**: Add login attempt limits (e.g., 5 attempts per 15 minutes)
2. **IP allowlisting**: Restrict admin access to specific IP addresses
3. **Two-factor authentication**: Add TOTP/SMS second factor
4. **Audit logging**: Log all admin actions with timestamps
5. **Session monitoring**: Track active sessions and allow forced logout
6. **CORS restrictions**: Limit API access to your domain only

## 🔄 Password Rotation

To change the admin password:

1. Generate new password hash (Step 1 above)
2. Update `ADMIN_PASSWORD_HASH` on Vercel
3. Redeploy the application
4. All existing sessions will remain valid until expiry

## 🐛 Troubleshooting

### "Admin authentication not configured" error

- Ensure `ADMIN_PASSWORD_HASH` is set in Vercel environment variables
- Verify the variable is set for Production environment
- Redeploy after setting the variable

### Cannot login with correct password

- Verify you're entering the password, not the hash
- Check for extra spaces or special characters
- Ensure the hash was generated correctly
- Try clearing browser cookies for the domain

### Session expires too quickly

- Sessions last 24 hours from last activity
- Each request refreshes the session timeout
- Check system time synchronization

### Development authentication issues

- Authentication is bypassed by default in development
- Use `FORCE_AUTH_IN_DEV=true` to test authentication
- Check `NODE_ENV` is set to "development" locally

## 📝 Implementation Details

### Files Modified

- `/src/lib/admin-auth.ts` - Core authentication logic
- `/src/lib/admin-session-store.ts` - Session management
- `/src/app/api/admin/auth/route.ts` - Authentication API endpoint
- `/src/app/admin/page.tsx` - Admin page protection
- `/src/app/admin/auth/signin/page.tsx` - Login page
- `/.env.example` - Environment variable documentation

### Session Store Architecture

The session store uses an in-memory Map for simplicity and performance:
- Suitable for single-instance deployments (Vercel)
- Sessions persist until server restart or expiry
- Automatic cleanup runs hourly
- For multi-instance deployments, consider Redis

## 🔗 Related Documentation

- [Vercel Environment Variables](https://vercel.com/docs/environment-variables)
- [Next.js Security Headers](https://nextjs.org/docs/advanced-features/security-headers)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)