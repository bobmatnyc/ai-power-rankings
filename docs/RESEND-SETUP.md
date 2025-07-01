# Resend Email Configuration

## Overview

The contact form now uses Resend to send emails directly from the server instead of opening the user's email client.

## Setup Instructions

### 1. Environment Variable

Ensure `RESEND_API_KEY` is set in your environment variables:

- Local: `.env.local`
- Production: Vercel environment variables

### 2. Domain Configuration

To send emails from `noreply@aipowerrankings.com`, you need to:

1. Add and verify your domain in Resend dashboard
2. Add the required DNS records:
   - SPF record
   - DKIM records
   - Optional: DMARC record

### 3. Email Configuration

The contact form sends emails:

- **From**: `AI Power Rankings <onboarding@resend.dev>` (for testing)
- **To**: `bob@matsuoka.com` (must be your verified email in sandbox mode)
- **Reply-To**: User's email address (from the form)

**Important**: Resend accounts start in sandbox mode and can only send to your verified email address. To send to other recipients:

1. Verify your domain at resend.com/domains
2. Update the 'from' address to use your verified domain
3. Update the 'to' address to your desired recipient

### 4. Testing

1. Test locally with your Resend API key
2. Verify emails are being received
3. Check spam folder if emails are not arriving

## Fallback

If Resend is not configured or fails, the API will return an error and the user will see an error message on the form.

## Security

- The direct email address has been removed from the frontend to prevent spam
- All form submissions go through the API endpoint with validation
- Rate limiting should be implemented for production use

## Troubleshooting

### "Failed to send email" Error

1. **Check API Key**: Ensure `RESEND_API_KEY` is set in your `.env.local` file
2. **Test the API**: Visit `/api/contact/test` to run a diagnostic test
3. **Domain Verification**:
   - For testing, the API uses `onboarding@resend.dev` which works without verification
   - For production, you need to verify your domain in Resend dashboard
   - Update the 'from' email in `/src/app/api/contact/route.ts` after verification

### Common Issues

1. **Invalid API Key**: Make sure you're using the correct API key from Resend
2. **Domain Not Verified**: You can only send from domains you've verified or `onboarding@resend.dev`
3. **Rate Limits**: Free tier has limits, check your Resend dashboard
4. **Email Bounces**: Check if the recipient email is valid

### Testing Locally

1. Set your Resend API key in `.env.local`:

   ```
   RESEND_API_KEY=re_xxxxxxxxxxxxx
   ```

2. Test the endpoint:

   ```bash
   curl http://localhost:3000/api/contact/test
   ```

3. If successful, try the contact form on the website
