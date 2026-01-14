# RoadLedger Security Test Plan

## Overview

This document outlines the security testing strategy for RoadLedger, covering all attack surfaces and verification procedures.

**Last Updated:** 2026-01-14
**Classification:** Internal

---

## 1. Attack Surface Inventory

### 1.1 Client (Expo App)
- Authentication flows (login, register, password reset)
- Supabase function invocations
- Data rendering (extraction results, user data)
- Deep link handling
- Secure storage usage

### 1.2 Supabase Postgres
- Row Level Security (RLS) policies on all tables
- Database functions and triggers
- Unique constraints and indexes
- Foreign key relationships

### 1.3 Supabase Storage
- Private bucket configuration
- Storage policies (user folder isolation)
- Signed URL generation
- MIME type restrictions
- File size limits

### 1.4 Edge Functions
| Function | Purpose | Risk Level |
|----------|---------|------------|
| `doc-ingest` | AI document extraction | HIGH |
| `upload-signed-url` | Generate upload URLs | MEDIUM |
| `validate-receipt` | IAP validation | HIGH |
| `trip-finalize` | Calculate jurisdiction miles | LOW |
| `export-ifta` | Generate IFTA reports | LOW |
| `export-tax-pack` | Generate tax summaries | LOW |
| `ai-profit-analyzer` | Trip profitability | LOW |
| `ai-smart-suggestions` | AI recommendations | LOW |

### 1.5 AI/OCR Providers
- OpenAI GPT-4 Vision
- Anthropic Claude (fallback)
- Prompt injection risks
- Cost explosion risks
- Data exfiltration risks

---

## 2. Security Test Categories

### 2.1 RLS + IDOR Tests (CRITICAL)

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| RLS-001 | User A cannot SELECT User B's documents | 0 rows returned |
| RLS-002 | User A cannot UPDATE User B's documents | Error/0 rows affected |
| RLS-003 | User A cannot DELETE User B's documents | Error/0 rows affected |
| RLS-004 | User A cannot SELECT User B's trips | 0 rows returned |
| RLS-005 | User A cannot SELECT User B's transactions | 0 rows returned |
| RLS-006 | User A cannot INSERT document with User B's user_id | Error |
| RLS-007 | User A cannot access User B's trip_points | 0 rows returned |
| RLS-008 | User A cannot access User B's jurisdiction_miles | 0 rows returned |
| RLS-009 | Unauthenticated user cannot access any table | Error |

### 2.2 Storage Security Tests

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| STG-001 | User A cannot list User B's files | Empty/Error |
| STG-002 | User A cannot download User B's files | 403 Forbidden |
| STG-003 | Path traversal attempt (../) rejected | 400 Bad Request |
| STG-004 | Path traversal encoded (%2e%2e) rejected | 400 Bad Request |
| STG-005 | Invalid bucket name rejected | 400 Bad Request |
| STG-006 | Oversized file rejected | 400 Bad Request |
| STG-007 | Invalid MIME type rejected | 400 Bad Request |
| STG-008 | Upload to wrong user folder rejected | 403 Forbidden |

### 2.3 Edge Function Auth Tests

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| AUTH-001 | Missing Authorization header | 401 Unauthorized |
| AUTH-002 | Invalid/expired token | 401 Unauthorized |
| AUTH-003 | Malformed Bearer token | 401 Unauthorized |
| AUTH-004 | doc-ingest: process other user's doc | 404 Not Found |
| AUTH-005 | validate-receipt: reuse transaction ID | 400 Already Used |
| AUTH-006 | Rate limit exceeded | 429 Too Many Requests |

### 2.4 Input Validation Tests

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| INP-001 | Invalid UUID format rejected | 400 Bad Request |
| INP-002 | Unknown fields stripped/rejected | 400 or stripped |
| INP-003 | Oversized JSON payload rejected | 400 Bad Request |
| INP-004 | SQL injection in vendor field | Escaped/safe |
| INP-005 | XSS payload in extraction | Escaped/safe |
| INP-006 | Negative amount rejected | 400 or constraint error |

### 2.5 Idempotency Tests

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| IDEMP-001 | Retry doc-ingest 3x creates exactly 1 transaction | 1 transaction |
| IDEMP-002 | Already-parsed document returns cached result | cached: true |
| IDEMP-003 | Duplicate transaction insert blocked by constraint | Upsert behavior |

### 2.6 AI/OCR Security Tests

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| AI-001 | Prompt injection in receipt text | No behavior change |
| AI-002 | "Ignore instructions" in PDF | Schema-only output |
| AI-003 | Very long text (>120KB) | Truncated before AI |
| AI-004 | Control characters stripped | Clean text to AI |
| AI-005 | OCR text not in logs | Logs contain [REDACTED] |

### 2.7 CORS + Headers Tests

| Test ID | Description | Expected Result |
|---------|-------------|-----------------|
| CORS-001 | Disallowed origin blocked | CORS error |
| CORS-002 | X-Content-Type-Options present | nosniff |
| CORS-003 | Cache-Control on sensitive responses | no-store |
| CORS-004 | OPTIONS preflight handled | 200 OK with headers |

---

## 3. Test Implementation

### 3.1 Test Files

```
__tests__/
├── security/
│   ├── rls.test.ts           # RLS-001 through RLS-009
│   ├── storage.test.ts       # STG-001 through STG-008
│   ├── auth.test.ts          # AUTH-001 through AUTH-006
│   ├── input.test.ts         # INP-001 through INP-006
│   ├── idempotency.test.ts   # IDEMP-001 through IDEMP-003
│   └── ai-injection.test.ts  # AI-001 through AI-005
```

### 3.2 Running Tests

```bash
# Run all security tests
npm run test:security

# Run specific category
npm run test:security -- --grep "RLS"
npm run test:security -- --grep "Storage"
```

### 3.3 Prerequisites

- Local Supabase running (`supabase start`)
- Test users seeded (userA, userB)
- Test data seeded (documents, trips, transactions)

---

## 4. Golden Security Assertions

These assertions MUST pass before any release:

1. **RLS Isolation**: User A fetching User B's document returns 0 rows
2. **Storage Isolation**: User A cannot access User B's storage path
3. **Edge Function Auth**: Missing/invalid auth returns 401
4. **Ownership Verification**: doc-ingest for wrong user returns 404
5. **Idempotency**: Retry creates no duplicates (DB constraint enforced)
6. **Signed URL Path**: Cannot upload outside auth.uid() prefix
7. **Rate Limiting**: Exceeding limit returns 429
8. **No Secrets in Logs**: Logs sanitized of sensitive data

---

## 5. Incident Response Checklist

If a security issue is discovered:

1. **Immediate**: Rotate compromised keys/tokens
2. **Investigate**: Check Supabase logs for unauthorized access
3. **Contain**: Disable affected endpoint if needed
4. **Fix**: Deploy patch via EAS Update
5. **Document**: Update SECURITY.md and CHANGELOG.md

---

## 6. Evidence Collection

For each test category, collect:

- Test output showing pass/fail
- Database query results
- API response codes and bodies
- Log samples (sanitized)

Store evidence in `__tests__/security/evidence/` for audit purposes.

---

## Appendix A: Test User Setup

```sql
-- Create test users (run in local Supabase)
-- userA: test-user-a@roadledger-test.com
-- userB: test-user-b@roadledger-test.com
```

## Appendix B: Test Data Schema

```sql
-- Test document owned by userA
-- Test document owned by userB
-- Test trip owned by userA
-- Test transaction owned by userA
```

---

*This document is confidential and for internal use only.*
