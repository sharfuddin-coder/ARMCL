# Build CRM Dashboard with Clickable KPIs + Performance Tables

Create a comprehensive SPA dashboard with stat cards, performance tables, and click-to-navigate interactions.

## 1. KPI Stat Cards Grid
Use a responsive CSS grid with color-coded border accents:
```css
.stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
.stat-card { background: #fff; border-radius: 14px; padding: 18px 20px; border-left: 3px solid var(--primary); cursor: pointer; }
.stat-card:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,0.14); }
.stat-card.cyan { border-left-color: var(--cyan); }
.stat-card.green { border-left-color: var(--green); }
.stat-card.amber { border-left-color: var(--amber); }
.stat-card.red { border-left-color: var(--red); }
.stat-card .label { font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.05em; color: #666; }
.stat-card .value { font-family: serif; font-size: 28px; font-weight: 700; }
.stat-card .sub { font-size: 12px; color: #666; margin-top: 4px; }
```

## 2. Make Every KPI Clickable
Each card navigates to its detailed view:
```javascript
h += `<div class="stat-card" onclick="navigate('customers')">
  <div class="label">Total Customers</div>
  <div class="value">${s.customers.total}</div>
  <div class="sub">${s.customers.active} active</div>
</div>`;
```

**Mapping:**
| KPI | Navigates To |
|---|---|
| Total Customers | customers |
| Open Leads | leads |
| Pipeline Value | opportunities |
| Pending Orders | orders |
| Total Sales | orders |
| Open Complaints | complaints |
| Visits | visits |

## 3. Performance Table with Targets + AI
Fetch stats from `/api/dashboard/stats` which returns per-salesperson data:
```javascript
spPerformance: [{
  name, customers, visits, targetVisits,
  achievedSales, targetSales, pctAchievement,
  aiSuggestion
}]
```

Render as table with color-coded achievement badges:
```javascript
const pctClass = sp.pctAchievement >= 100 ? 'green' : sp.pctAchievement >= 70 ? 'amber' : 'red';
h += `<tr onclick="navigate('customers')">
  <td>${sp.name}</td>
  <td>${sp.customers}</td>
  <td>${sp.visits} / ${sp.targetVisits}</td>
  <td>${sp.targetSales}</td>
  <td>${sp.achievedSales}</td>
  <td><span class="badge badge-${pctClass}">${sp.pctAchievement}%</span></td>
  <td>${sp.aiSuggestion}</td>
</tr>`;
```

## 4. AI Suggestions Logic (server-side)
```javascript
if (pctAchievement >= 110) suggestion = 'Top performer — recommend territory expansion or leadership role.';
else if (pctAchievement >= 90) suggestion = 'On track — sustain current strategy, upsell existing customers.';
else if (pctAchievement >= 70) suggestion = 'Close to target — prioritize high-value leads and increase follow-up frequency.';
else if (pctAchievement >= 50) suggestion = 'Behind target — increase daily visits, re-engage dormant customers.';
else suggestion = 'Critical gap — schedule coaching session, review territory allocation.';
```

## 5. Clickable Rows → Filtered View
SP performance rows navigate to customers and pre-filter by salesperson:
```javascript
h += `<tr onclick="document.getElementById('cust-search').value='${sp.name}';navigate('customers')">
```

## 6. Targets Data Model
```json
{
  "salesperson": "Nusrat Jahan",
  "month": "2026-08",
  "targetSales": 800000,
  "targetVisits": 20,
  "targetNewCustomers": 3
}
```
Store in `targets.json`, load in dashboard stats, join with orders to calculate achievement.

## 7. Back Button Navigation
```javascript
// Store history
state.navHistory = [];
function navigate(tab) {
  if (state.currentTab !== tab) state.navHistory.push(state.currentTab);
  state.currentTab = tab;
  renderPage();
}
function goBack() {
  if (!state.navHistory.length) return;
  state.currentTab = state.navHistory.pop();
  renderPage();
}
// In header: show back button when history exists
if (state.navHistory.length > 0) {
  actions.innerHTML = '<button onclick="goBack()">← Back</button>';
}
```
