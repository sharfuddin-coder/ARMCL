const sql = require('mssql');
const config = { server:'203.202.241.211', port:1433, user:'mcp_user', password:'iAOS@35o997', database:'DWH', options:{ trustServerCertificate:true, encrypt:false }, connectionTimeout:15000, requestTimeout:30000 };

async function run() {
  await sql.connect(config);

  let r = await sql.query(`SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='oms' AND TABLE_NAME='tblSalesOrderHeaderArc' ORDER BY ORDINAL_POSITION`);
  console.log('=== SALES ORDER HEADER COLUMNS ===');
  r.recordset.forEach(x => console.log(x.COLUMN_NAME, x.DATA_TYPE));

  r = await sql.query(`SELECT TABLE_SCHEMA, TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME LIKE '%SalesOrderRow%'`);
  console.log('\n=== ORDER ROW TABLES ===');
  r.recordset.forEach(x => console.log(x.TABLE_SCHEMA, x.TABLE_NAME));

  await sql.close();
}
run().catch(e => { console.error(e.message); process.exit(1); });
