const XLSX = require('xlsx');
const wb = XLSX.readFile('downloads/13_JD_ARMCL_Employees.xlsx');
const needle = process.argv[2] ? process.argv[2].toLowerCase() : 'ahmad';
for (const name of wb.SheetNames) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' });
  rows.forEach((r, i) => {
    const line = r.join(' | ');
    if (line.toLowerCase().includes(needle)) {
      console.log(`[${name}] row ${i}: ${line.slice(0, 300)}`);
    }
  });
}
