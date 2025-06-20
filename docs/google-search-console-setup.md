# Google Search Console API Setup Guide

## Prerequisites
- Google account with access to your website in Search Console
- Google Cloud Project (same one used for OAuth)

## Step 1: Enable Search Console API

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project
3. Navigate to **APIs & Services > Library**
4. Search for "Google Search Console API"
5. Click on it and press **Enable**

## Step 2: Create Service Account (Recommended for Server-Side)

1. Go to **APIs & Services > Credentials**
2. Click **+ CREATE CREDENTIALS > Service account**
3. Fill in:
   - Service account name: `search-console-reader`
   - Service account ID: (auto-generated)
   - Description: "Read-only access to Search Console data"
4. Click **Create and Continue**
5. Grant role: **Project > Viewer**
6. Click **Done**

## Step 3: Generate Service Account Key

1. Click on the service account you just created
2. Go to **Keys** tab
3. Click **Add Key > Create new key**
4. Choose **JSON** format
5. Download the key file (keep it secure!)

## Step 4: Add Service Account to Search Console

1. Go to [Google Search Console](https://search.google.com/search-console)
2. Select your property
3. Go to **Settings > Users and permissions**
4. Click **Add user**
5. Enter the service account email (found in your JSON key file)
6. Set permission to **Full** or **Restricted** (read-only)
7. Click **Add**

## Step 5: Environment Variables

Add these to your `.env.local`:

```bash
# Google Search Console
GOOGLE_SEARCH_CONSOLE_SITE_URL=https://aipowerrankings.com
GOOGLE_SERVICE_ACCOUNT_EMAIL=search-console-reader@your-project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"..."}' # Full JSON key
```

## API Quotas
- Default: 200 queries per day
- 2000 queries per 100 seconds

## Common API Calls

### Search Analytics
- Get search queries
- Click-through rates
- Impressions
- Average position

### URL Inspection
- Check indexing status
- Mobile usability
- Rich results

### Sitemaps
- Submit sitemaps
- Check sitemap status

## Testing the Connection

Use the provided test script:
```bash
node scripts/test-search-console.js
```