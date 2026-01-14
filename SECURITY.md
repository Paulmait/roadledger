# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in RoadLedger, please report it responsibly:

**Email:** security@cienrios.com

**Please include:**
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Your contact information (optional, for follow-up)

**Response Timeline:**
- Acknowledgment: Within 48 hours
- Initial assessment: Within 7 days
- Fix timeline: Communicated after assessment

We appreciate responsible disclosure and will credit researchers who report valid vulnerabilities (with permission).

---

## Security Architecture

### Authentication & Authorization

| Layer | Implementation |
|-------|---------------|
| **Client Auth** | Supabase Auth with JWT tokens |
| **Token Storage** | expo-secure-store (iOS Keychain / Android Keystore) |
| **Session Management** | Auto-refresh with 1-hour access tokens |
| **Authorization** | Row Level Security (RLS) on all tables |

### Data Protection

| Data Type | Protection |
|-----------|------------|
| **Auth Tokens** | AES-256 encrypted in secure storage |
| **User Data** | RLS ensures user can only access own data |
| **Documents** | Stored in private Supabase Storage buckets |
| **API Keys** | Never exposed to client; stored in Edge Function secrets |

### Edge Functions Security

All Edge Functions implement:

1. **Authentication Verification**
   - JWT token validation
   - User ID extraction from verified token

2. **Authorization Checks**
   - Ownership verification before data access
   - RLS as secondary protection layer

3. **Rate Limiting**
   - Per-user limits (5-20/minute depending on function)
   - Circuit breaker for AI providers

4. **Input Validation**
   - UUID format validation
   - MIME type validation
   - File size limits (10MB max)
   - JSON schema validation

5. **Safe Error Handling**
   - Generic error messages to client
   - Detailed logging server-side (sanitized)
   - No stack traces in responses

### Database Security

```sql
-- RLS enabled on all tables
ALTER TABLE tablename ENABLE ROW LEVEL SECURITY;

-- User isolation
CREATE POLICY "Users can only access own data"
ON tablename FOR ALL
USING (auth.uid() = user_id);

-- Prevent user_id tampering
CREATE TRIGGER prevent_user_change
BEFORE UPDATE ON tablename
FOR EACH ROW
EXECUTE FUNCTION prevent_user_id_change();
```

### OWASP Top 10 Mitigations

| Vulnerability | Mitigation |
|---------------|------------|
| **A01 Broken Access Control** | RLS, ownership verification, JWT validation |
| **A02 Cryptographic Failures** | expo-secure-store, HTTPS only, no sensitive data in logs |
| **A03 Injection** | Parameterized queries (Supabase), input validation |
| **A04 Insecure Design** | Defense in depth, principle of least privilege |
| **A05 Security Misconfiguration** | Strict CORS, no debug info in prod |
| **A06 Vulnerable Components** | npm audit in CI, dependency updates |
| **A07 Auth Failures** | Rate limiting, secure token storage |
| **A08 Data Integrity** | Signed uploads, JWT verification |
| **A09 Logging Failures** | Structured logging, request IDs |
| **A10 SSRF** | No user-controlled URLs in server requests |

---

## Security Checklist

### Pre-Production

- [x] RLS enabled on all tables
- [x] All Edge Functions validate JWT
- [x] Ownership checks in data access
- [x] Rate limiting implemented
- [x] Input validation on all endpoints
- [x] expo-secure-store for token storage
- [x] No secrets in client code
- [x] npm audit passes
- [x] Signed upload URLs with expiry
- [x] AI provider keys server-side only

### Deployment

- [ ] Supabase project in production mode
- [ ] Custom domain configured
- [ ] SSL/TLS verified
- [ ] Edge Function secrets set
- [ ] Monitoring/alerting configured
- [ ] Backup policy established

### Ongoing

- [ ] Weekly dependency audit
- [ ] Quarterly security review
- [ ] Annual penetration test
- [ ] Incident response plan documented

---

## Secrets Management

### Client (Expo App)

Only these environment variables should be in client:
```
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...  # Public, RLS-protected
```

### Edge Functions (Server)

Set via Supabase Dashboard > Project Settings > Edge Functions > Secrets:
```
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
APPLE_SHARED_SECRET=...
```

### CI/CD (GitHub Actions)

Set via Repository > Settings > Secrets:
```
EXPO_TOKEN=...
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
CODECOV_TOKEN=...  # Optional
```

---

## Incident Response

1. **Detection**: Monitor Edge Function logs for anomalies
2. **Containment**: Revoke compromised tokens/keys immediately
3. **Eradication**: Deploy fix via EAS Update
4. **Recovery**: Verify fix, restore services
5. **Lessons Learned**: Document and improve

---

## Contact

- **Security Issues:** security@cienrios.com
- **General Support:** support@roadledger.app

Last updated: 2026-01-14
