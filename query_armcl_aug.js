const sql = require('mssql');
const config = { server:'203.202.241.211', port:1433, user:'mcp_user', password:'iAOS@35o997', database:'DWH', options:{ trustServerCertificate:true, encrypt:false }, connectionTimeout:15000, requestTimeout:30000 };

async function run() {
  await sql.connect(config);

  let r = await sql.query(`SELECT strSoldByName, COUNT(*) cnt, SUM(numQuantity) qty FROM oms.tblSalesInvoiceArc WHERE intUnitID=175 AND dteInvoiceDate>='2026-08-01' AND dteInvoiceDate<'2026-09-01' AND isActive=1 GROUP BY strSoldByName ORDER BY qty DESC`);
  console.log('=== SALES PERSONS ===');
  r.recordset.forEach(x => console.log(JSON.stringify(x)));

  r = await sql.query(`SELECT COUNT(*) cnt, SUM(numQuantity) qty FROM oms.tblSalesInvoiceArc WHERE intUnitID=175 AND dteInvoiceDate>='2026-08-01' AND dteInvoiceDate<'2026-09-01' AND isActive=1`);
  console.log('\nTOTAL:', r.recordset[0].cnt, 'invoices,', r.recordset[0].qty, 'qty');

  r = await sql.query(`SELECT CAST(dteInvoiceDate AS DATE) dt, COUNT(*) cnt, SUM(numQuantity) qty FROM oms.tblSalesInvoiceArc WHERE intUnitID=175 AND dteInvoiceDate>='2026-08-01' AND dteInvoiceDate<'2026-09-01' AND isActive=1 GROUP BY CAST(dteInvoiceDate AS DATE) ORDER BY dt`);
  console.log('\n=== DAILY SALES ===');
  r.recordset.forEach(x => console.log(JSON.stringify(x)));

  r = await sql.query(`SELECT dteTransactionDate dt, COUNT(*) cnt, SUM(numAmount) coll FROM fin.tblAccountingJournalArc WHERE intBusinessUnitId=175 AND dteTransactionDate>='2026-08-01' AND dteTransactionDate<'2026-09-01' AND isActive=1 AND numAmount>0 AND strGeneralLedgerName LIKE '%Trade Receivable%' GROUP BY dteTransactionDate ORDER BY dt`);
  let t=0;
  console.log('\n=== DAILY COLLECTION ===');
  r.recordset.forEach(x => { t+=x.coll; console.log(JSON.stringify(x)); });
  console.log('TOTAL COLLECTION:', t);

  await sql.close();
}
run().catch(e => { console.error(e.message); process.exit(1); });
