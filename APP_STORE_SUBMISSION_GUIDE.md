# App Store Submission Complete Guide

**Last Updated:** January 17, 2026
**Purpose:** Comprehensive guide for submitting iOS apps to the App Store. Use this as a template for all future app submissions.

---

## Table of Contents

1. [Pre-Submission Checklist](#pre-submission-checklist)
2. [Required Assets & Dimensions](#required-assets--dimensions)
3. [App Store Connect Setup](#app-store-connect-setup)
4. [App Information & Metadata](#app-information--metadata)
5. [Screenshots Requirements](#screenshots-requirements)
6. [In-App Purchases & Subscriptions](#in-app-purchases--subscriptions)
7. [App Privacy Section](#app-privacy-section)
8. [Build Submission Process](#build-submission-process)
9. [Common Errors & Fixes](#common-errors--fixes)
10. [Post-Submission](#post-submission)

---

## Pre-Submission Checklist

### Required Before Starting

- [ ] Apple Developer Account ($99/year)
- [ ] App Store Connect access
- [ ] Bundle ID registered in Apple Developer Portal
- [ ] Distribution Certificate (valid)
- [ ] Provisioning Profile (valid)
- [ ] EAS CLI configured (`npm install -g eas-cli`)
- [ ] Supabase/Backend deployed and tested

### Required Files

- [ ] App Icon (1024x1024px PNG, no alpha/transparency)
- [ ] iPhone Screenshots (1284x2778px or 1242x2688px)
- [ ] iPad Screenshots (2064x2752px)
- [ ] Privacy Policy URL (hosted and accessible)
- [ ] Terms of Service URL (optional but recommended)
- [ ] Support URL

### Code Requirements

- [ ] `app.json` configured with correct bundle ID
- [ ] `eas.json` configured with ASC App ID
- [ ] All API keys set in environment/secrets
- [ ] Info.plist permissions properly configured
- [ ] No placeholder/test data in production build

---

## Required Assets & Dimensions

### App Icon

| Asset | Dimensions | Format | Notes |
|-------|------------|--------|-------|
| App Store Icon | 1024 x 1024 px | PNG | No transparency, no rounded corners |

### Screenshots by Device

| Device | Dimensions (Portrait) | Dimensions (Landscape) | Required |
|--------|----------------------|------------------------|----------|
| iPhone 6.7" (14 Pro Max) | 1290 x 2796 px | 2796 x 1290 px | Yes |
| iPhone 6.5" (11 Pro Max) | 1284 x 2778 px | 2778 x 1284 px | Yes |
| iPhone 5.5" (8 Plus) | 1242 x 2208 px | 2208 x 1242 px | Optional |
| iPad Pro 13" | 2064 x 2752 px | 2752 x 2064 px | Yes (if supports iPad) |
| iPad Pro 12.9" | 2048 x 2732 px | 2732 x 2048 px | Alternative |

**Screenshot Rules:**
- Minimum: 1 screenshot per device size
- Maximum: 10 screenshots per device size
- File format: PNG or JPEG
- No alpha channel
- Must show actual app UI (no misleading images)

### App Previews (Optional Videos)

| Device | Dimensions | Duration | Format |
|--------|------------|----------|--------|
| iPhone 6.7" | 1290 x 2796 px | 15-30 sec | MP4, MOV |
| iPhone 6.5" | 1284 x 2778 px | 15-30 sec | MP4, MOV |
| iPad Pro 13" | 2064 x 2752 px | 15-30 sec | MP4, MOV |

### Subscription Promotional Images

| Asset | Dimensions | Format | Used For |
|-------|------------|--------|----------|
| Subscription Image | 1024 x 1024 px | PNG/JPEG | Each subscription product |

---

## App Store Connect Setup

### 1. Create New App

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Click **My Apps** → **+** → **New App**
3. Fill in:
   - **Platform:** iOS
   - **Name:** Your App Name (unique on App Store)
   - **Primary Language:** English (U.S.)
   - **Bundle ID:** Select from dropdown (must be registered)
   - **SKU:** Unique identifier (e.g., `com.company.appname.2026`)
   - **User Access:** Full Access

### 2. Configure eas.json

```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "production": {
      "ios": {
        "resourceClass": "m-medium"
      },
      "env": {
        "EXPO_PUBLIC_API_URL": "https://your-api.com"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your@email.com",
        "appleTeamId": "XXXXXXXXXX",
        "ascAppId": "1234567890"
      }
    }
  }
}
```

**Where to find values:**
- `appleId`: Your Apple Developer email
- `appleTeamId`: Apple Developer → Membership → Team ID
- `ascAppId`: App Store Connect → App → General → App Information → Apple ID

---

## App Information & Metadata

### App Store Tab - Required Fields

| Field | Character Limit | Example |
|-------|-----------------|---------|
| **Name** | 30 chars | RoadLedger Pro |
| **Subtitle** | 30 chars | IFTA Mileage & Profit Tracker |
| **Promotional Text** | 170 chars | Know your profit per mile. Track mileage by state. Generate IFTA reports in seconds. |
| **Description** | 4000 chars | See template below |
| **Keywords** | 100 chars | keyword1,keyword2,keyword3 (comma-separated, no spaces) |
| **Support URL** | URL | https://yoursite.com/support |
| **Marketing URL** | URL (optional) | https://yoursite.com |
| **Privacy Policy URL** | URL (required) | https://yoursite.com/privacy |

### Description Template

```
[APP NAME] is [one-line value proposition].

KEY FEATURES

• [Feature 1 Title]
[Feature 1 description - 1-2 sentences]

• [Feature 2 Title]
[Feature 2 description - 1-2 sentences]

• [Feature 3 Title]
[Feature 3 description - 1-2 sentences]

• [Feature 4 Title]
[Feature 4 description - 1-2 sentences]

SUBSCRIPTION OPTIONS (if applicable)
• Free: [What's included]
• Pro ($X.XX/mo): [What's included]
• Premium ($X.XX/mo): [What's included]

[Closing statement - why download]

Questions? Contact support@yourcompany.com
```

### Keywords Strategy

- 100 character limit total
- Comma-separated, NO spaces after commas
- Don't repeat words from app name
- Use competitor names (carefully)
- Include common misspellings
- Mix broad and specific terms

**Example:**
```
IFTA,mileage,trucker,owner operator,truck driver,fuel tax,trip log,expense,profit,load,freight
```

### Categories

| Primary Category | Secondary Category |
|------------------|-------------------|
| Business | Finance |
| Finance | Business |
| Productivity | Business |
| Travel | Navigation |
| Health & Fitness | Lifestyle |

### Age Rating Questions

Answer these in App Store Connect → Age Rating:

| Content Type | Answer for Most Business Apps |
|--------------|------------------------------|
| Cartoon or Fantasy Violence | None |
| Realistic Violence | None |
| Sexual Content or Nudity | None |
| Profanity or Crude Humor | None |
| Alcohol, Tobacco, Drugs | None |
| Simulated Gambling | None |
| Horror/Fear Themes | None |
| Mature/Suggestive Themes | None |
| Medical/Treatment Info | None |
| Unrestricted Web Access | No (unless app has browser) |

**Result:** 4+ (Everyone)

### App Review Information

| Field | Description |
|-------|-------------|
| **First Name** | Reviewer contact |
| **Last Name** | Reviewer contact |
| **Phone** | Contact phone with country code |
| **Email** | Contact email |
| **Demo Account** | Test credentials for Apple reviewers |
| **Notes** | Instructions for testing the app |

**Demo Account Notes Template:**
```
To test the app:
1. Sign in with the provided demo account
2. [Step to test main feature 1]
3. [Step to test main feature 2]
4. [Step to test main feature 3]

For subscription testing, use Sandbox tester in TestFlight.

Location permission is required for [feature].
Camera permission is required for [feature].
```

---

## Screenshots Requirements

### Node.js Script to Resize Screenshots

```javascript
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const configs = [
  { name: 'iPhone 6.7"', width: 1290, height: 2796, folder: 'iphone-6.7' },
  { name: 'iPhone 6.5"', width: 1284, height: 2778, folder: 'iphone-6.5' },
  { name: 'iPad 13"', width: 2064, height: 2752, folder: 'ipad-13' },
];

const sourceDir = './source-screenshots';
const outputBase = './assets/appstore';

async function resizeAll() {
  const files = fs.readdirSync(sourceDir).filter(f =>
    f.endsWith('.png') || f.endsWith('.jpg')
  );

  for (const config of configs) {
    const outputDir = path.join(outputBase, config.folder);
    fs.mkdirSync(outputDir, { recursive: true });

    for (let i = 0; i < files.length; i++) {
      const inputPath = path.join(sourceDir, files[i]);
      const outputPath = path.join(outputDir,
        `screenshot-${String(i + 1).padStart(2, '0')}-${config.width}x${config.height}.png`
      );

      await sharp(inputPath)
        .resize(config.width, config.height, { fit: 'cover', position: 'top' })
        .png({ quality: 100 })
        .toFile(outputPath);

      console.log(`✓ ${config.name}: ${files[i]} → ${path.basename(outputPath)}`);
    }
  }
}

resizeAll();
```

### Screenshot Content Recommendations

| Screenshot # | Content | Purpose |
|--------------|---------|---------|
| 1 | Main value proposition / Hero screen | First impression |
| 2 | Core feature #1 | Show primary functionality |
| 3 | Core feature #2 | Show secondary functionality |
| 4 | Core feature #3 | Show additional value |
| 5 | Settings/Profile or unique feature | Differentiation |
| 6-10 | Additional features, testimonials, or use cases | Optional |

---

## In-App Purchases & Subscriptions

### Subscription Types

| Type | Use Case | Auto-Renews |
|------|----------|-------------|
| Auto-Renewable Subscription | Ongoing service access | Yes |
| Non-Renewing Subscription | Time-limited access (manual renewal) | No |
| Consumable | One-time use (coins, credits) | N/A |
| Non-Consumable | Permanent unlock | N/A |

### Setting Up Auto-Renewable Subscriptions

1. **Create Subscription Group:**
   - Go to: Monetization → Subscriptions → Create
   - Reference Name: `[App Name] Subscriptions`

2. **Add Products (for each tier):**

| Field | Example Value |
|-------|---------------|
| Reference Name | Pro Monthly |
| Product ID | `com.company.app.pro.monthly` |
| Subscription Duration | 1 Month |
| Price | Select tier (e.g., Tier 23 = $14.99) |
| Display Name | Pro |
| Description | Full feature access with unlimited... |

### Product ID Naming Convention

```
com.[company].[app].[tier].[period]

Examples:
com.roadledger.app.pro.monthly
com.roadledger.app.pro.yearly
com.roadledger.app.premium.monthly
com.roadledger.app.premium.yearly
```

### Subscription Pricing Tiers (USD)

| Tier | Price | Tier | Price |
|------|-------|------|-------|
| 1 | $0.99 | 30 | $19.99 |
| 5 | $2.99 | 38 | $29.99 |
| 10 | $4.99 | 47 | $49.99 |
| 15 | $7.99 | 50 | $59.99 |
| 20 | $9.99 | 60 | $119.99 |
| 23 | $14.99 | 72 | $239.99 |

### Grace Period (Recommended)

Enable billing grace period to reduce involuntary churn:
- Go to: Subscription Group → Billing Grace Period
- Select: **16 days** (recommended)
- This gives users time to fix payment issues

### Promotional Images for Subscriptions

- **Size:** 1024 x 1024 px
- **Format:** PNG or JPEG
- Upload for each subscription product
- Shows in the subscription management UI

---

## App Privacy Section

### Required by Apple

Every app must complete the App Privacy section before submission.

**Location:** App Store Connect → [Your App] → App Privacy

### Common Data Types for Mobile Apps

| Data Type | Category | Common Purpose |
|-----------|----------|----------------|
| Email Address | Contact Info | Account creation, communication |
| Name | Contact Info | Personalization |
| User ID | Identifiers | Account identification |
| Device ID | Identifiers | Analytics, crash reporting |
| Precise Location | Location | Core functionality (maps, tracking) |
| Coarse Location | Location | Content localization |
| Crash Data | Diagnostics | Bug fixing |
| Performance Data | Diagnostics | App optimization |
| Product Interaction | Usage Data | Analytics, feature improvement |
| Purchases | Financial Info | Transaction history |

### Questions for Each Data Type

**1. Is this data linked to the user's identity?**
- Yes = Data is associated with user account
- No = Anonymous/aggregated data

**2. Is this data used for tracking?**
- Yes = Data used for advertising across apps/websites
- No = Data used only within your app

**3. Why is this data collected?** (Select all that apply)
- Third-Party Advertising
- Developer's Advertising or Marketing
- Analytics
- Product Personalization
- App Functionality
- Other Purposes

### App Privacy Response Templates

#### Basic App (No Tracking)

| Data Type | Linked to User | Used for Tracking | Purpose |
|-----------|----------------|-------------------|---------|
| Email Address | Yes | No | App Functionality |
| User ID | Yes | No | App Functionality |
| Crash Data | No | No | App Functionality |

#### App with Location

| Data Type | Linked to User | Used for Tracking | Purpose |
|-----------|----------------|-------------------|---------|
| Email Address | Yes | No | App Functionality |
| User ID | Yes | No | App Functionality |
| Precise Location | Yes | No | App Functionality |
| Crash Data | No | No | App Functionality |
| Usage Data | Yes | No | Analytics, App Functionality |

#### App with Payments/Subscriptions

| Data Type | Linked to User | Used for Tracking | Purpose |
|-----------|----------------|-------------------|---------|
| Email Address | Yes | No | App Functionality |
| User ID | Yes | No | App Functionality |
| Purchase History | Yes | No | App Functionality |
| Crash Data | No | No | App Functionality |

---

## Build Submission Process

### Step 1: Configure Info.plist (app.json for Expo)

```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.company.app",
      "infoPlist": {
        "NSLocationWhenInUseUsageDescription": "App needs location for...",
        "NSLocationAlwaysAndWhenInUseUsageDescription": "App needs background location for...",
        "NSCameraUsageDescription": "App uses camera for...",
        "NSPhotoLibraryUsageDescription": "App needs photos for...",
        "UIBackgroundModes": ["location", "fetch", "processing"],
        "BGTaskSchedulerPermittedIdentifiers": [
          "com.company.app.sync",
          "com.company.app.refresh"
        ],
        "ITSAppUsesNonExemptEncryption": false
      }
    }
  }
}
```

### Step 2: Build for Production

```bash
# Build iOS production binary
eas build --platform ios --profile production

# Wait for build to complete (5-15 minutes)
```

### Step 3: Submit to App Store Connect

```bash
# Submit the latest build
eas submit --platform ios --latest

# Or submit a specific build
eas submit --platform ios --id [BUILD_ID]
```

### Step 4: Configure in App Store Connect

1. Go to App Store Connect → Your App → App Store tab
2. Select the build under "Build" section
3. Fill in all required metadata
4. Upload screenshots for all required device sizes
5. Complete App Privacy section
6. Add App Review contact information
7. Click "Add for Review"

### Step 5: Submit for Review

1. Answer export compliance questions
2. Answer content rights questions
3. Answer advertising identifier questions
4. Click "Submit to App Review"

---

## Common Errors & Fixes

### Build Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Missing Info.plist value: BGTaskSchedulerPermittedIdentifiers` | UIBackgroundModes includes "processing" | Add BGTaskSchedulerPermittedIdentifiers to infoPlist |
| `Invalid provisioning profile` | Profile expired or wrong type | Regenerate in Apple Developer Portal |
| `Bundle ID mismatch` | app.json doesn't match App Store Connect | Update bundleIdentifier in app.json |

### Submission Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `You must choose a build` | No build selected | Select build in App Store → Build section |
| `Missing screenshots for X display` | Missing device size | Generate and upload screenshots |
| `App Privacy not completed` | Privacy section empty | Complete App Privacy questionnaire |
| `Missing Contact Information` | Review info incomplete | Fill in App Review Information |

### Review Rejection Reasons

| Reason | Common Cause | Fix |
|--------|--------------|-----|
| Guideline 2.1 - Crashes | App crashes during review | Test thoroughly, fix crash bugs |
| Guideline 2.3 - Metadata | Screenshots don't match app | Update screenshots to reflect actual app |
| Guideline 3.1.1 - Payments | Using non-Apple payment for digital goods | Use StoreKit for in-app purchases |
| Guideline 4.2 - Minimum Functionality | App too simple | Add more features or content |
| Guideline 5.1.1 - Data Collection | Privacy policy missing/inaccurate | Update privacy policy and App Privacy |

---

## Post-Submission

### Review Timeline

| Status | Typical Duration |
|--------|-----------------|
| Waiting for Review | 24-48 hours |
| In Review | 24-48 hours |
| Pending Developer Release | Immediate (if manual release) |
| Ready for Sale | After approval |

### After Approval

1. **Verify app is live:** Search App Store
2. **Test download:** Install from App Store
3. **Monitor analytics:** App Store Connect → Analytics
4. **Respond to reviews:** App Store Connect → Ratings and Reviews
5. **Monitor crashes:** App Store Connect → Crashes

### Version Updates

For updates, increment version number:
- **Major:** 1.0.0 → 2.0.0 (breaking changes)
- **Minor:** 1.0.0 → 1.1.0 (new features)
- **Patch:** 1.0.0 → 1.0.1 (bug fixes)

Update in `app.json`:
```json
{
  "expo": {
    "version": "1.1.0"
  }
}
```

---

## Quick Reference Commands

```bash
# Build production iOS
eas build --platform ios --profile production

# Submit latest build
eas submit --platform ios --latest

# Check build status
eas build:list

# Check submission status
eas submission:list

# View credentials
eas credentials

# Update EAS CLI
npm install -g eas-cli@latest
```

---

## File Structure for App Store Assets

```
project/
├── assets/
│   └── appstore/
│       ├── icon/
│       │   └── AppIcon-1024x1024.png
│       ├── screenshots/
│       │   ├── iphone-6.5/
│       │   │   ├── screenshot-01-1284x2778.png
│       │   │   └── ...
│       │   └── ipad-13/
│       │       ├── screenshot-01-2064x2752.png
│       │       └── ...
│       └── subscriptions/
│           ├── pro-monthly-1024x1024.png
│           ├── pro-yearly-1024x1024.png
│           └── ...
├── docs/
│   ├── index.html          # Landing page
│   ├── privacy.html        # Privacy policy
│   └── terms.html          # Terms of service
├── app.json
└── eas.json
```

---

## Checklist for New App Submission

### Week Before Submission
- [ ] All features complete and tested
- [ ] Privacy policy written and hosted
- [ ] Terms of service written and hosted
- [ ] App icon finalized (1024x1024)
- [ ] Screenshots captured on device
- [ ] Demo account created for reviewers

### Day of Submission
- [ ] Screenshots resized for all device sizes
- [ ] Production build created and tested
- [ ] App Store Connect app created
- [ ] All metadata entered
- [ ] Screenshots uploaded
- [ ] App Privacy completed
- [ ] In-app purchases configured (if applicable)
- [ ] Build selected
- [ ] Contact information added
- [ ] Submit for review

### After Submission
- [ ] Monitor email for Apple communications
- [ ] Respond promptly to any reviewer questions
- [ ] Prepare marketing materials for launch
- [ ] Set up app analytics monitoring

---

**Note:** This guide is based on App Store requirements as of January 2026. Apple may update requirements at any time. Always check the latest [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/).
