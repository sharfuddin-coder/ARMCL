const sql = require('mssql');
const config = {
  server: '203.202.241.211', port: 1433, user: 'mcp_user', password: 'iAOS@35o997',
  database: 'DWH', options: { trustServerCertificate: true, encrypt: false },
  connectionTimeout: 15000, requestTimeout: 30000
};

async function run() {
  await sql.connect(config);

  // Check collection via journal - AR receipt GL accounts
  let r = await sql.query(`
    SELECT TOP 5 strGeneralLedgerName, strSubGLName, COUNT(*) cnt, SUM(numAmount) total
    FROM fin.tblAccountingJournalArc
    WHERE intBusinessUnitId = 175
      AND dteTransactionDate >= '2026-07-01' AND dteTransactionDate < '2026-08-01'
      AND isActive = 1
    GROUP BY strGeneralLedgerName, strSubGLName ORDER BY total DESC
  `);
  console.log('=== COLLECTION - TOP GL ACCOUNTS ===');
  r.recordset.forEach(x => console.log(JSON.stringify(x)));

  // Check collection via journal per day
  r = await sql.query(`
    SELECT dteTransactionDate dt, COUNT(*) cnt, SUM(numAmount) total
    FROM fin.tblAccountingJournalArc
    WHERE intBusinessUnitId = 175
      AND dteTransactionDate >= '2026-07-01' AND dteTransactionDate < '2026-08-01'
      AND isActive = 1 AND numAmount > 0
    GROUP BY dteTransactionDate ORDER BY dt
  `);
  console.log('\n=== COLLECTION - DAILY ===');
  r.recordset.forEach(x => console.log(JSON.stringify(x)));

  await sql.close();
}
run().catch(e => { console.error(e.message); process.exit(1); });
