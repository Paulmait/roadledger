# Changelog

All notable changes to RoadLedger will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Production hardening for all Edge Functions
- AI provider fallback (OpenAI → Anthropic)
- Rate limiting infrastructure
- Comprehensive input validation
- Circuit breaker pattern for external services
- E2E golden path test suite
- GitHub Actions CI/CD pipeline
- SECURITY.md documentation
- Load profitability calculator
- Fuel price optimizer with state tax rates
- Broker/shipper ratings system
- Detention time tracking
- Push notification service
- App Store assets and submission guide

### Changed
- doc-ingest function now validates ownership before processing
- Upload signed URLs validate MIME types strictly
- All Edge Functions return consistent error shapes
- Improved logging with request IDs

### Security
- Added idempotency checks to prevent duplicate transactions
- Implemented rate limiting (5-20 req/min per function)
- Added path traversal protection in file uploads
- Sensitive data sanitization in logs
- User ID tampering prevention triggers

## [0.1.0] - 2026-01-14

### Added
- Initial RoadLedger implementation
- Expo SDK 54 with TypeScript
- Expo Router file-based navigation
- Supabase backend (Auth, Database, Storage, Edge Functions)
- GPS trip tracking with background location
- Battery-aware tracking modes (Precision/Battery Saver)
- Offline-first architecture with SQLite
- State jurisdiction detection via bundled GeoJSON
- Document capture (camera, gallery, PDF)
- AI-powered receipt/settlement extraction (GPT-4 Vision)
- Auto-transaction creation from documents
- IFTA quarterly report generation
- Tax pack export with receipt bundle
- Zustand state management
- React Query for server state
- Apple StoreKit 2 integration for subscriptions

### Database Schema
- profiles (user information)
- trips (trip records)
- trip_points (GPS coordinates)
- jurisdiction_miles (miles per state)
- documents (uploaded receipts/settlements)
- transactions (income/expense records)
- exports (IFTA/tax reports)
- subscriptions (IAP management)

### Edge Functions
- upload-signed-url: Secure file upload URLs
- doc-ingest: AI document extraction
- trip-finalize: Calculate jurisdiction miles
- export-ifta: Generate IFTA reports
- export-tax-pack: Generate tax summaries
- validate-receipt: Apple IAP validation
- ai-profit-analyzer: Trip profitability analysis
- ai-smart-suggestions: Intelligent recommendations

---

## Version History Notes

### Versioning Strategy

- **Major (X.0.0)**: Breaking changes, major feature additions
- **Minor (0.X.0)**: New features, non-breaking changes
- **Patch (0.0.X)**: Bug fixes, security patches

### Release Process

1. Update CHANGELOG.md with changes
2. Bump version in app.json
3. Create git tag
4. EAS build and submit
5. Monitor crash reports post-release

---

[Unreleased]: https://github.com/cienrios/roadledger/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/cienrios/roadledger/releases/tag/v0.1.0
