const sql = require('mssql');
const config = { server: '203.202.241.211', port: 1433, user: 'mcp_user', password: 'iAOS@35o997', database: 'DWH', options: { trustServerCertificate: true, encrypt: false }, connectionTimeout: 15000, requestTimeout: 30000 };

async function run() {
  await sql.connect(config);

  let r = await sql.query(`
    SELECT dteTransactionDate dt, COUNT(*) cnt, SUM(numAmount) collection
    FROM fin.tblAccountingJournalArc
    WHERE intBusinessUnitId = 175
      AND dteTransactionDate >= '2026-07-01' AND dteTransactionDate < '2026-08-01'
      AND isActive = 1 AND numAmount > 0
      AND strGeneralLedgerName LIKE '%Trade Receivable%'
    GROUP BY dteTransactionDate ORDER BY dt
  `);
  console.log('=== COLLECTION FROM CUSTOMERS (Trade Receivable) ===');
  let totalColl = 0;
  r.recordset.forEach(x => { totalColl += x.collection; console.log(JSON.stringify(x)); });
  console.log('TOTAL:', totalColl);

  r = await sql.query(`
    SELECT COUNT(*) cnt, SUM(numQuantity) qty
    FROM oms.tblSalesInvoiceArc
    WHERE intUnitID = 175
      AND dteInvoiceDate >= '2026-07-01' AND dteInvoiceDate < '2026-08-01'
      AND isActive = 1
  `);
  console.log('\n=== TOTAL SALES ===');
  r.recordset.forEach(x => console.log(JSON.stringify(x)));

  await sql.close();
}
run().catch(e => { console.error(e.message); process.exit(1); });
