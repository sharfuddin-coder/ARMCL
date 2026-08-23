const sql = require('mssql');
const fs = require('fs');
const path = require('path');

const UNIT = 175;
const cfg = {
  server: process.env.DB_SERVER || '203.202.241.211',
  port: parseInt(process.env.DB_PORT || '1433'),
  user: process.env.DB_USER || 'mcp_user',
  password: process.env.DB_PASSWORD || 'iAOS@35o997',
  database: process.env.DB_NAME || 'DWH',
  options: { trustServerCertificate: true, encrypt: false },
  requestTimeout: 90000
};

function num(v) { return (v === null || v === undefined || isNaN(v)) ? 0 : Number(v); }

async function main() {
  const db = await sql.connect(cfg);
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;

  const [byPlant, gradeMix, drivers, coverage, collection, orderBook] = await Promise.all([
    db.request().input('unit', sql.Int, UNIT).input('from', sql.Date, monthStart).query(
      `SELECT strPlantName name, SUM(numTotalDeliveryQuantity) qty
       FROM sms.tblDeliveryHeaderArc WHERE intBusinessUnitId=@unit AND dteDeliveryDate>=@from
       GROUP BY strPlantName ORDER BY qty DESC`),
    db.request().input('unit', sql.Int, UNIT).input('from', sql.Date, monthStart).query(
      `SELECT TOP 12 r.strItemName item, SUM(r.numOrderQuantity) qty
       FROM oms.tblSalesOrderRowArc r JOIN oms.tblSalesOrderHeaderArc h ON r.intSalesOrderId=h.intSalesOrderId
       WHERE r.intBusinessUnitId=@unit AND h.isActive=1 AND h.dteSalesOrderDate>=@from
       GROUP BY r.strItemName ORDER BY qty DESC`),
    db.request().input('unit', sql.Int, UNIT).input('from', sql.Date, monthStart).query(
      `SELECT COUNT(DISTINCT intSoldToPartnerId) active, COUNT(*) orders
       FROM oms.tblSalesOrderHeaderArc WHERE intBusinessUnitId=@unit AND isActive=1 AND dteSalesOrderDate>=@from`),
    db.request().input('unit', sql.Int, UNIT).input('from', sql.Date, monthStart).query(
      `SELECT (SELECT COUNT(*) FROM prt.tblBusinessPartnerArc WHERE intBusinessUnitId=@unit AND isActive=1) universe,
              (SELECT COUNT(DISTINCT intSoldToPartnerId) FROM oms.tblSalesOrderHeaderArc WHERE intBusinessUnitId=@unit AND isActive=1 AND dteSalesOrderDate>=@from) active`),
    db.request().input('unit', sql.Int, UNIT).input('from', sql.Date, monthStart).query(
      `SELECT SUM(numAmount) collected, COUNT(*) txns
       FROM fin.tblAccountingJournalArc WHERE intBusinessUnitId=@unit AND isActive=1 AND numAmount>0
         AND dteTransactionDate>=@from AND strGeneralLedgerName LIKE '%Trade Receivable%'`),
    db.request().input('unit', sql.Int, UNIT).input('from', sql.Date, monthStart).query(
      `SELECT (SELECT SUM(numNetOrderValue) FROM oms.tblSalesOrderHeaderArc WHERE intBusinessUnitId=@unit AND isActive=1 AND dteSalesOrderDate>=@from) sales_value`),
  ]);

  const activeCust = num(drivers.recordset[0].active);
  const totalOrders = num(drivers.recordset[0].orders);
  const universe = num(coverage.recordset[0].universe);
  const collected = num(collection.recordset[0].collected);
  const salesValue = num(orderBook.recordset[0].sales_value);
  const collectionPct = salesValue > 0 ? collected / salesValue * 100 : 0;

  const snapshot = {
    generated: now.toISOString(),
    meta: { unit: UNIT, name: 'Akij Ready Mix Concrete Ltd (ARMCL)', period: `${monthStart} to ${now.toISOString().slice(0, 10)}` },
    panels: {
      p5: {
        activeCustomers: activeCust,
        totalOrders,
        frequency: activeCust > 0 ? Math.round(totalOrders / activeCust * 100) / 100 : 0,
        gradeMix: gradeMix.recordset.map(r => ({ item: r.item, qty: num(r.qty) }))
      },
      p6: {
        byPlant: byPlant.recordset.map(r => ({ name: r.name, qty: num(r.qty) })),
        byOffice: []
      },
      p9: { universe, active: activeCust, coveragePct: Math.round((universe > 0 ? activeCust / universe * 100 : 0) * 10) / 10 },
      p11: { salesValue, collected, collectionPct: Math.round(collectionPct * 10) / 10, source: 'DWH snapshot (generated offline)' }
    }
  };

  fs.writeFileSync(path.join(__dirname, 'sms-control-tower', 'dwh-snapshot.json'), JSON.stringify(snapshot, null, 2), 'utf8');
  console.log('Snapshot written:', path.join(__dirname, 'sms-control-tower', 'dwh-snapshot.json'));
  console.log('Plants:', snapshot.panels.p6.byPlant.length, 'Grades:', snapshot.panels.p5.gradeMix.length, 'Collection%:', snapshot.panels.p11.collectionPct);
  await db.close();
}

main().catch(e => { console.error('ERR', e.message); process.exit(1); });
