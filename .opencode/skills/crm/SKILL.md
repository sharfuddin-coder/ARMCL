# CRM — End-to-End Customer Relationship Management App

Build, secure, and deploy a full CRM system with role-based access, dashboards, call logging, and team management. Use this skill from scratch or to extend an existing CRM.

---

## Architecture

```
project/
├── server.js           # Express + security + CRUD routes
├── package.json        # express only dependency
├── render.yaml         # Render deployment config
├── public/
│   └── index.html      # SPA with all UI (vanilla JS, no framework)
└── data/               # JSON file storage (auto-managed)
```

---

## Phase 1: Scaffold

### Server skeleton
```javascript
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Security headers, rate limiting, auth → see Phase 2
// Data layer, CRUD routes → see Phase 3

app.get('*', (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, () => console.log(`Running on ${PORT}`));
```

### Generic JSON file store
```javascript
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function readJSON(filename) {
  const fp = path.join(DATA_DIR, filename);
  try { if (fs.existsSync(fp)) return JSON.parse(fs.readFileSync(fp, 'utf-8')); } catch(e) {}
  return null;
}
function writeJSON(filename, data) {
  const fp = path.join(DATA_DIR, filename);
  const tmp = fp + '.tmp.' + Date.now();
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmp, fp);
}
```

### Generic CRUD route factory
```javascript
const counters = {};
function nextId(prefix) {
  if (!counters[prefix]) counters[prefix] = 0;
  counters[prefix]++;
  return `${prefix}-${String(counters[prefix]).padStart(5, '0')}`;
}

function crudRoutes(entityName, routePath) {
  app.get(`/api/${routePath}`, authRequired, (req, res) => {
    res.json(readJSON(`${entityName}.json`) || []);
  });
  app.post(`/api/${routePath}`, authRequired, (req, res) => {
    const data = readJSON(`${entityName}.json`) || [];
    const prefix = entityName === 'customers' ? 'CUS' : entityName === 'leads' ? 'LEAD'
      : entityName === 'opportunities' ? 'OPP' : entityName === 'visits' ? 'VIS'
      : entityName === 'orders' ? 'ORD' : entityName === 'complaints' ? 'CMP'
      : entityName === 'callLogs' ? 'CALL' : 'ACT';
    const item = { id: nextId(prefix), ...req.body, createdAt: new Date().toISOString() };
    data.push(item);
    writeJSON(`${entityName}.json`, data);
    res.json(item);
  });
  app.put(`/api/${routePath}/:id`, authRequired, (req, res) => {
    const data = readJSON(`${entityName}.json`) || [];
    const idx = data.findIndex(d => d.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    data[idx] = { ...data[idx], ...req.body, id: data[idx].id, updatedAt: new Date().toISOString() };
    writeJSON(`${entityName}.json`, data);
    res.json(data[idx]);
  });
  app.delete(`/api/${routePath}/:id`, authRequired, (req, res) => {
    const data = readJSON(`${entityName}.json`) || [];
    const idx = data.findIndex(d => d.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    data.splice(idx, 1);
    writeJSON(`${entityName}.json`, data);
    res.json({ success: true });
  });
}

// Register all data types
crudRoutes('customers', 'customers');
crudRoutes('leads', 'leads');
crudRoutes('opportunities', 'opportunities');
crudRoutes('visits', 'visits');
crudRoutes('orders', 'orders');
crudRoutes('complaints', 'complaints');
crudRoutes('contacts', 'contacts');
crudRoutes('activities', 'activities');
crudRoutes('callLogs', 'callLogs');
```

### Wipe + seed accounts only (no demo data)
```javascript
const DATA_FILES = ['customers','leads','opportunities','visits','orders','complaints','contacts','activities','targets','callLogs'];
for (const name of DATA_FILES) writeJSON(`${name}.json`, []);

if (!readJSON('accounts.json')) {
  writeJSON('accounts.json', {
    admin: { username: 'admin', password: hashPassword('admin123'), name: 'Super Admin', email: '' },
    users: [
      { username: 'sales.head', password: hashPassword('sales123'), role: 'sales_head', name: 'Sales Head', sbu: 'All', region: 'All', area: 'All', territory: 'All', email: '' },
      // Add SOs, agents, auditors...
    ]
  });
}
```

---

## Phase 2: Security

### Password hashing (crypto.scryptSync, no npm deps)
```javascript
const SALT_LEN = 16, KEY_LEN = 64;
function hashPassword(pw, salt) {
  salt = salt || crypto.randomBytes(SALT_LEN).toString('hex');
  return `${salt}:${crypto.scryptSync(pw, salt, KEY_LEN).toString('hex')}`;
}
function verifyPassword(pw, stored) {
  if (!stored.includes(':')) return pw === stored;
  const [salt, hash] = stored.split(':');
  return crypto.scryptSync(pw, salt, KEY_LEN).toString('hex') === hash;
}
```

