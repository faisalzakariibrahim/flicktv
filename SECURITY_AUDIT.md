# FlickTV Security Audit Report

**Date:** 2026-06-10
**Auditor:** OWL (Flicktek Security)
**Scope:** FlickTV API, Stream Proxy, Authentication, Data Protection, Infrastructure
**Codebase:** /Users/kingfaisal/projects/flicktv (production server.js + backend/src/)

---

## Executive Summary

FlickTV is an IPTV streaming platform built with Node.js/Express, Supabase, and Anthropic Claude. The application has a solid security foundation (Helmet, CORS, rate limiting, Supabase RLS, JWT auth), but has several **critical** and **high** severity issues that need immediate attention — particularly around SSRF, credential exposure, and authentication bypass paths.

**Overall Risk: HIGH**

---

## CRITICAL Findings

### C-01: Hardcoded Plex Token in Source Code
**Severity:** CRITICAL
**File:** server.js, line 139
**CWE:** CWE-798 (Use of Hardcoded Credentials)

```
fetchHeaders['X-Plex-Token'] = '9F1pDPzr73oL_idfzXye';
```

A Plex web player authentication token is hardcoded in the production server source. Anyone with access to the source code (including the git history) can use this token to access Plex EPG data. Since this is in a git repository, the token persists in history even if removed later.

**Impact:** Unauthorized access to Plex EPG provider, potential data scraping, abuse of Plex infrastructure.
**Remediation:**
- Remove the token from source code immediately
- Rotate the token on Plex's side
- Store it in environment variables if needed
- Add .env to .gitignore and audit git history for other leaked secrets

---

### C-02: Stream Proxy SSRF (Server-Side Request Forgery)
**Severity:** CRITICAL
**File:** server.js, lines 121-180 (/api/proxy/stream)
**CWE:** CWE-918 (Server-Side Request Forgery)

The `/api/proxy/stream` endpoint takes a user-supplied `url` query parameter and fetches it server-side with **zero URL validation**:

```javascript
app.get('/api/proxy/stream', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL required' });
  const decoded = decodeURIComponent(url);
  const response = await fetch(decoded, { ... });
```

