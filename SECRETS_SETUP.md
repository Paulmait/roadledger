# RoadLedger Secrets & API Keys Setup Guide

**Last Updated:** 2026-01-14

This document lists all secrets and API keys required for RoadLedger to function fully.

---

## Quick Reference Table

| Secret | Where to Add | Required For | Priority |
|--------|--------------|--------------|----------|
| `OPENAI_API_KEY` | Supabase Edge Functions | AI receipt extraction | **CRITICAL** |
| `ANTHROPIC_API_KEY` | Supabase Edge Functions | AI fallback provider | HIGH |
| `APPLE_SHARED_SECRET` | Supabase Edge Functions | iOS In-App Purchases | HIGH |
| `EXPO_TOKEN` | GitHub Actions Secrets | CI/CD builds | MEDIUM |
| `EXPO_PUBLIC_SUPABASE_URL` | .env / GitHub Actions | App configuration | **CRITICAL** |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | .env / GitHub Actions | App configuration | **CRITICAL** |
| `GOOGLE_PLAY_SERVICE_ACCOUNT` | GitHub Actions Secrets | Android builds | MEDIUM |
| `SENTRY_DSN` | .env | Error tracking | LOW |

---

## 1. Supabase Edge Function Secrets

These secrets are stored securely in Supabase and used by Edge Functions.

### How to Add:
1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/kbohuorolouxqgtzmrsa)
2. Navigate to **Project Settings** > **Edge Functions** > **Secrets**
3. Click **Add new secret**

### Required Secrets:

#### `OPENAI_API_KEY`
- **Purpose:** GPT-4 Vision for receipt/settlement OCR and extraction
- **Used by:** `doc-ingest`, `ai-profit-analyzer`, `ai-smart-suggestions`
- **Get it from:** https://platform.openai.com/api-keys
- **Format:** `sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- **Cost:** Pay-per-use (~$0.01-0.05 per document)

```bash
# Example (do not use real key)
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

#### `ANTHROPIC_API_KEY`
- **Purpose:** Claude AI fallback when OpenAI is unavailable
- **Used by:** `doc-ingest` (fallback), `ai-profit-analyzer` (fallback)
- **Get it from:** https://console.anthropic.com/settings/keys
- **Format:** `sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- **Cost:** Pay-per-use (~$0.01-0.03 per document)

```bash
# Example (do not use real key)
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

#### `APPLE_SHARED_SECRET`
- **Purpose:** Validate iOS In-App Purchase receipts
- **Used by:** `validate-receipt` Edge Function
- **Get it from:** App Store Connect > Your App > In-App Purchases > App-Specific Shared Secret
- **Format:** 32-character hex string

```bash
# Example (do not use real key)
APPLE_SHARED_SECRET=a1b2c3d4e5f6789012345678abcdef12
```

---

## 2. Environment Variables (.env)

These are stored in the project root `.env` file for local development.

### Current .env File Location:
`C:\Users\maito\roadledger\.env`

### Required Variables:

#### `EXPO_PUBLIC_SUPABASE_URL`
- **Purpose:** Supabase project URL for API calls
- **Status:** ✅ Already configured
- **Value:** `https://kbohuorolouxqgtzmrsa.supabase.co`

#### `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- **Purpose:** Supabase anonymous/public API key
- **Status:** ✅ Already configured
- **Note:** This key is safe to include in client code (protected by RLS)

### Optional Variables:

#### `SENTRY_DSN`
- **Purpose:** Error tracking and crash reporting
- **Get it from:** https://sentry.io/settings/projects/
- **Format:** `https://xxxx@xxxx.ingest.sentry.io/xxxx`

---

## 3. GitHub Actions Secrets

These are stored in GitHub repository settings for CI/CD.

### How to Add:
1. Go to your GitHub repository
2. Navigate to **Settings** > **Secrets and variables** > **Actions**
3. Click **New repository secret**

### Required Secrets:

