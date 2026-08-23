const XLSX = require('xlsx');
const wb = XLSX.readFile('downloads/13_JD_ARMCL_Employees.xlsx');
console.log('Sheets:', wb.SheetNames);
for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  console.log(`\n=== ${name} (${rows.length} rows) ===`);
  rows.slice(0, 5).forEach((r, i) => console.log(i, JSON.stringify(r).slice(0, 400)));
}
