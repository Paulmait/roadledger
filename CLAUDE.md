# RoadLedger Development Guide

**Last Updated:** January 17, 2026
**Target Launch:** January 17, 2026
**Version:** 1.0.0
**Status:** PRODUCTION READY - Security Hardened

## Project Overview

RoadLedger is a profit-first mobile app for owner-operator truck drivers. It provides:
- Automatic GPS mileage tracking by state (IFTA-ready)
- Revenue/expense tracking via receipt/settlement capture with AI extraction
- Offline-first design with background sync
- Battery-aware GPS modes
- Comprehensive analytics for business insights

## Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | Expo SDK 54 |
| Language | TypeScript |
| Routing | Expo Router 6 |
| Backend | Supabase (Postgres + Auth + Storage + Edge Functions) |
| State | Zustand |
| AI/OCR | OpenAI GPT-4 Vision |
| IAP | Apple StoreKit 2 (expo-in-app-purchases) |

## Company Information

```
Cien Rios LLC (dba RoadLedger)
17113 Miramar Parkway
Miramar, FL 33027
United States
Phone: (754) 254-7141
Email: support@cienrios.com
```

## Supabase Configuration

- **Project URL:** https://kbohuorolouxqgtzmrsa.supabase.co
- **Project Ref:** kbohuorolouxqgtzmrsa

### Environment Variables (.env)
```bash
EXPO_PUBLIC_SUPABASE_URL=https://kbohuorolouxqgtzmrsa.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ... # Get from Supabase Dashboard > Settings > API
```

## Pricing Tiers (Updated Jan 17, 2026)

| Tier | Monthly | Yearly | Key Features |
|------|---------|--------|--------------|
| Free | $0 | $0 | 5 trips/mo, 3 docs/mo, basic tracking |
| Pro | $14.99 | $119.99 | Unlimited trips, AI receipt scanning, IFTA reports |
| Premium | $29.99 | $239.99 | Everything + unlimited AI insights, lane analysis, priority support |

**Pricing Strategy:** Premium pricing for AI-powered features that competitors lack.
- TruckLogics charges $75/mo for basic TMS
- Motive/KeepTruckin charges $20-35/mo per vehicle
- Our AI features justify the premium price point

### Apple Product IDs
- `com.roadledger.pro.monthly`
- `com.roadledger.pro.yearly`
- `com.roadledger.premium.monthly`
- `com.roadledger.premium.yearly`

## Project Structure

```
roadledger/
├── app/                          # Expo Router screens
│   ├── (auth)/                   # Authentication screens
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   ├── forgot-password.tsx
│   │   └── onboarding.tsx
│   ├── (admin)/                  # Admin dashboard (protected)
│   │   ├── index.tsx             # Admin metrics/overview
│   │   ├── users.tsx             # User management
│   │   ├── analytics.tsx         # Business analytics
│   │   ├── subscriptions.tsx     # Subscription management
│   │   └── support.tsx           # Support tickets
│   ├── (tabs)/                   # Main app tabs
│   │   ├── index.tsx             # Dashboard (profit-first)
│   │   ├── trip/                 # Trip tracking
│   │   ├── documents/            # Document management
│   │   ├── transactions/         # Transactions
│   │   ├── exports/              # IFTA/Tax exports
│   │   ├── subscription.tsx      # Pricing/upgrade
│   │   └── settings/             # Settings & legal
│   └── _layout.tsx
├── src/
│   ├── components/               # Reusable UI components
│   ├── hooks/                    # Custom React hooks
│   ├── stores/                   # Zustand state stores
│   │   ├── authStore.ts
│   │   ├── tripStore.ts
│   │   └── documentStore.ts
│   ├── services/                 # Business logic
│   │   ├── location/             # GPS + jurisdiction detection
│   │   ├── sync/                 # Offline sync engine
│   │   ├── subscription/         # Apple IAP
│   │   └── analytics/            # Event tracking
│   ├── lib/                      # Supabase client, SQLite
│   ├── constants/                # Pricing, legal, jurisdictions
│   └── types/                    # TypeScript definitions
├── supabase/
│   ├── migrations/               # SQL migrations (auto-pushed)
│   └── functions/                # Edge Functions
│       ├── validate-receipt/     # Apple receipt validation
│       ├── doc-ingest/           # AI document extraction
│       ├── ai-profit-analyzer/   # Profit insights
│       ├── ai-smart-suggestions/ # Smart recommendations
│       ├── trip-finalize/        # Calculate state miles
│       ├── export-ifta/          # IFTA report generation
│       └── export-tax-pack/      # Tax summary export
└── assets/
    └── geo/us-states.json        # State boundaries (~500KB)
```

## Database Tables

### Core Tables
- `profiles` - User profiles with subscription tier
- `trips` - Trip records with GPS data
- `trip_points` - Individual GPS coordinates
- `jurisdiction_miles` - Aggregated state mileage
- `documents` - Uploaded receipts/settlements
- `transactions` - Income/expense records
- `exports` - Generated reports