An attacker can use this to:
- Access internal network resources (http://169.254.169.254/ for cloud metadata)
- Scan internal ports (http://localhost:3001/admin, http://localhost:6379/)
- Access cloud provider metadata endpoints (AWS, GCP, Azure)
- Hit internal Railway/Supabase endpoints

**Note:** The `backend/src/server.js` version has `verifyToken` middleware, but the **production `server.js`** does NOT apply `verifyToken` to the proxy endpoint — it is completely unauthenticated.

**Impact:** Full SSRF — internal network access, cloud metadata theft, potential RCE via internal services.
**Remediation:**
- Implement URL allowlisting (only permit known CDN/stream domains)
- Block private/internal IP ranges (10.x, 172.16-31.x, 192.168.x, 127.x, 169.254.x)
- Block file://, gopher://, and other non-HTTP schemes
- Apply `verifyToken` or `requireAuth` middleware to the proxy endpoint
- Validate URL scheme is http/https only
- Set `redirect: 'manual'` to prevent redirect-based bypasses

---

### C-03: Admin Authentication Bypass via Password in Query Parameter
**Severity:** CRITICAL
**File:** middleware/auth.js, lines 49-53 and 74-81
**CWE:** CWE-287 (Improper Authentication)

```javascript
const pwd = req.headers['x-admin-password'] || req.query.admin_password;
if (pwd && pwd === process.env.ADMIN_PASSWORD) {
  req.user = { role: 'admin' };
  return next();
}
```

The admin password can be passed as a **query parameter** (`?admin_password=secret`). This means:
- The password appears in server logs, browser history, proxy logs, and referrer headers
- Any analytics or logging middleware will capture it
- CDN/proxy access logs will contain the plaintext password

**Impact:** Admin password exposure through logs and referrer headers, session fixation.
**Remediation:**
- Only accept the password via `x-admin-password` header (remove `req.query.admin_password`)
- Implement proper session-based admin authentication with Supabase JWT
- Add rate limiting to admin endpoints
- Log admin access attempts

---

## HIGH Findings

### H-01: CORS Wildcard Allows All Origins
**Severity:** HIGH
**File:** server.js, line 63
**CWE:** CWE-942 (Permissive Cross-Origin Resource Sharing)

```javascript
app.use(cors({ origin: '*', credentials: false }));
```

The production server allows ALL origins with CORS. This means any website can make authenticated API requests to the FlickTV backend. Combined with the token-in-query-string pattern (H-03), this enables cross-site attacks.

Additionally, the `backend/src/server.js` uses:
```javascript
origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
```
This is more restrictive but falls back to localhost only — not the production domain.

**Impact:** Cross-origin data theft, CSRF-like attacks on API endpoints.
**Remediation:**
- Restrict CORS to specific origins (flicktv.ai, www.flicktv.ai, app.flicktv.ai)
- Never use `origin: '*'` in production
- Set `credentials: true` if using cookie-based auth

---

### H-02: Admin Password Stored in Plaintext .env File
**Severity:** HIGH
**File:** .env (project root)
**CWE:** CWE-312 (Cleartext Storage of Sensitive Information)

The `.env` file at the project root contains:
```
SUPABASE_SERVICE_KEY=eyJhbG...8mHI
ADMIN_PASSWORD=*** (redacted but present)
```

The `.gitignore` file should exclude `.env` but this must be verified. The `SUPABASE_SERVICE_KEY` is a **service role key** that bypasses all Row Level Security — if leaked, it provides full database access.

**Impact:** Complete database compromise if .env is committed or leaked.
**Remediation:**
- Verify `.env` is in `.gitignore`
- Rotate the Supabase service key immediately
- Use Supabase's service key only in backend, never expose to frontend
- Consider using Supabase's anon key for client-side operations
- Add pre-commit hooks to prevent .env commits (e.g., detect-secrets, git-secrets)

---

### H-03: Auth Token in Query String
**Severity:** HIGH
**File:** middleware/auth.js, lines 7-9 and 28-30
**CWE:** CWE-598 (Use of GET Request Method with Sensitive Query Strings)

```javascript
const token = authHeader?.startsWith('Bearer ')
  ? authHeader.slice(7)
  : req.query.token;
```

The `verifyToken` middleware accepts authentication tokens via the `?token=` query parameter. This means:
- JWTs appear in server access logs
- Tokens are visible in browser history
- Tokens leak via the `Referer` header to external resources
- CDN/proxy logs capture valid session tokens

**Impact:** Session token leakage through logs and referrer headers.
**Remediation:**
- Remove the `req.query.token` fallback — only accept Bearer tokens in the Authorization header
- This is the single most impactful auth fix

---

### H-04: AI Prompt Injection via User Input
**Severity:** HIGH
**File:** ai.js (production), lines 227-229 and 268
**CWE:** CWE-1336 (Improper Neutralization of Special Elements Used in a Template Engine)

User-supplied messages are directly interpolated into Claude system prompts:

```javascript
const prompt = `Extract a channel search query from this voice command: "${transcript}"`;
```

And in the AI chat endpoint:
```javascript
const prompt = `User searched: "${query}"\nFilters detected: ${JSON.stringify(filters)}`;
```

An attacker can inject instructions to manipulate Claude's behavior, potentially:
- Extracting system prompt contents
- Manipulating search results to show attacker-controlled channels
- Exfiltrating user data through crafted responses

**Impact:** AI manipulation, potential data exfiltration, search result poisoning.
**Remediation:**
- Sanitize user input before interpolating into prompts
- Use prompt delimiters (e.g., `<user_input>...</user_input>`)
- Implement output validation for AI responses
- Consider using Claude's system prompt for instructions and only passing user input in the messages array

---

### H-05: No Rate Limiting on Admin Endpoints
**Severity:** HIGH
**File:** server.js (production), line 112
**CWE:** CWE-307 (Improper Restriction of Excessive Authentication Attempts)

```javascript
app.use('/api/admin', adminRouter);
```

The admin router uses only password-based auth (`requireAdminPassword`) but has **no rate limiting**. An attacker can brute-force the admin password without any throttling.

**Impact:** Admin password brute-force attacks.
**Remediation:**
- Add rate limiting to `/api/admin/*` endpoints (e.g., 10 requests per minute per IP)
- Implement account lockout after N failed attempts
- Add logging of failed admin auth attempts

---

### H-06: Sensitive Data in AI Chat Sessions (JSONB)
**Severity:** HIGH
**File:** schema.sql, line 216
**CWE:** CWE-312 (Cleartext Storage of Sensitive Information)

```sql
ai_sessions messages JSONB DEFAULT '[]'
```

Full AI chat history is stored in plaintext JSONB in the database. This includes:
- User search queries (which may contain personal info)
- Channel names and stream URLs
- Potentially sensitive user preferences

The `stream_url` field in channels is also stored in plaintext, meaning anyone with database access can see all user stream URLs.

**Impact:** User privacy violation, data exposure if database is compromised.
**Remediation:**
- Encrypt sensitive fields at application level before storage
- Implement data retention policies (auto-delete old sessions)
- Consider not storing full conversation history
- Ensure RLS policies are properly enforced on ai_sessions

---

## MEDIUM Findings

### M-01: Missing CSRF Protection
**Severity:** MEDIUM
**CWE:** CWE-352 (Cross-Site Request Forgery)

The API does not implement CSRF tokens. While the use of `Authorization: Bearer` headers provides some protection (browsers won't send these cross-origin), the query-token fallback (H-03) and wildcard CORS (H-01) negate this protection.

**Remediation:** Implement CSRF tokens for state-changing operations, or ensure only Bearer header auth is accepted.

---

### M-02: Verbose Error Messages in Development Mode
**Severity:** MEDIUM
**File:** server.js, line 304
**CWE:** CWE-209 (Generation of Error Message Containing Sensitive Information)

```javascript
error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
```

When `NODE_ENV` is not set to `production`, full error messages (including stack traces) are returned to clients. The `.env.example` shows `NODE_ENV=development` as default.

**Remediation:** Ensure `NODE_ENV=production` is set in all deployment environments. Add a startup warning if NODE_ENV is not production.

---

### M-03: No Request Size Limit on Parse Endpoints
**Severity:** MEDIUM
**File:** server.js, line 64
**CWE:** CWE-770 (Improper Restriction of Excessive Resource Consumption)

```javascript
app.use(express.json({ limit: '10mb' }));
```

The 10MB JSON body limit applies globally, but the `/api/parse/m3u` and `/api/parse/epg` endpoints fetch external content and parse it. An attacker could:
- Send a very large M3U file for parsing (DoS via memory consumption)
- Provide a URL to a very large file for the server to fetch

**Remediation:**
- Add specific body size limits to parse endpoints
- Implement streaming parsing for M3U content
- Add timeout limits to external fetch calls
- Limit the number of channels parsed per request

---

### M-04: Admin Dashboard Served Without Authentication
**Severity:** MEDIUM
**File:** server.js, line 103
**CWE:** CWE-306 (Missing Authentication for Critical Function)

```javascript
app.use('/admin', express.static(path.join(__dirname, 'backend', 'public'), { index: 'admin.html' }));
```

The admin dashboard static files are served without any authentication. While the dashboard itself has a client-side password check, the HTML/JS files are accessible to anyone. This exposes the admin interface structure and logic.

**Remediation:** Serve admin dashboard behind authentication middleware, or at minimum obfuscate the admin path.

---

### M-05: Xtream Credentials Passed in Plaintext
**Severity:** MEDIUM
**File:** server.js, lines 272-298
**CWE:** CWE-522 (Insufficiently Protected Credentials)

Xtream Codes credentials (server, username, password) are:
1. Sent in plaintext POST body from client to server
2. Used to construct a URL with credentials in query parameters: `${server}/player_api.php?username=${username}&password=${password}`
3. Potentially logged in server logs and error messages

**Impact:** Credential exposure via logs, referrer headers, and error messages.
**Remediation:** Hash/encrypt credentials at rest, use POST to Xtream APIs instead of GET with query params, sanitize logs.

---

### M-06: Missing Security Headers
**Severity:** MEDIUM
**File:** server.js, lines 49-61
**CWE:** CWE-693 (Protection Mechanism Failure)

The Helmet CSP configuration is overly permissive:
```javascript
scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
```

`unsafe-inline` and `unsafe-eval'` significantly weaken CSP protection against XSS. Additionally, there are no:
- `Strict-Transport-Security` (HSTS) headers explicitly set
- `Permissions-Policy` headers
- `X-DNS-Prefetch-Control` headers

**Remediation:** Tighten CSP (remove unsafe-inline/unsafe-eval if possible), add HSTS header, add Permissions-Policy.

---

### M-07: .env File May Be in Git History
**Severity:** MEDIUM
**CWE:** CWE-540 (Inclusion of Sensitive Information in Source Code)

The `.env` file exists at the project root. Even if it's in `.gitignore` now, it may have been committed previously. The `SUPABASE_SERVICE_KEY` and potentially `ADMIN_PASSWORD` could be in git history.

**Impact:** Credential exposure if .env was ever committed.
**Remediation:**
- Run `git log --all --diff-filter=A -- .env` to check history
- If found, use `git filter-branch` or BFG Repo Cleaner to remove
- Rotate all credentials that may have been exposed

---

## LOW Findings

### L-01: No HTTPS Enforcement in Application Layer
**Severity:** LOW
**File:** server.js
**CWE:** CWE-319 (Cleartext Transmission of Sensitive Information)

The application does not enforce HTTPS at the application level. While nginx redirects HTTP to HTTPS, the application itself doesn't set HSTS or redirect.

**Remediation:** Add HSTS header via Helmet: `helmet({ hsts: { maxAge: 31536000, includeSubDomains: true } })`

---

### L-02: Request Logging Includes Potentially Sensitive Data
**Severity:** LOW
**File:** server.js, line 97
**CWE:** CWE-532 (Insertion of Sensitive Information into Log File)

```javascript
logger.info(`${req.method} ${req.path}`, { ip: req.ip });
```

While this specific log line is minimal, the query parameters (including tokens and admin passwords) may be logged by Express or middleware. The Winston logger writes to `logs/combined.log`.

**Remediation:** Sanitize query parameters before logging. Ensure log files are protected and rotated.

---

### L-03: No Database Connection Encryption Enforcement
**Severity:** LOW
**File:** server.js, line 39-42
**CWE:** CWE-319 (Cleartext Transmission of Sensitive Information)

The Supabase client connection does not explicitly enforce SSL/TLS. While Supabase connections are typically encrypted by default, this should be explicitly configured.

**Remediation:** Add `ssl: { rejectUnauthorized: true }` to Supabase client options.

---

## Positive Security Observations

1. **Helmet middleware** is used for security headers (with noted improvements needed)
2. **Rate limiting** is implemented globally and for AI endpoints
3. **Supabase Row Level Security** is enabled on all user tables with proper policies
4. **JWT authentication** via Supabase Auth with proper token validation
5. **User ban system** is implemented in the auth middleware
6. **Docker containers** run as non-root user (flicktv:1001)
7. **Health checks** are implemented for monitoring
8. **Stream health worker** has proper failure thresholds to avoid false positives
9. **Input validation** exists on most endpoints (though could be stronger)
10. **CSP headers** are present (though overly permissive)

---

## Priority Remediation Roadmap

### Immediate (This Week)
1. [ ] C-01: Remove hardcoded Plex token, rotate it
2. [ ] C-02: Implement URL validation/allowlisting on stream proxy
3. [ ] C-03: Remove query parameter admin password support
4. [ ] H-03: Remove token-in-query-string support
5. [ ] H-02: Verify .env is in .gitignore, rotate service key

### Short-Term (This Month)
6. [ ] H-01: Restrict CORS to specific origins
7. [ ] H-04: Sanitize user input in AI prompts
8. [ ] H-05: Add rate limiting to admin endpoints
9. [ ] M-01: Implement CSRF protection
10. [ ] M-06: Tighten CSP headers

### Medium-Term (Next Quarter)
11. [ ] H-06: Encrypt sensitive data at rest
12. [ ] M-03: Add request size limits to parse endpoints
13. [ ] M-04: Add authentication to admin dashboard serving
14. [ ] M-07: Audit git history for .env commits
15. [ ] L-01: Add HSTS header

---

## Compliance Notes

- **OWASP Top 10 2021:**
  - A01 (Broken Access Control): Partially addressed via RLS, but SSRF and admin bypass are concerns
  - A03 (Injection): AI prompt injection is a concern
  - A05 (Security Misconfiguration): CORS wildcard, verbose errors, missing headers
  - A07 (Identification and Authentication Failures): Token in query string, admin password exposure
  - A09 (Security Logging and Monitoring): Sensitive data in logs
  - A10 (SSRF): Critical SSRF vulnerability in stream proxy

- **GDPR:** User data (watch history, AI sessions) stored without encryption at rest. Data retention policies not implemented.

---

*End of Security Audit Report*
