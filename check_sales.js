const sql = require('mssql');
const config = { server:'203.202.241.211', port:1433, user:'mcp_user', password:'iAOS@35o997', database:'DWH', options:{ trustServerCertificate:true, encrypt:false }, connectionTimeout:15000, requestTimeout:30000 };

async function run() {
  await sql.connect(config);

  // Sales value from invoice details (payment amount)
  let r = await sql.query(`
    SELECT si.strSoldByName, COUNT(*) cnt, SUM(si.numQuantity) qty, SUM(d.decPaymentAmount) salesValue
    FROM oms.tblSalesInvoiceArc si
    LEFT JOIN oms.tblSalesInvoiceDetailsArc d ON si.intSalesInvoiceId = d.intSalesInvoiceId
    WHERE si.intUnitID=175 AND si.dteInvoiceDate>='2026-08-01' AND si.dteInvoiceDate<'2026-09-01' AND si.isActive=1
    GROUP BY si.strSoldByName ORDER BY salesValue DESC
  `);
  console.log('=== SALES WITH VALUE ===');
  r.recordset.forEach(x => console.log(JSON.stringify(x)));

  // Totals with value
  r = await sql.query(`
    SELECT COUNT(DISTINCT si.intSalesInvoiceId) invoices, SUM(si.numQuantity) qty, SUM(d.decPaymentAmount) salesValue
    FROM oms.tblSalesInvoiceArc si
    LEFT JOIN oms.tblSalesInvoiceDetailsArc d ON si.intSalesInvoiceId = d.intSalesInvoiceId
    WHERE si.intUnitID=175 AND si.dteInvoiceDate>='2026-08-01' AND si.dteInvoiceDate<'2026-09-01' AND si.isActive=1
  `);
  console.log('\nTOTALS:', JSON.stringify(r.recordset[0]));

  // Daily with value
  r = await sql.query(`
    SELECT CAST(si.dteInvoiceDate AS DATE) dt, COUNT(DISTINCT si.intSalesInvoiceId) inv, SUM(si.numQuantity) qty, SUM(d.decPaymentAmount) val
    FROM oms.tblSalesInvoiceArc si
    LEFT JOIN oms.tblSalesInvoiceDetailsArc d ON si.intSalesInvoiceId = d.intSalesInvoiceId
    WHERE si.intUnitID=175 AND si.dteInvoiceDate>='2026-08-01' AND si.dteInvoiceDate<'2026-09-01' AND si.isActive=1
    GROUP BY CAST(si.dteInvoiceDate AS DATE) ORDER BY dt
  `);
  console.log('\n=== DAILY WITH VALUE ===');
  r.recordset.forEach(x => console.log(JSON.stringify(x)));

  await sql.close();
}
run().catch(e => { console.error(e.message); process.exit(1); });
