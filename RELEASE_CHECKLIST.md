# Release Checklist

Use this checklist before each production release of RoadLedger.

## Pre-Release

### Code Quality
- [ ] All TypeScript errors resolved (`npx tsc --noEmit`)
- [ ] ESLint passes (`npm run lint`)
- [ ] No console.log statements in production code
- [ ] All TODO/FIXME items addressed or tracked

### Testing
- [ ] Unit tests pass (`npm test`)
- [ ] E2E golden path tests pass
- [ ] Manual testing on iOS simulator
- [ ] Manual testing on Android emulator
- [ ] Real device testing (at least one iOS + Android)

### Security
- [ ] `npm audit` shows no high/critical vulnerabilities
- [ ] No secrets in codebase (grep for API keys, passwords)
- [ ] RLS policies tested for new tables
- [ ] Edge Functions validate ownership

### Database
- [ ] Migrations are idempotent (can run multiple times)
- [ ] Indexes added for new queries
- [ ] Constraints added for data integrity
- [ ] Backup taken before destructive migrations

---

## Release Process

### 1. Version Bump
- [ ] Update `version` in `app.json`
- [ ] Update `CHANGELOG.md` with release notes
- [ ] Create git tag: `git tag v1.0.0`

### 2. Database Migrations
```bash
# Push migrations to Supabase
supabase db push

# Verify in Supabase Dashboard
```
- [ ] Migrations applied successfully
- [ ] Verify RLS policies active
- [ ] Verify triggers working

### 3. Edge Functions
```bash
# Deploy all functions
supabase functions deploy

# Verify secrets are set
# Dashboard > Project Settings > Edge Functions > Secrets
```
- [ ] All functions deployed
- [ ] OPENAI_API_KEY set
- [ ] ANTHROPIC_API_KEY set
- [ ] APPLE_SHARED_SECRET set (if using IAP)

### 4. EAS Build
```bash
# Build for both platforms
eas build --platform all --profile production

# Submit to stores
eas submit --platform all
```
- [ ] iOS build succeeds
- [ ] Android build succeeds
- [ ] iOS submitted to App Store Connect
- [ ] Android submitted to Google Play Console

### 5. App Store Submission

#### Apple App Store
- [ ] Screenshots uploaded for all device sizes
- [ ] App description updated
- [ ] Keywords optimized
- [ ] Privacy policy URL valid
- [ ] Age rating accurate
- [ ] In-App Purchases configured
- [ ] Submit for review

#### Google Play Store
- [ ] Screenshots uploaded
- [ ] Feature graphic uploaded
- [ ] Store listing updated
- [ ] Content rating questionnaire complete
- [ ] Data safety form complete
- [ ] Submit for review

---

## Post-Release

### Monitoring (First 24 hours)
- [ ] Check Supabase logs for errors
- [ ] Check EAS crash reports
- [ ] Monitor user feedback/reviews
- [ ] Verify analytics events flowing

### Communication
- [ ] Notify beta testers of release
- [ ] Update documentation if needed
- [ ] Social media announcement (if applicable)

### Cleanup
- [ ] Archive previous release notes
- [ ] Clean up test data if any
- [ ] Update project board/tickets

---

## Rollback Plan

If critical issues are discovered:

### App Rollback (OTA Update)
```bash
# Revert to previous version via EAS Update
eas update --branch production --message "Rollback to v1.0.0"
```

### Database Rollback
```bash
# If migration caused issues, restore from backup
# Contact Supabase support for point-in-time recovery
```

### Edge Functions Rollback
```bash
# Redeploy previous version from git
git checkout v1.0.0
supabase functions deploy
```

---

## Emergency Contacts

| Role | Contact |
|------|---------|
| Lead Developer | [Your contact] |
| Supabase Support | support@supabase.io |
| EAS/Expo Support | https://expo.dev/contact |
| Apple Developer | https://developer.apple.com/contact |
| Google Play | https://support.google.com/googleplay/android-developer |

---

## Version History

| Version | Date | Status |
|---------|------|--------|
| v0.1.0 | 2026-01-14 | Development |

---

Last updated: 2026-01-14