### Session tokens + auth middleware
```javascript
const sessions = new Map();
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;

function createSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { ...user, expires: Date.now() + TOKEN_EXPIRY_MS });
  return token;
}
function validateSession(token) {
  const s = sessions.get(token);
  if (!s || Date.now() > s.expires) { sessions.delete(token); return null; }
  return s;
}
function authRequired(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
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

### Rate limiting
```javascript
const rateLimitMap = new Map();
function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const e = rateLimitMap.get(key) || { count: 0, reset: now + windowMs };
  if (now > e.reset) { e.count = 0; e.reset = now + windowMs; }
  e.count++; rateLimitMap.set(key, e);
  return e.count > max;
}
setInterval(() => { /* cleanup expired entries */ }, 60000);
```

### Login endpoint
```javascript
app.post('/api/login', (req, res) => {
  const ip = req.ip;
  if (rateLimit(ip, 10, 60000)) return res.status(429).json({ error: 'Too many attempts' });
  const { username, password } = req.body;
  // Validate against accounts.json, verify password, create session
  const token = createSession({ role, name, username, territory });
  return res.json({ token, user: { role, name, username, modules } });
});
```

### Security headers
```javascript
app.use((_, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self' 'unsafe-inline'; img-src 'self' data:;");
  next();
});
```

### Accounts API — never expose passwords
```javascript
app.get('/api/accounts', authRequired, (req, res) => {
  const accts = readJSON('accounts.json');
  const safe = { admin: { ...accts.admin, password: undefined },
    users: accts.users.map(u => { const s = { ...u }; delete s.password; return s; }) };
  res.json(safe);
});
app.post('/api/accounts', authRequired, roleRequired('super_admin'), (req, res) => { /* create user */ });
app.put('/api/accounts/:username', authRequired, roleRequired('super_admin', 'admin', 'sales_head'), (req, res) => { /* update user */ });
```

---

## Phase 3: Frontend Architecture

### State management (vanilla JS)
```javascript
let state = {
  user: null, token: null, currentTab: 'dashboard', navHistory: [],
  customers: [], leads: [], opportunities: [], visits: [],
  orders: [], complaints: [], callLogs: [], accounts: [], stats: null
};
```

### API helpers
```javascript
async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + state.token } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(path, opts);
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'API error');
  return d;
}
const apiGet = p => api('GET', p);
const apiPost = (p, b) => api('POST', p, b);
const apiPut = (p, b) => api('PUT', p, b);
const apiDel = p => api('DELETE', p);
```

### Navigation with back button
```javascript
function navigate(tab) {
  if (state.currentTab !== tab) state.navHistory.push(state.currentTab);
  state.currentTab = tab;
  buildSidebar();
  renderPage();
}
function goBack() {
  if (!state.navHistory.length) return;
  state.currentTab = state.navHistory.pop();
  buildSidebar();
  renderPage();
}
```

### Role-based nav groups
```javascript
const ROLE_HIERARCHY = {
  super_admin: ['All'],
  admin: ['All'],
  sales_head: ['dashboard', 'customers', 'leads', 'opportunities', 'visits', 'orders', 'reports', 'team'],
  so: ['customers', 'leads', 'visits', 'orders'],
  contact_center: ['complaints', 'contact-center'],
  sales_excellence: ['sales-excellence', 'reports'],
  management: ['dashboard', 'reports'],
};