### Subscription Tables
- `subscriptions` - Active subscriptions
- `subscription_history` - Subscription changes

### Analytics Tables
- `analytics_events` - All tracked events
- `analytics_daily_summary` - Aggregated daily metrics
- `app_metrics` - Real-time app stats

### Admin/Security Tables
- `admin_users` - Admin access control
- `admin_audit_log` - Admin action logging (IP, timestamp)
- `security_events` - Suspicious activity tracking
- `rate_limits` - API rate limiting
- `user_consents` - GDPR/CCPA consent tracking
- `data_deletion_requests` - Account deletion queue
- `accessibility_preferences` - User accessibility settings
- `support_tickets` / `support_messages` - Support system

## Security Features

### Row Level Security (RLS)
All tables have RLS enabled. Users can only access their own data.

Admin bypass: `is_admin()` function checks `admin_users` table.

### Admin Audit Logging
All admin actions are logged with:
- Admin ID
- Action type
- Target entity
- IP address
- User agent
- Timestamp
- Request ID

### Rate Limiting
Built-in rate limiting via `check_rate_limit()` function.

### Data Protection
- GDPR/CCPA compliant data export
- One-click account deletion (30-day processing)
- Consent tracking for all data collection

## Accessibility (WCAG 2.1 AA)

The app includes:
- High contrast mode
- Large text support
- Reduce motion option
- Screen reader optimization (VoiceOver/TalkBack)
- Color blind modes (protanopia, deuteranopia, tritanopia)
- Minimum 44px touch targets
- Proper accessibility labels on all interactive elements

## Edge Functions

All sensitive API operations go through Supabase Edge Functions:

| Function | Purpose |
|----------|---------|
| `validate-receipt` | Apple receipt validation (server-side) |
| `doc-ingest` | AI document extraction (GPT-4 Vision) |
| `ai-profit-analyzer` | Profit analysis and insights |
| `ai-smart-suggestions` | Proactive recommendations |
| `trip-finalize` | Calculate jurisdiction miles |
| `export-ifta` | Generate IFTA quarterly report |
| `export-tax-pack` | Generate tax summary |
| `upload-signed-url` | Secure file upload URLs |

## Commands

```bash
# Development
npx expo start                    # Start dev server
npx tsc --noEmit                  # TypeScript check

# Database
npx supabase link --project-ref kbohuorolouxqgtzmrsa
npx supabase db push              # Push migrations
npx supabase functions deploy     # Deploy edge functions

# Build
npx expo export --platform ios    # iOS export
npx expo export --platform android # Android export

# Git
git add -A && git commit -m "message" && git push origin main
```

## Market-Leading Features (Differentiators)

### 1. Load Profitability Calculator
**The #1 feature competitors lack.** Know if a load is worth it BEFORE you accept.
- Location: `app/(tabs)/calculator.tsx`
- Service: `src/services/load/loadCalculator.ts`
- Calculates ALL costs (fuel, maintenance, insurance, truck payment)
- Compares to industry benchmarks by trailer type
- Clear verdict: EXCELLENT / GOOD / MARGINAL / BAD / LOSS

### 2. Fuel Optimizer
Real-time fuel price optimization by state.
- Service: `src/services/fuel/fuelOptimizer.ts`
- Tax-aware pricing (knows state diesel taxes)
- Recommendations: FILL NOW / WAIT / FILL PARTIAL
- Shows potential savings by waiting for cheaper state

### 3. Broker/Shipper Ratings
Community-driven payment reliability ratings.
- Tables: `brokers`, `broker_ratings`
- Payment speed (1-5 stars)
- Communication rating
- Load accuracy (was it as described?)
- "Would work again" percentage
- Average days to pay

### 4. Detention Time Tracking
Bill for wait time at shippers/receivers.
- Table: `detention_events`
- Tracks arrival, loading start, departure times
- Calculates billable minutes (after 2-hour free time)
- Photo evidence support

