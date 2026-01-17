# Master Prompt: Get App to 100% App Store Ready

**Copy this entire prompt and give it to Claude Code for any app you want to make production-ready and submit to the App Store.**

---

## THE PROMPT

```
I need you to get this app 100% production-ready and submitted to the App Store. Follow this complete checklist and fix any issues you find.

## PHASE 1: CODEBASE AUDIT & HARDENING

### 1.1 Security Audit
- [ ] Check all API keys are in environment variables (not hardcoded)
- [ ] Verify no secrets in git history
- [ ] Ensure all API endpoints have authentication
- [ ] Add rate limiting to all public endpoints
- [ ] Validate all user inputs (sanitize, type check, length limits)
- [ ] Check for SQL injection vulnerabilities
- [ ] Check for XSS vulnerabilities
- [ ] Ensure HTTPS for all network requests
- [ ] Add request signing or API key validation for sensitive endpoints
- [ ] Implement proper error handling (don't expose stack traces)

### 1.2 Authentication Hardening
- [ ] Password requirements enforced (min 8 chars, complexity)
- [ ] Session timeout implemented
- [ ] Secure token storage (Keychain/SecureStore, not AsyncStorage)
- [ ] Password reset flow working
- [ ] Email verification (if applicable)
- [ ] Biometric authentication option (Face ID/Touch ID)

### 1.3 Data Protection
- [ ] Sensitive data encrypted at rest
- [ ] PII handling compliant with GDPR/CCPA
- [ ] Data deletion capability (user can delete account)
- [ ] Data export capability (user can request their data)
- [ ] Privacy policy accurately reflects data practices

### 1.4 Code Quality
- [ ] No console.log statements in production code
- [ ] No TODO/FIXME comments for critical items
- [ ] TypeScript strict mode enabled (if using TS)
- [ ] No unused imports or variables
- [ ] Error boundaries for React components
- [ ] Proper loading states for all async operations
- [ ] Proper error states for all async operations

## PHASE 2: iOS SPECIFIC REQUIREMENTS

### 2.1 Info.plist Configuration (app.json for Expo)
Check and fix these in app.json → expo → ios → infoPlist:

- [ ] All required permission descriptions are user-friendly and explain WHY
- [ ] NSLocationWhenInUseUsageDescription (if using location)
- [ ] NSLocationAlwaysAndWhenInUseUsageDescription (if background location)
- [ ] NSCameraUsageDescription (if using camera)
- [ ] NSPhotoLibraryUsageDescription (if accessing photos)
- [ ] NSMicrophoneUsageDescription (if recording audio)
- [ ] NSFaceIDUsageDescription (if using Face ID)
- [ ] UIBackgroundModes properly configured
- [ ] BGTaskSchedulerPermittedIdentifiers (if UIBackgroundModes includes "processing")
- [ ] ITSAppUsesNonExemptEncryption set to false (unless using custom encryption)

### 2.2 App Transport Security
- [ ] All API calls use HTTPS
- [ ] No ATS exceptions unless absolutely necessary

### 2.3 Required Capabilities
- [ ] Only request capabilities actually used
- [ ] Associated Domains configured (if using universal links)
- [ ] Push notifications configured (if using)

## PHASE 3: SUBSCRIPTION/IAP SETUP (If Applicable)

### 3.1 StoreKit Integration
- [ ] Products defined with correct IDs matching App Store Connect
- [ ] Purchase flow implemented
- [ ] Restore purchases implemented (REQUIRED by Apple)
- [ ] Receipt validation on server-side
- [ ] Subscription status checking
- [ ] Grace period handling
- [ ] Cancellation handling

### 3.2 Product IDs Convention
Use this naming: com.[company].[app].[tier].[period]
Example: com.mycompany.myapp.pro.monthly

### 3.3 Subscription UI Requirements (Apple Guidelines)
- [ ] Clear pricing displayed BEFORE purchase button
- [ ] Subscription terms clearly visible
- [ ] Easy access to cancel/manage subscription (link to App Store settings)
- [ ] No dark patterns or misleading UI

## PHASE 4: TESTING

### 4.1 Functional Testing
- [ ] All main user flows work end-to-end
- [ ] Authentication flow (register, login, logout, password reset)
- [ ] Core features work correctly
- [ ] Edge cases handled (empty states, errors, timeouts)
- [ ] Deep links work (if applicable)
- [ ] Push notifications work (if applicable)

### 4.2 Device Testing
- [ ] Test on oldest supported iOS version
- [ ] Test on latest iOS version
- [ ] Test on smallest screen (iPhone SE)
- [ ] Test on largest screen (iPhone 15 Pro Max)
- [ ] Test on iPad (if app supports)
- [ ] Test in Dark Mode
- [ ] Test in Light Mode
- [ ] Test with Large Text accessibility setting

### 4.3 Network Testing
- [ ] Test with slow network (3G simulation)
- [ ] Test with no network (airplane mode)
- [ ] Test network recovery (lose connection, then restore)
- [ ] Offline functionality works (if applicable)

### 4.4 Performance Testing
- [ ] App launches in < 3 seconds
- [ ] No UI freezes during normal use
- [ ] Memory usage is reasonable
- [ ] No memory leaks
- [ ] Battery usage is reasonable

## PHASE 5: APP STORE ASSETS

### 5.1 App Icon
- [ ] 1024x1024px PNG, no transparency, no rounded corners
- [ ] Looks good at small sizes (check at 60x60)
- [ ] No text in icon (usually)
- [ ] Follows Apple Human Interface Guidelines

### 5.2 Screenshots (Generate with Node.js sharp)
Generate all required sizes from source screenshots:

| Device | Dimensions | Required |
|--------|------------|----------|
| iPhone 6.7" | 1290 x 2796 px | Yes |
| iPhone 6.5" | 1284 x 2778 px | Yes |
| iPad 13" | 2064 x 2752 px | If supports iPad |

Minimum 1 screenshot per size, maximum 10.

### 5.3 Subscription Images (If Applicable)
- [ ] 1024x1024px for each subscription product

## PHASE 6: LEGAL & COMPLIANCE

### 6.1 Privacy Policy
- [ ] Hosted on accessible URL (e.g., GitHub Pages)
- [ ] Covers all data collection
- [ ] Includes contact information
- [ ] GDPR compliant (if serving EU users)
- [ ] CCPA compliant (if serving California users)

### 6.2 Terms of Service
- [ ] Hosted on accessible URL
- [ ] Covers subscription terms (if applicable)
- [ ] Covers user responsibilities
- [ ] Includes dispute resolution

### 6.3 Create GitHub Pages (if needed)
Create docs/ folder with:
- index.html (landing page)
- privacy.html (privacy policy)
- terms.html (terms of service)

Enable GitHub Pages: Settings → Pages → Source: main branch, /docs folder

## PHASE 7: APP STORE CONNECT SETUP

### 7.1 App Information
- [ ] App name (30 chars max)
- [ ] Subtitle (30 chars max)
- [ ] Category selected
- [ ] Content rating completed

### 7.2 Pricing & Availability
- [ ] Price tier selected (Free if using IAP)
- [ ] Availability regions selected

### 7.3 App Privacy
Complete the App Privacy questionnaire:
- [ ] List all data types collected
- [ ] Mark if linked to user identity
- [ ] Mark if used for tracking
- [ ] Select purposes for each data type

### 7.4 Version Information
- [ ] Screenshots uploaded for all device sizes
- [ ] App previews uploaded (optional)
- [ ] Promotional text (170 chars)
- [ ] Description (4000 chars max)
- [ ] Keywords (100 chars, comma-separated)
- [ ] Support URL
- [ ] Marketing URL
- [ ] Privacy Policy URL
- [ ] What's New text

### 7.5 App Review Information
- [ ] Contact first name, last name, phone, email
- [ ] Demo account credentials
- [ ] Notes for reviewer (testing instructions)

### 7.6 In-App Purchases (If Applicable)
- [ ] Subscription group created
- [ ] All products created with correct IDs
- [ ] Prices set
- [ ] Display names and descriptions
- [ ] Promotional images uploaded
- [ ] Grace period enabled (16 days recommended)

## PHASE 8: BUILD & SUBMIT

### 8.1 Pre-Build Checks
- [ ] Version number incremented if needed
- [ ] All environment variables set for production
- [ ] eas.json configured with correct ASC App ID

### 8.2 Build Commands
```bash
# Build production iOS
eas build --platform ios --profile production

