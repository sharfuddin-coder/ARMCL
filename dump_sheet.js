const XLSX = require('xlsx');
const file = process.argv[2] || 'downloads/14_Sales_Manpower_Organogram.xlsx';
const needle = (process.argv[3] || '').toLowerCase();
const wb = XLSX.readFile(file);
console.log('File:', file, '| Sheets:', wb.SheetNames.join(', '));
for (const name of wb.SheetNames) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' });
  rows.forEach((r, i) => {
    const line = r.join(' | ').replace(/\s+/g, ' ');
    if (!needle || line.toLowerCase().includes(needle)) {
      if (line.trim()) console.log(`[${name}] ${i}: ${line.slice(0, 250)}`);
    }
  });
}
