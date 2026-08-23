const sql = require('mssql');
const config = { server:'203.202.241.211', port:1433, user:'mcp_user', password:'iAOS@35o997', database:'DWH', options:{ trustServerCertificate:true, encrypt:false }, connectionTimeout:15000, requestTimeout:30000 };

async function run() {
  await sql.connect(config);

  // Check invoice details table columns
  let r = await sql.query(`SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='oms' AND TABLE_NAME='tblSalesInvoiceDetailsArc' ORDER BY ORDINAL_POSITION`);
  console.log('=== INVOICE DETAILS COLUMNS ===');
  r.recordset.forEach(x => console.log(x.COLUMN_NAME, x.DATA_TYPE));

  // Check sample invoice data
  r = await sql.query(`SELECT TOP 3 strItemName, numQuantity, dteInvoiceDate, strSoldByName FROM oms.tblSalesInvoiceArc WHERE intUnitID=175 AND dteInvoiceDate>='2026-08-01' AND dteInvoiceDate<'2026-09-01' AND isActive=1`);
  console.log('\n=== SAMPLE INVOICES ===');
  r.recordset.forEach(x => console.log(JSON.stringify(x)));

  // Check sales order header
  r = await sql.query(`SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME LIKE '%SalesOrderHeader%'`);
  console.log('\n=== SALES ORDER TABLES ===');
  r.recordset.forEach(x => console.log(x.TABLE_SCHEMA, x.TABLE_NAME));

  await sql.close();
}
run().catch(e => { console.error(e.message); process.exit(1); });