# Submit to App Store Connect
eas submit --platform ios --latest
```

### 8.3 Post-Submit
- [ ] Build appears in App Store Connect
- [ ] Build selected in version
- [ ] All metadata complete
- [ ] Click "Add for Review"
- [ ] Submit for review

## PHASE 9: FINAL VERIFICATION

Before clicking submit, verify:
- [ ] App doesn't crash on launch
- [ ] All screenshots match actual app
- [ ] Privacy policy URL works
- [ ] Support URL works
- [ ] Demo account works
- [ ] In-app purchases work in sandbox

---

## OUTPUT REQUIRED

After completing each phase, provide:
1. Summary of issues found and fixed
2. Any remaining issues that need manual attention
3. Confirmation that phase is complete

At the end, provide:
1. Full submission status
2. Any warnings or items to monitor
3. Next steps after Apple review

---

## COMPANY INFORMATION (UPDATE FOR YOUR APP)

Company: [Your Company Name]
Address: [Your Address]
Phone: [Your Phone]
Email: [Your Email]
Support Email: [Your Support Email]

Apple Developer Account:
- Apple ID: [Your Apple ID Email]
- Team ID: [Your Team ID]

---

Now analyze this codebase and execute the checklist. Start with Phase 1.
```

---

## HOW TO USE THIS PROMPT

