const XLSX = require('xlsx');
const fs = require('fs');
const wb = XLSX.readFile('downloads/13_JD_ARMCL_Employees.xlsx');
const out = {};
for (const tab of wb.SheetNames) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[tab], { header: 1, defval: '' });
  const lines = [];
  rows.forEach((r, i) => {
    const line = r.map(String).map((s) => s.trim()).filter(Boolean).join(' | ');
    if (line) lines.push(`${i}: ${line}`);
  });
  out[tab] = lines.join('\n');
}
fs.mkdirSync('C:/Users/AHMADA~1/AppData/Local/Temp/opencode/jd', { recursive: true });
for (const [tab, text] of Object.entries(out)) {
  const safe = tab.replace(/[\\/:*?"<>|]/g, '_');
  fs.writeFileSync(`C:/Users/AHMADA~1/AppData/Local/Temp/opencode/jd/${safe}.txt`, text, 'utf8');
}
console.log('wrote', Object.keys(out).length, 'tabs');
