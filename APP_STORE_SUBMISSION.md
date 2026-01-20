# RoadLedger Pro - Apple App Store Submission Guide

**Last Updated:** January 20, 2026
**Status:** Resubmission after addressing 2.1 rejection

## App Information

| Field | Value |
|-------|-------|
| **App Name** | RoadLedger Pro |
| **App ID** | 6757956056 |
| **Subtitle** | Profit-First Trucking App |
| **Bundle ID** | com.roadledger.app |
| **SKU** | roadledger-ios-2026 |
| **Primary Language** | English (US) |
| **Category** | Business |
| **Secondary Category** | Finance |

## Company Information

| Field | Value |
|-------|-------|
| **Developer Name** | Cien Rios LLC |
| **Address** | 17113 Miramar Parkway, Miramar, FL 33027 |
| **Phone** | (754) 254-7141 |
| **Support Email** | support@cienrios.com |
| **Marketing URL** | https://paulmait.github.io/roadledger/ |
| **Privacy Policy URL** | https://paulmait.github.io/roadledger/privacy.html |
| **Terms of Service URL** | https://paulmait.github.io/roadledger/terms.html |

## App Store Assets

All assets are located in `assets/appstore/`

### App Icon
- **File:** `AppIcon-1024x1024.png`
- **Size:** 1024 x 1024 pixels
- **Format:** PNG (no alpha channel, no rounded corners)

### iPhone Screenshots (6.5" - Required)
For iPhone 14 Pro Max, iPhone 15 Pro Max (1284 x 2778):
1. `iPhone-6.5-01-Dashboard.png` - Profit dashboard
2. `iPhone-6.5-02-LoadCalculator.png` - Load calculator
3. `iPhone-6.5-03-TripTracking.png` - GPS trip tracking
4. `iPhone-6.5-04-Documents.png` - AI receipt scanning
5. `iPhone-6.5-05-IFTA.png` - IFTA reports

### iPhone Screenshots (5.5" - Required)
For iPhone 8 Plus (1242 x 2208):
1. `iPhone-5.5-01-Dashboard.png`
2. `iPhone-5.5-02-LoadCalculator.png`
3. `iPhone-5.5-03-TripTracking.png`
4. `iPhone-5.5-04-Documents.png`
5. `iPhone-5.5-05-IFTA.png`

### iPad Screenshots (12.9" - Required if supporting iPad)
For iPad Pro 12.9" (2048 x 2732):
1. `iPad-12.9-01-Overview.png`

## App Description

### Short Description (30 characters)
```
Track miles. Maximize profit.
```

### Full Description
```
RoadLedger is the profit-first app designed specifically for owner-operator truck drivers. Know exactly what you earn on every load, every mile, every day.

KEY FEATURES:

LOAD CALCULATOR
Know if a load is worth it BEFORE you accept. Enter the rate, miles, and deadhead - get an instant verdict on profitability. Compare to industry benchmarks and see your true profit after all costs.

AUTOMATIC GPS TRACKING
Track every mile by state with battery-optimized GPS. Perfect for IFTA reporting. Works offline when you're out of coverage.

AI RECEIPT SCANNING
Snap a photo of any receipt. Our AI automatically extracts vendor, date, amount, and category. No more manual data entry.

FUEL PRICE OPTIMIZER
Get recommendations on when and where to fill up. See which states have the cheapest diesel on your route.

BROKER RATINGS
Community-driven ratings show you which brokers pay fast vs. slow. Never get burned again.

IFTA REPORTS
Generate quarterly IFTA reports with one click. Miles by jurisdiction, fuel by state - ready to file.

PROFIT DASHBOARD
See your earnings at a glance. Daily, weekly, monthly breakdowns. Revenue vs. expenses. Profit per mile.

DESIGNED FOR OWNER-OPERATORS
- Offline-first: Works without internet
- Battery-optimized: GPS that doesn't drain your phone
- Privacy-focused: Your data stays yours
- Simple pricing: One low monthly fee

Start tracking your profit today. Download RoadLedger.
```

## Keywords (100 characters max)
```
trucker,IFTA,mileage,trucking,owner-operator,fuel,receipt,expense,profit,load,freight,CDL,tax
```

## What's New (Version 1.0.0)
```
Initial release of RoadLedger - the profit-first app for owner-operators.

- Load profitability calculator
- Automatic GPS mileage tracking
- AI-powered receipt scanning
- Fuel price optimization
- Broker/shipper ratings
- One-click IFTA reports
- Offline-first design
```

## In-App Purchases

### Subscription Products (UPDATED January 17, 2026)

| Product ID | Name | Price | Duration |
|------------|------|-------|----------|
| com.roadledger.pro.monthly | RoadLedger Pro | $14.99 | 1 month |
| com.roadledger.pro.yearly | RoadLedger Pro (Annual) | $119.99 | 1 year |
| com.roadledger.premium.monthly | RoadLedger Premium | $29.99 | 1 month |
| com.roadledger.premium.yearly | RoadLedger Premium (Annual) | $239.99 | 1 year |