1. **Copy the entire prompt above** (everything inside the ``` code block)
2. **Update the company information** section at the bottom with your details
3. **Open Claude Code** in your app's directory
4. **Paste the prompt** and press Enter
5. **Claude will systematically** go through each phase
6. **Answer any questions** Claude asks about your specific app

---

## NOTES

- Claude will adapt the checklist to your specific app (skip irrelevant items)
- Some items require manual action (Apple Developer Portal, App Store Connect)
- Keep this prompt updated as Apple requirements change
- Typical time to complete: 2-4 hours depending on app complexity

---

## QUICK COMMANDS REFERENCE

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Build iOS production
eas build --platform ios --profile production

# Submit to App Store
eas submit --platform ios --latest

# Check build status
eas build:list

# Install sharp for image resizing
npm install sharp --save-dev
```

---

## SCREENSHOT RESIZE SCRIPT

Save as `scripts/resize-screenshots.js`:

```javascript
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const configs = [
  { width: 1284, height: 2778, folder: 'iphone-6.5' },
  { width: 1290, height: 2796, folder: 'iphone-6.7' },
  { width: 2064, height: 2752, folder: 'ipad-13' },
];

const sourceDir = process.argv[2] || './screenshots';
const outputBase = './assets/appstore';

async function resize() {
  const files = fs.readdirSync(sourceDir).filter(f =>
    /\.(png|jpg|jpeg)$/i.test(f)
  );

  for (const config of configs) {
    const outDir = path.join(outputBase, config.folder);
    fs.mkdirSync(outDir, { recursive: true });

    for (let i = 0; i < files.length; i++) {
      const input = path.join(sourceDir, files[i]);
      const output = path.join(outDir,
        `screenshot-${String(i+1).padStart(2,'0')}-${config.width}x${config.height}.png`
      );

      await sharp(input)
        .resize(config.width, config.height, { fit: 'cover', position: 'top' })
        .png()
        .toFile(output);

      console.log(`✓ ${config.folder}: ${files[i]}`);
    }
  }
  console.log('\nDone! Upload from:', outputBase);
}

resize().catch(console.error);
```

Run with: `node scripts/resize-screenshots.js ./path/to/source/screenshots`

---

**Created from RoadLedger Pro submission experience - January 2026**