#### `EXPO_TOKEN`
- **Purpose:** Authenticate with Expo for EAS builds
- **Get it from:** https://expo.dev/accounts/[username]/settings/access-tokens
- **Steps:**
  1. Go to Expo Dashboard
  2. Click your profile > Access Tokens
  3. Create new token with "Build" scope
- **Format:** UUID string

```bash
# Example (do not use real key)
EXPO_TOKEN=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

#### `EXPO_PUBLIC_SUPABASE_URL`
- **Purpose:** Supabase URL for production builds
- **Value:** `https://kbohuorolouxqgtzmrsa.supabase.co`

#### `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- **Purpose:** Supabase anon key for production builds
- **Note:** Copy from your `.env` file

### Optional Secrets:

#### `GOOGLE_PLAY_SERVICE_ACCOUNT`
- **Purpose:** Upload Android builds to Google Play
- **Get it from:** Google Play Console > Setup > API access
- **Format:** JSON service account credentials (base64 encoded)

#### `APPLE_API_KEY_ID`, `APPLE_API_ISSUER_ID`, `APPLE_API_KEY`
- **Purpose:** Upload iOS builds to App Store Connect
- **Get it from:** App Store Connect > Users and Access > Keys

#### `CODECOV_TOKEN`
- **Purpose:** Upload code coverage reports
- **Get it from:** https://codecov.io/gh/[your-repo]/settings

---

## 4. Expo Project Configuration

Already configured in `app.json`:

```json
{
  "extra": {
    "eas": {
      "projectId": "81ab29d1-f666-4ed6-92da-c50612640865"
    }
  },
  "owner": "guampaul"
}
```

---

## 5. Setup Checklist

### Critical (App Won't Function)
- [x] `EXPO_PUBLIC_SUPABASE_URL` in .env
- [x] `EXPO_PUBLIC_SUPABASE_ANON_KEY` in .env
- [ ] `OPENAI_API_KEY` in Supabase Edge Functions

### High Priority (Core Features)
- [ ] `ANTHROPIC_API_KEY` in Supabase Edge Functions
- [ ] `APPLE_SHARED_SECRET` in Supabase Edge Functions
- [ ] `EXPO_TOKEN` in GitHub Actions

### Medium Priority (CI/CD)
- [ ] `EXPO_PUBLIC_SUPABASE_URL` in GitHub Actions
- [ ] `EXPO_PUBLIC_SUPABASE_ANON_KEY` in GitHub Actions

### Low Priority (Production)
- [ ] `GOOGLE_PLAY_SERVICE_ACCOUNT` in GitHub Actions
- [ ] Apple API credentials in GitHub Actions
- [ ] `SENTRY_DSN` in .env

---

## 6. Cost Estimates

| Service | Estimated Cost | Notes |
|---------|----------------|-------|
| OpenAI API | $5-50/month | Based on document volume |
| Anthropic API | $0-10/month | Fallback only |
| Supabase | $0-25/month | Free tier generous |
| Expo EAS | $0-99/month | Free tier: 30 builds/month |
| Apple Developer | $99/year | Required for App Store |
| Google Play | $25 one-time | Required for Play Store |

---

## 7. Security Notes

1. **Never commit secrets to git** - Use .env (gitignored) or secret management
2. **Rotate API keys** periodically (every 90 days recommended)
3. **Use minimal permissions** - Create API keys with only needed scopes
4. **Monitor usage** - Set up billing alerts for API services
5. **SUPABASE_SERVICE_ROLE_KEY** - Never expose this; only used server-side

---

## Quick Start Commands

```bash
# Set Supabase secrets (requires Supabase CLI)
supabase secrets set OPENAI_API_KEY=sk-proj-xxx
supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxx
supabase secrets set APPLE_SHARED_SECRET=xxx

# Verify secrets are set
supabase secrets list

# Test Edge Function locally with secrets
supabase functions serve doc-ingest --env-file .env.local
```

---

## Support

- **Supabase Issues:** https://supabase.com/docs
- **Expo Issues:** https://docs.expo.dev
- **OpenAI Issues:** https://help.openai.com
- **App Issues:** support@roadledger.app
