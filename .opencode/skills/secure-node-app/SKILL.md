# Secure a Node.js Express Application

Apply comprehensive security to a Node.js/Express backend. Use when hardening an existing app or building auth from scratch.

## 1. Password Hashing
Use `crypto.scryptSync` (no npm dependencies):
```javascript
const crypto = require('crypto');
const SALT_LEN = 16, KEY_LEN = 64;

function hashPassword(pw, salt) {
  salt = salt || crypto.randomBytes(SALT_LEN).toString('hex');
  return `${salt}:${crypto.scryptSync(pw, salt, KEY_LEN).toString('hex')}`;
}
function verifyPassword(pw, stored) {
  if (!stored.includes(':')) return pw === stored; // legacy fallback
  const [salt, hash] = stored.split(':');
  return crypto.scryptSync(pw, salt, KEY_LEN).toString('hex') === hash;
}
```
On startup, migrate any plaintext passwords to hashed format.

## 2. Session Tokens
```javascript
const sessions = new Map();
let TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;

function createSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { ...user, expires: Date.now() + TOKEN_EXPIRY_MS });
  return token;
}
```
Store token in client `sessionStorage`. Cleanup expired sessions every 5 min.

## 3. Auth Middleware
```javascript
function authRequired(req, res, next) {
  const token = (req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  if (!token) return res.status(401).json({ error: 'Auth required' });
  const s = validateSession(token);
  if (!s) return res.status(401).json({ error: 'Session expired' });
  req.session = s;
  next();
}
function roleRequired(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.session.role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}
```
Apply `authRequired` to all POST/PUT/DELETE. Apply `roleRequired` to admin endpoints.

## 4. POST /api/login
Rate-limited. Server validates credentials and returns token + user object. Use consistent error messages (don't reveal whether username or password was wrong).

## 5. Rate Limiting (in-memory)
```javascript
const rateLimitMap = new Map();
function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const e = rateLimitMap.get(key) || { count: 0, reset: now + windowMs };
  if (now > e.reset) { e.count = 0; e.reset = now + windowMs; }
  e.count++; rateLimitMap.set(key, e);
  return e.count > max;
}
```
Limits: login 10/min/IP, mutations 30/min/user.

## 6. Security Headers
```javascript
app.use((_, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self' 'unsafe-inline'; img-src 'self' data:;");
  next();
});
```

## 7. Data Sanitization
Never return passwords in API responses. Strip before JSON serialization:
```javascript
function sanitizeAccounts(accts) {
  const safe = JSON.parse(JSON.stringify(accts));
  delete safe.admin.password;
  safe.users = safe.users.map(u => { const s = {...u}; delete s.password; return s; });
  return safe;
}
```

## 8. Input Validation (server-side)
- Validate types: `typeof input === 'string'`
- Validate lengths: `input.length > 0 && input.length < MAX`
- Validate JSON: `try { JSON.parse(raw) } catch`
- Validate emails: `email.includes('@')`
- Validate numbers: `const n = Number(input); if (!n || n <= 0)`

## 9. Audit Logging
```javascript
function audit(action, detail) {
  console.log(`[AUDIT ${new Date().toISOString()}] ${action} — ${detail}`);
}
```
Log: LOGIN_OK, LOGIN_FAIL, CREATE, UPDATE, DELETE, PASSWORD_CHANGE, HPO_CREATE.

## 10. Deployment Checklist
- [ ] All passwords hashed (no plaintext)
- [ ] Login server-side (never client-side matching)
- [ ] Tokens: crypto.randomBytes(32)
- [ ] All POST/PUT/DELETE have authRequired
- [ ] Admin-only endpoints have roleRequired
- [ ] Rate limiting on login + mutations
- [ ] Security headers on all responses
- [ ] Passwords stripped from API responses
- [ ] Client stores token in sessionStorage