### 5. Push Notifications
- IFTA quarterly deadline reminders (7 days before)
- Trip end reminders (don't lose your data)
- Daily profit summaries
- Payment alerts

### 6. Saved Lanes
Track frequently run routes with profitability stats.
- Table: `saved_lanes`
- Average rate, best rate, avg profit per lane
- Preferred brokers per lane

## App Store Assets

All assets are in `assets/appstore/`:

| Asset | File | Size |
|-------|------|------|
| App Icon | AppIcon-1024x1024.png | 1024x1024 |
| iPhone 6.5" (5) | iPhone-6.5-*.png | 1284x2778 |
| iPhone 5.5" (5) | iPhone-5.5-*.png | 1242x2208 |
| iPad 12.9" (1) | iPad-12.9-*.png | 2048x2732 |

**Full submission guide:** See `APP_STORE_SUBMISSION.md`

## Remaining Tasks for Launch (Jan 16, 2026)

### High Priority
- [x] Create App Store screenshots and icon
- [x] Deploy all edge functions to Supabase (deployed Jan 15, 2026)
- [x] Wire GPS tracking to trip lifecycle (location tracking now starts/stops with trips)
- [x] Implement subscription tier enforcement (free tier limits enforced)
- [x] Wire document upload to AI extraction edge function
- [x] Wire export generation to IFTA/tax edge functions
- [ ] Upload build to App Store Connect
- [ ] Final end-to-end testing on physical devices

### Medium Priority
- [x] Create admin screens (users.tsx, analytics.tsx, subscriptions.tsx, support.tsx)
- [ ] Implement bank sync integration
- [ ] Voice input for hands-free data entry

### Nice to Have
- [ ] iOS widgets for quick trip start
- [ ] Apple Watch companion app
- [ ] Dark/light theme toggle

## Recent Changes (Jan 17, 2026)

### Security Hardening (CRITICAL)
1. **trip-finalize vulnerability fixed** - Added user authentication and ownership verification
2. **Rate limiting** - Added to trip-finalize edge function
3. **Input validation** - UUID format validation on all endpoints
4. **Safe error responses** - Using `safeErrorResponse()` to prevent data leakage

### Pricing Updates
1. **Free tier reduced** - 5 trips/mo (was 10), 3 docs/mo (was 5) to prevent abuse
2. **Pro tier increased** - $14.99/mo (was $9.99), $119.99/yr (was $79.99)
3. **Premium tier increased** - $29.99/mo (was $19.99), $239.99/yr (was $149.99)
4. **Trip limit enforcement** - Monthly trip count tracked and enforced

### Navigation Fixes
1. **Settings access** - Added ⚙️ gear icon to Dashboard header
2. **Dev tab hidden** - Removed from production tab bar
3. **Profile setup** - "Set up your profile" now tappable, links to Settings

### Previous Changes (Jan 15-16, 2026)
- GPS Tracking Integration - Trip screen requests permissions, starts/stops tracking
- Jurisdiction Detection - State boundary detection integrated
- Subscription Enforcement - Free tier limits enforced with upgrade prompts
- Document Upload - Wired to `doc-ingest` edge function
- Export Generation - Wired to IFTA/tax edge functions
- Admin Screens - Created users, analytics, subscriptions, support screens
- Replaced uuid with expo-crypto - Fixed native module crash
- Fixed RLS profile update errors

### Edge Functions Deployed (All 8 Active)
| Function | Status | Security |
|----------|--------|----------|
| `validate-receipt` | ✅ Active | Rate limited, auth required |
| `doc-ingest` | ✅ Active | Rate limited, file validation |
| `trip-finalize` | ✅ Active | **Fixed** - User ownership verified |
| `export-ifta` | ✅ Active | Rate limited, auth required |
| `export-tax-pack` | ✅ Active | Rate limited, auth required |
| `ai-profit-analyzer` | ✅ Active | Rate limited, auth required |
| `ai-smart-suggestions` | ✅ Active | Rate limited, auth required |
| `upload-signed-url` | ✅ Active | Rate limited, file type validation |

### API Keys Configured
- ✅ OPENAI_API_KEY - Set in Supabase secrets
- ✅ ANTHROPIC_API_KEY - Set in Supabase secrets
- ⚠️ APPLE_SHARED_SECRET - Pending (needed for IAP validation)

## Testing Checklist

- [ ] Auth: Register → Login → Forgot Password → Reset
- [ ] Trips: Start → Track → End → View state miles
- [ ] Offline: Airplane mode → Record trip → Reconnect → Sync
- [ ] Documents: Capture receipt → AI extraction → Review → Save
- [ ] Subscriptions: View plans → Purchase (sandbox) → Verify tier change
- [ ] Admin: Login as admin → View dashboard → Audit log shows actions
- [ ] Accessibility: VoiceOver navigation → All screens readable
- [ ] IFTA Export: Complete trips in 3+ states → Generate report → Verify totals

## Legal Compliance

### Terms of Service / Privacy Policy
- Located in `src/constants/legal.ts`
- Viewable at `/(tabs)/settings/legal`
- Version: 1.0.0
- Effective Date: January 14, 2026

### Subscription Rules (Apple Guidelines)
- One-click cancellation via App Store
- Restore purchases available
- Terms displayed before purchase
- No dark patterns

### Data Protection
- GDPR: Data export, deletion, consent tracking
- CCPA: California privacy rights supported
- Location: Explicit opt-in required

## Admin Access

To make a user an admin:
```sql
INSERT INTO admin_users (id, role)
SELECT id, 'super_admin' FROM auth.users
WHERE email = 'your@email.com';
```

Admin roles: `super_admin`, `admin`, `support`, `analyst`

## Support Contacts

- Technical: support@cienrios.com
- Privacy: privacy@cienrios.com
- Phone: (754) 254-7141

---

**Note:** This file is used by Claude Code to understand the project context. Keep it updated as the project evolves.
