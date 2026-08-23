const sql = require('mssql');
const config = { server:'203.202.241.211', port:1433, user:'mcp_user', password:'iAOS@35o997', database:'DWH', options:{ trustServerCertificate:true, encrypt:false }, connectionTimeout:15000, requestTimeout:45000 };

async function run() {
  await sql.connect(config);

  let r = await sql.query(`
    SELECT strSalesForceEmpName, COUNT(*) orders, SUM(numNetOrderValue) totalValue, SUM(numTotalOrderValue) grossValue
    FROM oms.tblSalesOrderHeaderArc
    WHERE intBusinessUnitId=175 AND dteSalesOrderDate>='2026-08-01' AND dteSalesOrderDate<'2026-09-01' AND isActive=1
    GROUP BY strSalesForceEmpName ORDER BY totalValue DESC
  `);
  console.log('=== SALES ORDERS BY PERSON ===');
  r.recordset.forEach(x => console.log(JSON.stringify(x)));

  r = await sql.query(`
    SELECT COUNT(*) orders, SUM(numNetOrderValue) netValue, SUM(numTotalOrderValue) grossValue
    FROM oms.tblSalesOrderHeaderArc
    WHERE intBusinessUnitId=175 AND dteSalesOrderDate>='2026-08-01' AND dteSalesOrderDate<'2026-09-01' AND isActive=1
  `);
  console.log('\nTOTALS:', JSON.stringify(r.recordset[0]));

  r = await sql.query(`
    SELECT CAST(dteSalesOrderDate AS DATE) dt, COUNT(*) orders, SUM(numNetOrderValue) netVal
    FROM oms.tblSalesOrderHeaderArc
    WHERE intBusinessUnitId=175 AND dteSalesOrderDate>='2026-08-01' AND dteSalesOrderDate<'2026-09-01' AND isActive=1
    GROUP BY CAST(dteSalesOrderDate AS DATE) ORDER BY dt
  `);
  console.log('\n=== DAILY ===');
  r.recordset.forEach(x => console.log(JSON.stringify(x)));

  await sql.close();
}
run().catch(e => { console.error(e.message); process.exit(1); });
