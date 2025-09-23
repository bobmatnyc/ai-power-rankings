# Clerk OAuth Troubleshooting Guide

## Common Google OAuth Issues

### Issue: "Missing required parameter: client_id"

**Error URL**: `https://accounts.google.com/signin/oauth/error?authError=Missing required parameter: client_id`

**Root Cause**: Google OAuth is enabled in Clerk but not configured with credentials.

**Solution**:

1. **Access Clerk Dashboard**
   - Go to [clerk.com](https://clerk.com)
   - Select your application (production uses `pk_live_` keys)

2. **Configure Google OAuth**
   - Navigate to "User & Authentication" → "Social connections"
   - Find "Google" and click "Configure"
   - Enter credentials:
     - Client ID: `682901667137-cb26malqef79qmeenvij6ir444al87l9.apps.googleusercontent.com`
     - Client Secret: `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`
   - Save configuration

3. **Verify Redirect URIs**
   - Clerk: `https://clerk.aipowerranking.com/v1/oauth_callback`
   - Google Console: Must match Clerk's redirect URI

### Environment Variables vs Dashboard Configuration

**Important**: Clerk doesn't automatically use environment variables for OAuth providers.

- ❌ Having `GOOGLE_OAUTH_CLIENT_ID` in Vercel is NOT enough
- ✅ Credentials must be configured in Clerk dashboard
- ✅ Environment variables are for custom integrations only

### Testing Checklist

After configuring OAuth:

- [ ] Clear browser cache
- [ ] Visit sign-in page
- [ ] Verify Google button appears
- [ ] Test complete OAuth flow
- [ ] Check both staging and production

### Prevention

1. **Document OAuth Setup**: Always document which social providers are enabled
2. **Environment Parity**: Ensure staging uses same OAuth config as production
3. **Testing Protocol**: Test OAuth after any Clerk configuration changes
4. **Access Control**: Limit who can modify Clerk dashboard settings

### Quick Disable Option

If Google OAuth isn't needed:

1. Clerk Dashboard → "Social connections"
2. Find Google → Disable
3. This removes the sign-in button and prevents errors

## Common Patterns

### Development vs Production

- **Development**: Uses `pk_test_` and `sk_test_` keys
- **Production**: Uses `pk_live_` and `sk_live_` keys
- **Important**: Each environment needs separate OAuth configuration

### Multi-Environment Setup

For staging using production keys:
- Staging inherits production Clerk configuration
- OAuth settings apply to all environments using the same keys
- Test OAuth changes in development first

## Error Patterns

| Error | Cause | Solution |
|-------|-------|----------|
| `Missing required parameter: client_id` | OAuth enabled but not configured | Configure in Clerk dashboard |
| `redirect_uri_mismatch` | Wrong redirect URI | Update Google Console or Clerk |
| `invalid_client` | Wrong credentials | Verify Client ID/Secret in Clerk |
| OAuth button missing | Provider disabled | Enable in Clerk dashboard |

## Monitoring

### Signs of OAuth Issues

- Users report Google sign-in not working
- Error URLs containing `accounts.google.com/signin/oauth/error`
- Authentication working with email but not social login
- OAuth buttons not appearing on sign-in page

### Regular Checks

- Monthly verification of OAuth provider status
- Test OAuth flow after any deployment
- Monitor Clerk dashboard for configuration changes
- Verify redirect URIs remain valid

---

**Last Updated**: 2025-01-22
**Next Review**: 2025-02-22