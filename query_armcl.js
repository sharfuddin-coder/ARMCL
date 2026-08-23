const sql = require('mssql');
const config = {
  server: '203.202.241.211',
  port: 1433,
  user: 'mcp_user',
  password: 'iAOS@35o997',
  database: 'DWH',
  options: { trustServerCertificate: true, encrypt: false },
  connectionTimeout: 15000,
  requestTimeout: 30000
};

async function run() {
  await sql.connect(config);

  const r1 = await sql.query(`
    SELECT strSoldByName, COUNT(*) cnt, SUM(numQuantity) qty
    FROM oms.tblSalesInvoiceArc
    WHERE intUnitID = 175
      AND dteInvoiceDate >= '2026-07-01' AND dteInvoiceDate < '2026-08-01'
      AND isActive = 1
    GROUP BY strSoldByName ORDER BY qty DESC
  `);
  console.log('=== SALES PERSONS ===');
  r1.recordset.forEach(r => console.log(JSON.stringify(r)));

  const r2 = await sql.query(`
    SELECT CAST(dteInvoiceDate AS DATE) dt, COUNT(*) cnt, SUM(numQuantity) qty
    FROM oms.tblSalesInvoiceArc
    WHERE intUnitID = 175
      AND dteInvoiceDate >= '2026-07-01' AND dteInvoiceDate < '2026-08-01'
      AND isActive = 1
    GROUP BY CAST(dteInvoiceDate AS DATE) ORDER BY dt
  `);
  console.log('\n=== DAILY SALES ===');
  r2.recordset.forEach(r => console.log(JSON.stringify(r)));

  const r3 = await sql.query(`
    SELECT strPartnerName, COUNT(*) cnt, SUM(numQuantity) qty
    FROM oms.tblSalesInvoiceArc
    WHERE intUnitID = 175
      AND dteInvoiceDate >= '2026-07-01' AND dteInvoiceDate < '2026-08-01'
      AND isActive = 1
    GROUP BY strPartnerName ORDER BY qty DESC
  `);
  console.log('\n=== TOP CUSTOMERS ===');
  r3.recordset.slice(0,15).forEach(r => console.log(JSON.stringify(r)));

  await sql.close();
}
run().catch(e => { console.error(e.message); process.exit(1); });
