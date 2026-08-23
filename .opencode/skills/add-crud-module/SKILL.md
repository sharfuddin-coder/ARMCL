# Add CRUD Module to CRM

Add a new data type (e.g., call logs, tasks, targets) with full CRUD operations, API endpoints, and frontend UI to an existing CRM.

## 1. Server: Add to Data Wipe List
```javascript
const DATA_FILES = ['customers','leads',...,'YOUR_NEW_ENTITY'];
```

## 2. Server: Add ID Prefix
In the generic CRUD helper:
```javascript
const prefix = entityName === 'customers' ? 'CUS' :
  entityName === 'yourEntity' ? 'PREFIX' : 'ACT';
```

## 3. Server: Register CRUD Routes
```javascript
crudRoutes('yourEntity', 'yourEntity');
```
This auto-creates: GET/POST `/api/yourEntity`, PUT/DELETE `/api/yourEntity/:id`

## 4. Frontend: Add Nav Item
```javascript
const NAV_GROUPS = [
  // ...
  { label: 'CATEGORY', items: [{id:'yourEntity',label:'Label'}] },
];
```

## 5. Frontend: Add Render Case
```javascript
case 'yourEntity':
  title.textContent = 'Title';
  renderYourEntity(content);
  actions.innerHTML += '<button onclick="showForm()">+ Add</button>';
  break;
```

## 6. Frontend: Build the View Function
```javascript
async function renderYourEntity(el){
  try { state.data = await apiGet('/api/yourEntity'); } catch(e) {}
  let h = '<div class="section-panel"><h2>Title</h2>';
  // Search + filter bar
  h += '<div class="search-bar"><input oninput="renderYourEntity(...)"><select onchange="renderYourEntity(...)">...</select></div>';
  // Table
  h += '<div class="table-wrap"><table><thead><tr>...</tr></thead><tbody>';
  for (const item of state.data) {
    h += `<tr><td>${item.id}</td><td>${item.field1}</td>...</tr>`;
  }
  h += '</tbody></table></div></div>';
  el.innerHTML = h;
}
```

## 7. Frontend: Add Create Form (Modal)
```javascript
function showForm(id) {
  const item = id ? state.data.find(x => x.id === id) : null;
  let h = `<div class="modal-header"><h2>${id?'Edit':'Add'}</h2>
    <button onclick="closeModal()">&times;</button></div>`;
  h += '<div class="modal-body">';
  // Form fields
  h += '<div class="field-row"><div class="field-group"><label>Field</label>';
  h += `<input id="f-field" value="${esc(item?.field||'')}"></div></div>`;
  h += '</div>';
  h += `<div class="modal-footer"><button onclick="closeModal()">Cancel</button>
    <button onclick="saveItem('${item?.id||''}')">Save</button></div>`;
  document.getElementById('modal').innerHTML = h;
  document.getElementById('modal-overlay').classList.add('show');
}
```

## 8. Frontend: Add Save + Delete Functions
```javascript
async function saveItem(id) {
  const body = {
    field1: document.getElementById('f-field1').value,
    field2: document.getElementById('f-field2').value,
  };
  if (!body.field1) { alert('Required'); return; }
  try {
    if (id) await apiPut('/api/yourEntity/' + id, body);
    else await apiPost('/api/yourEntity', body);
    closeModal();
    renderYourEntity(document.getElementById('page-content'));
  } catch(e) { alert(e.message); }
}

async function deleteItem(id) {
  if (!confirm('Delete?')) return;
  try { await apiDel('/api/yourEntity/' + id); renderYourEntity(...); }
  catch(e) { alert(e.message); }
}
```

## 9. Show "Zero Data" State
```javascript
if (state.data.length === 0) {
  el.innerHTML = '<div class="section-panel"><p>No data yet. Click "+ Add" to create the first entry.</p></div>';
  return;
}
```

## 10. Wire Up State
Add to the global state object:
```javascript
let state = { /* existing */, yourEntity: [] };
```
Reset in logout handler.