// Filter nav items based on user role
const allowedModules = ROLE_HIERARCHY[state.user.role] || [];
const isAllAccess = allowedModules.includes('All');
```

### Modal system (reusable)
```javascript
function closeModal() {
  document.getElementById('modal-overlay').classList.remove('show');
  document.getElementById('modal').innerHTML = '';
}
// Add overlay HTML: <div id="modal-overlay" class="modal-overlay"><div id="modal" class="modal"></div></div>
```

---

## Phase 4: Dashboard with AI Suggestions

### Server endpoint
```javascript
app.get('/api/dashboard/stats', authRequired, (req, res) => {
  const customers = readJSON('customers.json') || [];
  const leads = readJSON('leads.json') || [];
  const orders = readJSON('orders.json') || [];
  const targets = readJSON('targets.json') || [];
  const currentMonth = new Date().toISOString().slice(0, 7);

  const spPerformance = getSalespeople().map(sp => {
    const achievedSales = orders.filter(o => customers.find(c => c.salesperson === sp && c.id === o.customerId) && o.status === 'Delivered').reduce((s, o) => s + o.totalAmount, 0);
    const t = targets.find(t => t.salesperson === sp && t.month === currentMonth);
    const pct = t?.targetSales > 0 ? Math.round((achievedSales / t.targetSales) * 100) : 0;

    let ai = '';
    if (!t) ai = 'No target set.';
    else if (pct >= 110) ai = 'Top performer — recommend territory expansion or leadership role.';
    else if (pct >= 90) ai = 'On track — sustain current strategy, upsell existing customers.';
    else if (pct >= 70) ai = 'Close to target — prioritize high-value leads and increase follow-ups.';
    else if (pct >= 50) ai = 'Behind target — increase daily visits, re-engage dormant customers.';
    else ai = 'Critical gap — schedule coaching, review territory allocation.';

    return { name: sp, achievedSales, targetSales: t?.targetSales || 0, pctAchievement: pct, aiSuggestion: ai };
  }).sort((a, b) => b.pctAchievement - a.pctAchievement);

  res.json({ customers: { total: customers.length, active: customers.filter(c => c.status === 'Active').length }, /* ... */, spPerformance });
});
```

### Frontend KPI cards (clickable)
```javascript
h += `<div class="stat-card" onclick="navigate('customers')">
  <div class="label">Total Customers</div>
  <div class="value">${s.customers.total}</div>
</div>`;
```

### SP Performance table
```javascript
for (const sp of s.spPerformance) {
  const pctClass = sp.pctAchievement >= 100 ? 'green' : sp.pctAchievement >= 70 ? 'amber' : 'red';
  h += `<tr onclick="document.getElementById('cust-search').value='${sp.name}';navigate('customers')">
    <td><strong>${sp.name}</strong></td>
    <td>${sp.achievedSales}</td>
    <td>${sp.targetSales}</td>
    <td><span class="badge badge-${pctClass}">${sp.pctAchievement}%</span></td>
    <td>${sp.aiSuggestion}</td>
  </tr>`;
}
```

---

## Phase 5: Adding a New Module (e.g., Contact Center)

1. Add to `DATA_FILES` array
2. Add prefix to `crudRoutes` factory
3. Call `crudRoutes('callLogs', 'callLogs')`
4. Add nav item in `NAV_GROUPS`
5. Add `case 'contact-center'` in `renderPage`
6. Build `renderContactCenter(el)` with: search bar + filter + table + create form + delete action
7. Wire up `apiPost`/`apiDel` for CRUD

---

## Phase 6: Team Management (Supervisor ↔ Member)

1. Add `supervisor` field to user accounts
2. Allow `sales_head` role to update accounts (PUT endpoint)
3. Build team view: supervisor list with member badges, member list with supervisor dropdown
4. Assignment modal: checkboxes for batch assign, dropdown for single assign
5. Show customer counts per assignment (join with customers data)

---

## Phase 7: Deploy to Render

1. Create `render.yaml` with `type: web, env: node, plan: free`
2. Push to GitHub (use curl + token if no gh CLI)
3. Open `https://render.com/deploy?repo=https://github.com/USER/REPO`
4. Sign in, approve, wait ~2 min
5. URL: `https://app-name.onrender.com`

---

## Quick Reference: All Endpoints

| Endpoint | Method | Auth | Notes |
|---|---|---|---|
| `/api/login` | POST | No | Returns token + user |
| `/api/logout` | POST | Required | Invalidates token |
| `/api/session` | GET | Required | Validates token, returns user |
| `/api/dashboard/stats` | GET | Required | KPI data + SP performance |
| `/api/{entity}` | GET | Required | List all |
| `/api/{entity}` | POST | Required | Create |
| `/api/{entity}/:id` | PUT | Required | Update |
| `/api/{entity}/:id` | DELETE | Required | Delete |
| `/api/accounts` | GET/POST | POST = super_admin | User management |
| `/api/accounts/:username` | PUT/DELETE | PUT = admin+, DELETE = super_admin | |
| `/api/customer/:id/360` | GET | Required | Customer detail |
| `/api/change-password` | POST | Required | Password change |

## Quick Reference: Roles

| Role | Access |
|---|---|
| `super_admin` | Everything |
| `admin` | Everything |
| `sales_head` | Dashboard, Customers, Leads, Opps, Visits, Orders, Reports, Team |
| `so` | Customers, Leads, Visits, Orders (own) |
| `contact_center` | Complaints, Contact Center |
| `sales_excellence` | Sales Excellence, Reports |
| `management` | Dashboard, Reports |
