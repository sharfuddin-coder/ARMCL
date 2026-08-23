const XLSX = require('xlsx');
const wb = XLSX.readFile('downloads/13_JD_ARMCL_Employees.xlsx');
const tab = process.argv[2];
const rows = XLSX.utils.sheet_to_json(wb.Sheets[tab], { header: 1, defval: '' });
rows.forEach((r, i) => {
  const line = r.map(String).map(s => s.trim()).filter(Boolean).join(' | ');
  if (line) console.log(`${i}: ${line.slice(0, 500)}`);
});