### Subscription Group
- **Group Name:** RoadLedger Subscriptions
- **Group ID:** roadledger_subs

## App Review Information

### Demo Account (UPDATED January 20, 2026)
```
Email: roadledger.demo.review@gmail.com
Password: [See DEMO_CREDENTIALS.md - gitignored for security]
```

**Account Status:**
- Email confirmed: Yes
- Subscription tier: Premium (active until 2028)
- Full access to all features

> **Note:** Full credentials are in `DEMO_CREDENTIALS.md` which is gitignored for security.

### Notes for Reviewer
```
RoadLedger Pro is a comprehensive profit-tracking and compliance app for owner-operator truck drivers.

DEMO ACCOUNT ACCESS:
The demo account has PREMIUM tier access to test ALL features without restrictions.

HOW TO TEST EACH FEATURE:

1. DASHBOARD (Home Tab)
   - View profit overview and recent activity
   - Tap "Quick Actions" for common tasks
   - See AI-powered insights and suggestions

2. TRIP TRACKING (Trip Tab)
   - Tap "Start Trip" to begin GPS tracking
   - Grant location permissions when prompted
   - The app tracks miles by state for IFTA compliance
   - Tap "End Trip" to finalize (calculates jurisdiction miles)
   - Note: GPS tracking works best on physical device

3. LOAD CALCULATOR (Calculator Tab)
   - Enter load details: rate, miles, deadhead
   - See instant profitability analysis
   - Compare to industry benchmarks
   - Get clear verdict: EXCELLENT / GOOD / MARGINAL / BAD

4. DOCUMENTS (Documents Tab)
   - Tap "+" to add a new document
   - Select "Camera" to capture receipt/settlement
   - AI automatically extracts: vendor, date, amount, category
   - Review and save the transaction

5. TRANSACTIONS (Money Tab)
   - View all income and expenses
   - Add manual transactions
   - See profit calculations

6. EXPORTS (Exports Tab)
   - Generate IFTA quarterly reports
   - Export tax summaries
   - Download reports in PDF format

7. SUBSCRIPTION (Settings > Subscription)
   - View current plan and features
   - "Restore Purchases" button available
   - "Manage Subscription" links to App Store
   - Clear pricing and renewal terms displayed

8. ACCOUNT DELETION (Settings > Privacy Settings)
   - "Delete My Account" button available
   - Shows 30-day processing timeline
   - Complies with Apple guideline 5.1.1(v)

9. PRIVACY & LEGAL (Settings > Legal)
   - Privacy Policy accessible
   - Terms of Service accessible
   - All data handling disclosed

TECHNICAL NOTES:
- App requires iOS 15.1 or later
- Location permission required for trip tracking
- Camera permission required for document scanning
- Works offline with automatic sync when online
- All subscriptions use Apple's StoreKit 2

SUBSCRIPTION PRICING:
- Pro Monthly: $14.99/month
- Pro Yearly: $119.99/year (save 33%)
- Premium Monthly: $29.99/month
- Premium Yearly: $239.99/year (save 33%)

Free tier includes: 5 trips/month, 3 documents/month

Contact: support@cienrios.com
Phone: (754) 254-7141
```

## Content Rights

- [x] I own or have licensed all content
- [x] App does not contain third-party content requiring authorization
- [x] App complies with COPPA (not directed at children)

## Age Rating

| Content | Rating |
|---------|--------|
| Cartoon/Fantasy Violence | None |
| Realistic Violence | None |
| Profanity | None |
| Sexual Content | None |
| Nudity | None |
| Mature/Suggestive Themes | None |
| Alcohol, Tobacco, Drugs | None |
| Gambling | None |
| Horror/Fear | None |
| Medical/Treatment Info | None |
| **Age Rating** | **4+** |

## Privacy

### Data Collection
- Location (while using app) - For GPS mileage tracking
- Identifiers - For account authentication
- Usage Data - For app analytics
- Photos - For receipt/document scanning

### Data Linked to User
- Contact Info (email)
- User Content (documents, trips)
- Identifiers (user ID)
- Usage Data

### Privacy Policy URL
https://paulmait.github.io/roadledger/privacy.html

## Export Compliance

- [x] App does not use encryption OR uses only exempt encryption
- App uses HTTPS for data transmission (exempt)

## Submission Checklist

- [x] App icon uploaded (1024x1024)
- [x] Screenshots uploaded (6.5", 5.5", 12.9")
- [x] App description completed
- [x] Keywords set
- [x] Privacy policy URL set
- [x] In-app purchases configured
- [x] Age rating questionnaire completed
- [x] Demo account credentials provided
- [ ] Build uploaded via Xcode/Transporter
- [ ] Build selected for review
- [ ] Submit for review

## Timeline

| Step | Date |
|------|------|
| Assets Created | January 14, 2026 |
| App Store Connect Setup | January 14-15, 2026 |
| Build Upload | January 15, 2026 |
| Submit for Review | January 15, 2026 |
| Expected Approval | January 16-17, 2026 |
| Target Launch | January 16, 2026 |

---

*Generated by RoadLedger Asset Generator*
*Last Updated: January 14, 2026*
