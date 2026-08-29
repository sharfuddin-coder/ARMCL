const sql = require('mssql');
const fs = require('fs');
const cfg = { server: '203.202.241.211', port: 1433, user: 'mcp_user', password: 'iAOS@35o997', database: 'DWH', options: { trustServerCertificate: true, encrypt: false }, requestTimeout: 90000 };
function num(v) { return (v === null || v === undefined || isNaN(v)) ? 0 : Number(v); }
(async () => {
  const db = await sql.connect(cfg);
  const F = '2026-08-01', T = '2026-08-31';
  const [byPlant, gradeMix, daily, cov, del] = await Promise.all([
    db.request().input('u', sql.Int, 175).input('f', sql.Date, F).input('t', sql.Date, T).query(`SELECT strPlantName name, SUM(numTotalDeliveryQuantity) q, SUM(numTotalNetValue) v FROM sms.tblDeliveryHeaderArc WHERE intBusinessUnitId=@u AND dteDeliveryDate>=@f AND dteDeliveryDate<=@t GROUP BY strPlantName ORDER BY q DESC`),
    db.request().input('u', sql.Int, 175).input('f', sql.Date, F).input('t', sql.Date, T).query(`SELECT TOP 12 r.strItemName item, SUM(r.numOrderQuantity) q FROM oms.tblSalesOrderRowArc r JOIN oms.tblSalesOrderHeaderArc h ON r.intSalesOrderId=h.intSalesOrderId WHERE r.intBusinessUnitId=@u AND h.isActive=1 AND h.dteSalesOrderDate>=@f AND h.dteSalesOrderDate<=@t GROUP BY r.strItemName ORDER BY q DESC`),
    db.request().input('u', sql.Int, 175).input('f', sql.Date, F).input('t', sql.Date, T).query(`SELECT CAST(dteDeliveryDate AS date) dt, SUM(numTotalDeliveryQuantity) q FROM sms.tblDeliveryHeaderArc WHERE intBusinessUnitId=@u AND dteDeliveryDate>=@f AND dteDeliveryDate<=@t GROUP BY CAST(dteDeliveryDate AS date) ORDER BY dt`),
    db.request().input('u', sql.Int, 175).input('f', sql.Date, F).input('t', sql.Date, T).query(`SELECT (SELECT COUNT(*) FROM prt.tblBusinessPartnerArc WHERE intBusinessUnitId=@u AND isActive=1) universe, (SELECT COUNT(DISTINCT intSoldToPartnerId) FROM oms.tblSalesOrderHeaderArc WHERE intBusinessUnitId=@u AND isActive=1 AND dteSalesOrderDate>=@f AND dteSalesOrderDate<=@t) active`),
    db.request().input('u', sql.Int, 175).input('f', sql.Date, F).input('t', sql.Date, T).query(`SELECT COUNT(*) n, SUM(numTotalDeliveryQuantity) q, SUM(numTotalNetValue) v FROM sms.tblDeliveryHeaderArc WHERE intBusinessUnitId=@u AND dteDeliveryDate>=@f AND dteDeliveryDate<=@t`)
  ]);
  const out = {
    byPlant: byPlant.recordset.map(r => ({ name: r.name, qty: num(r.q), value: num(r.v) })),
    gradeMix: gradeMix.recordset.map(r => ({ item: r.item, qty: num(r.q) })),
    daily: daily.recordset.map(r => ({ date: r.dt.toISOString().slice(0, 10), qty: num(r.q) })),
    coverage: { universe: num(cov.recordset[0].universe), active: num(cov.recordset[0].active) },
    delivery: { count: num(del.recordset[0].n), qty: num(del.recordset[0].q), value: num(del.recordset[0].v) }
  };
  fs.writeFileSync('sms-control-tower/august-ibos-panels.json', JSON.stringify(out, null, 2), 'utf8');
  console.log('Panels saved. Plants:', out.byPlant.length, 'Grades:', out.gradeMix.length, 'Daily:', out.daily.length);
  console.log('Coverage:', out.coverage.active, '/', out.coverage.universe, '| Delivery:', out.delivery.qty, 'CFT,', out.delivery.value, 'BDT');
  await db.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
