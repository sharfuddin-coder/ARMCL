# Add Team Management — Supervisor + Member Assignment

Build a team management module where supervisors can assign/manage Sales Officers (SOs) and team members can be reassigned.

## 1. Data Model
Add `supervisor` field to user accounts:
```json
{
  "admin": { "username": "admin", ... },
  "users": [
    { "username": "nusrat.jahan", "role": "so", "supervisor": "sales.head", "name": "Nusrat Jahan", "territory": "Gulshan" },
    { "username": "sales.head", "role": "sales_head", "name": "Rafiqul Islam" }
  ]
}
```

## 2. Server: Allow Supervisor Roles to Update Accounts
```javascript
app.put('/api/accounts/:username', authRequired,
  roleRequired('super_admin', 'admin', 'sales_head'), (req, res) => {
  // Update user fields including supervisor
});
```

## 3. Frontend: Nav + Route
```javascript
{ label: 'OPERATIONS', items: [
  { id: 'sales-excellence', label: 'Sales Excellence' },
  { id: 'team', label: 'Team' }
]},

case 'team':
  title.textContent = 'Team Management';
  renderTeam(content);
  break;
```

## 4. Frontend: Supervisor's Team View
Show each supervisor with their assigned team members as badges:
```javascript
async function renderTeam(el) {
  const accts = await apiGet('/api/accounts');
  const supervisors = accts.users.filter(u => u.role === 'sales_head');
  const sos = accts.users.filter(u => u.role === 'so');

  for (const sup of supervisors) {
    const members = sos.filter(so => so.supervisor === sup.username);
    // Render: supervisor name, member badges, customer count, manage button
  }
}
```

## 5. Frontend: Team Assignment Modal (Checkboxes)
Supervisor clicks "Manage" → modal with checkboxes for all SOs:
```javascript
function showTeamAssign(supervisorUsername) {
  const currentMembers = sos.filter(so => so.supervisor === supervisorUsername)
    .map(so => so.username);
  let opts = sos.map(so =>
    `<label><input type="checkbox" value="${so.username}"
      ${currentMembers.includes(so.username) ? 'checked' : ''}>
      ${so.name} (${so.territory})</label>`
  ).join('');
  // Render modal with save button
}
```

## 6. Frontend: Save Assignments
```javascript
async function saveTeamAssign(supervisorUsername) {
  const checked = getCheckedUsernames();
  for (const uname of checked) {
    await apiPut('/api/accounts/' + uname, { supervisor: supervisorUsername });
  }
  // Remove supervisor from unchecked SOs
  for (const so of allSOs) {
    if (so.supervisor === supervisorUsername && !checked.includes(so.username)) {
      await apiPut('/api/accounts/' + so.username, { supervisor: '' });
    }
  }
  closeModal(); refreshView();
}
```

## 7. Frontend: Member Assign Modal (Dropdown)
Each SO row has "Assign" button → modal with supervisor dropdown:
```javascript
function showMemberAssign(soUsername) {
  let opts = '<option value="">— Unassigned —</option>';
  opts += supervisors.map(s => `<option value="${s.username}"
    ${so.supervisor === s.username ? 'selected' : ''}>${s.name}</option>`).join('');
  // Render modal with save
}

async function saveMemberAssign(soUsername) {
  const supervisor = document.getElementById('member-supervisor').value;
  await apiPut('/api/accounts/' + soUsername, { supervisor });
  closeModal(); refreshView();
}
```

## 8. Show Customer Counts Per Assignment
Join with customers data to show impact:
```javascript
const custCount = members.reduce((sum, so) =>
  sum + customers.filter(c => c.salesperson === so.name).length, 0
);
```

## 9. Permissions
- `super_admin` / `admin` → full team management
- `sales_head` → can manage their own team, assign members
- `so` → view-only (sees their own supervisor)

## 10. Add to Customer Form
When editing a customer, show salesperson as a dropdown of all SOs (for admin/supervisor roles):
```javascript
const canAssign = ['super_admin','admin','sales_head'].includes(state.user?.role);
if (canAssign) {
  // Fetch SO list from /api/accounts
  // Render <select> with all SOs
} else {
  // Show read-only salesperson field
}
```
