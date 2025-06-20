# Google Search Console Integration Setup

This guide explains how to set up Google Search Console integration for the AI Power Rankings SEO dashboard.

## Prerequisites

1. Access to Google Search Console for your website
2. Google Cloud SDK (gcloud CLI) installed on your machine
3. A Google Cloud project with the Search Console API enabled

## Setup Steps

### 1. Enable Search Console API

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project or create a new one
3. Navigate to "APIs & Services" > "Library"
4. Search for "Google Search Console API"
5. Click on it and press "Enable"

### 2. Set up Authentication

We use Application Default Credentials (ADC) for authentication. This is the recommended approach for local development.

#### Install gcloud CLI

If you haven't already, install the Google Cloud SDK:

- MacOS: `brew install --cask google-cloud-sdk`
- Other platforms: [Installation Guide](https://cloud.google.com/sdk/docs/install)

#### Authenticate with gcloud

```bash
# Login to your Google account
gcloud auth application-default login

# Follow the browser prompt to authenticate
# Make sure to use an account that has access to your Search Console property
```

### 3. Configure Environment Variables

Add the following to your `.env.local` file:

```env
# Your website URL as registered in Google Search Console
# For domain properties, use: sc-domain:yourdomain.com
# For URL prefix properties, use: https://yourdomain.com
GOOGLE_SEARCH_CONSOLE_SITE_URL=sc-domain:aipowerranking.com

# Optional: Service account email for impersonation
# Only needed if you want to impersonate a service account
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project-id.iam.gserviceaccount.com
```

### 4. Grant Access to Search Console

Make sure the Google account you authenticated with has access to your Search Console property:

1. Go to [Google Search Console](https://search.google.com/search-console)
2. Select your property
3. Go to Settings > Users and permissions
4. Verify your account is listed with appropriate permissions

### 5. Test the Connection

Run the test script to verify everything is working:

```bash
node scripts/test-search-console-adc.js
```

You should see output like:

```
✅ Site Metrics:
  Current period:
    - Clicks: 12345
    - Impressions: 567890
    - CTR: 2.17%
    - Avg Position: 15.4
```

## Troubleshooting

### Error: Could not load the default credentials

Make sure you've run `gcloud auth application-default login` and completed the authentication flow.

### Error: Your application is authenticating by using local Application Default Credentials. The searchconsole.googleapis.com API requires a quota project

Run this command to set a quota project:

```bash
gcloud auth application-default set-quota-project YOUR_PROJECT_ID
```

### Error: User does not have sufficient permission for site

This means your Google account doesn't have access to the Search Console property. To fix:

1. Go to [Google Search Console](https://search.google.com/search-console)
2. Select your property
3. Go to Settings > Users and permissions
4. Add your Google account with at least "Restricted" permissions
5. Or ask the property owner to grant you access

### Error: 403 Forbidden

1. Verify the site URL matches exactly (including https:// or https://www.)
2. Check that your Google account has access to the Search Console property
3. Ensure the Search Console API is enabled in your Google Cloud project

### Error: Invalid authentication credentials

1. Re-run `gcloud auth application-default login`
2. Make sure you're using the correct Google account
3. Check that your credentials haven't expired

## Using Service Account (Production)

For production deployments, you'll typically use a service account:

1. Create a service account in Google Cloud Console
2. Download the JSON key file
3. Set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable:
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
   ```
4. Grant the service account email access to your Search Console property

## API Usage

The Google Search Console integration provides these methods:

- `getSiteMetrics()` - Overall site performance metrics
- `getTopQueries(limit)` - Top search queries
- `getTopPages(limit)` - Top performing pages
- `getPerformanceByDate(days)` - Performance trends over time
- `inspectUrl(url)` - Check if a URL is indexed
- `getSitemaps()` - List submitted sitemaps
- `submitSitemap(url)` - Submit a new sitemap

## Security Notes

- Never commit service account keys to version control
- Use ADC for local development
- For production, use environment variables or secret management services
- Regularly rotate service account keys if used
