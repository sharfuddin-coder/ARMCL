const sql = require('mssql');
const config = { server:'203.202.241.211', port:1433, user:'mcp_user', password:'iAOS@35o997', database:'DWH', options:{ trustServerCertificate:true, encrypt:false }, connectionTimeout:15000, requestTimeout:45000 };

async function run() {
  await sql.connect(config);

  // Check order row columns
  let r = await sql.query(`SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='oms' AND TABLE_NAME='tblSalesOrderRowArc' ORDER BY ORDINAL_POSITION`);
  console.log('=== ORDER ROW COLUMNS ===');
  r.recordset.forEach(x => console.log(x.COLUMN_NAME, x.DATA_TYPE));

  // Check all sales force emp names (non-empty)
  r = await sql.query(`SELECT DISTINCT strSalesForceEmpName FROM oms.tblSalesOrderHeaderArc WHERE intBusinessUnitId=175 AND dteSalesOrderDate>='2026-08-01' AND dteSalesOrderDate<'2026-09-01' AND isActive=1 AND strSalesForceEmpName IS NOT NULL AND strSalesForceEmpName != ''`);
  console.log('\n=== NON-EMPTY SALES FORCE NAMES ===');
  r.recordset.forEach(x => console.log(x.strSalesForceEmpName));

  // Check if sales order row has any person field
  r = await sql.query(`SELECT TOP 3 * FROM oms.tblSalesOrderRowArc`);
  console.log('\n=== SAMPLE ORDER ROWS ===');
  r.recordset.forEach(x => console.log(JSON.stringify(x)));

  // Check invoice for order reference
  r = await sql.query(`SELECT TOP 3 intSalesInvoiceId, strRefference, intRefPkId FROM oms.tblSalesInvoiceArc WHERE intUnitID=175 AND dteInvoiceDate>='2026-08-01' AND isActive=1`);
  console.log('\n=== INVOICE REF ===');
  r.recordset.forEach(x => console.log(JSON.stringify(x)));

  await sql.close();
}
run().catch(e => { console.error(e.message); process.exit(1); });
