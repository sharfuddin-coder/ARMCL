const XLSX = require('xlsx');
const fs = require('fs');
const wb = XLSX.readFile('downloads/13_JD_ARMCL_Employees.xlsx');

function rowsOf(tab) {
  return XLSX.utils.sheet_to_json(wb.Sheets[tab], { header: 1, defval: '' }).map((r) =>
    r.map((c) => String(c).replace(/\s+/g, ' ').trim())
  );
}

function findRow(rows, pred, from = 0) {
  for (let i = from; i < rows.length; i++) if (pred(rows[i], i)) return i;
  return -1;
}

function field(rows, label) {
  for (const r of rows) {
    const idx = r.findIndex((c) => c && c.toUpperCase().includes(label.toUpperCase()));
    if (idx >= 0) {
      const val = r.slice(idx + 1).filter(Boolean).join(' ');
      if (val) return val;
    }
  }
  return '';
}

function numberedItems(rows, startIdx, endIdx) {
  const items = [];
  for (let i = startIdx; i < endIdx && i < rows.length; i++) {
    const r = rows[i];
    const numIdx = /^\d+$/.test(r[0]) ? 0 : /^\d+$/.test(r[1]) ? 1 : -1;
    if (numIdx >= 0 && r[numIdx + 1]) items.push(r.slice(numIdx + 1).filter(Boolean).join(' '));
  }
  return items;
}

function plainItems(rows, startIdx, endIdx) {
  const items = [];
  for (let i = startIdx; i < endIdx && i < rows.length; i++) {
    const line = rows[i].filter(Boolean).join(' ').trim();
    if (line && !/^(SIGNATURE|Employee Name|Designation|ID No|Date|HR Representative|Reporting Supervisor)/.test(line))
      items.push(line);
  }
  return items;
}

const roles = [];
for (const tab of wb.SheetNames) {
  if (tab === 'Sheet11') continue;
  const rows = rowsOf(tab);

  const ivIdx = findRow(rows, (r) => r.join(' ').includes('KEY RESPONSIBILITIES'));
  const eduIdx = findRow(rows, (r) => r.some((c) => /education qualification/i.test(c)), ivIdx);
  const vIdx = findRow(rows, (r) => r.join(' ').includes('PERFORMANCE GOALS'));
  const viiIdx = findRow(rows, (r) => r.join(' ').includes('BEHAVIOR') && r[0].match(/^VII/));
  const viiiIdx = findRow(rows, (r) => r.join(' ').includes('COMPETEN'));
  const ixIdx = findRow(rows, (r) => r.join(' ').includes('KEY INTERACTIONS'));
  const signIdx = findRow(rows, (r) => r.join(' ').includes('SIGNATURE'));

  const eduRow = eduIdx >= 0 ? rows[eduIdx] : [];
  const expRow = findRow(rows, (r) => r.some((c) => /experience/i.test(c)), ivIdx);
  const skillsRow = findRow(rows, (r) => r.some((c) => /functional skills/i.test(c)), ivIdx);

  const after = (r) => {
    const idx = r.findIndex((c) => /education|experience|functional skills/i.test(c));
    return idx >= 0 ? r.slice(idx + 1).filter(Boolean).join(' ') : '';
  };

  const role = {
    tab_name: tab,
    position_title: field(rows, 'POSITION/JOB TITLE') || tab,
    department: field(rows, 'DEPARTMENT:'),
    section: field(rows, 'SECTION:'),
    location: field(rows, 'LOCATION:'),
    immediate_supervisor: field(rows, 'Immediate supervisor'),
    next_level_supervisor: field(rows, 'Next level supervisor'),
    direct_reports_count: field(rows, 'Number of positions reporting'),
    direct_report_titles: field(rows, 'Position titles of direct reportees'),
    purpose: field(rows, 'PURPOSE OF THE POSITION'),
    key_responsibilities: ivIdx >= 0 ? numberedItems(rows, ivIdx + 1, eduIdx >= 0 ? eduIdx : rows.length) : [],
    education: eduIdx >= 0 ? after(eduRow) : '',
    experience: expRow >= 0 ? after(rows[expRow]) : '',
    functional_skills: skillsRow >= 0 ? after(rows[skillsRow]) : '',
    performance_indicators: vIdx >= 0 ? numberedItems(rows, vIdx + 1, viiIdx >= 0 ? viiIdx : rows.length) : [],
    behaviors: [],
    competencies: [],
    key_interactions: [],
  };

  if (viiIdx >= 0) {
    const end = viiiIdx >= 0 ? viiiIdx : ixIdx;
    role.behaviors = plainItems(rows, viiIdx + 1, end).filter(
      (l) => !/^BEHAVIOR/i.test(l) && !/COMPETE/i.test(l)
    );
  }
  if (viiiIdx >= 0) {
    role.competencies = plainItems(rows, viiiIdx + 1, ixIdx >= 0 ? ixIdx : signIdx).filter(
      (l) => !/COMPETEN/i.test(l)
    );
  }
  if (ixIdx >= 0) {
    role.key_interactions = plainItems(rows, ixIdx + 1, signIdx >= 0 ? signIdx : rows.length).filter(
      (l) => !/^(X$|Internal|External)/.test(l)
    );
  }
  roles.push(role);
}

const output = {
  name: 'absl_role_based_agent',
  company: 'Akij Readymix Concrete Ltd (ARMCL)',
  source: 'downloads/13_JD_ARMCL_Employees.xlsx (Google Sheet: JD for ARMCL All Employees)',
  generated_on: new Date().toISOString().slice(0, 10),
  total_roles: roles.length,
  roles,
};

fs.writeFileSync('ABSL_role_based_agent.json', JSON.stringify(output, null, 2), 'utf8');
console.log('Roles:', roles.length);
roles.forEach((r) =>
  console.log(`- ${r.position_title} | resp:${r.key_responsibilities.length} kpi:${r.performance_indicators.length}`)
);
