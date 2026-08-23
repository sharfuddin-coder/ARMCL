const sql = require('mssql');
const fs = require('fs');
const path = require('path');

const UNIT = 175; // ARMCL
const AUG = { from: '2026-08-01', to: '2026-08-31' };

const cfg = {
  server: '203.202.241.211', port: 1433,
  user: 'mcp_user', password: 'iAOS@35o997', database: 'DWH',
  options: { trustServerCertificate: true, encrypt: false }, requestTimeout: 90000
};

function num(v) { return (v === null || v === undefined || isNaN(v)) ? 0 : Number(v); }
function round(v, d) { const f = Math.pow(10, d || 0); return Math.round(num(v) * f) / f; }

async function main() {
  const db = await sql.connect(cfg);
  const F = AUG.from, T = AUG.to;

  // 1. Sales Orders (value + count) August
  const orders = await db.request().input('u', sql.Int, UNIT).input('f', sql.Date, F).input('t', sql.Date, T).query(`
    SELECT COUNT(*) orders, SUM(numNetOrderValue) value
    FROM oms.tblSalesOrderHeaderArc
    WHERE intBusinessUnitId=@u AND isActive=1 AND isRejected=0 AND dteSalesOrderDate>=@f AND dteSalesOrderDate<=@t`);
  const ordVal = num(orders.recordset[0].value);
  const ordCnt = num(orders.recordset[0].orders);

  // 2. Invoices (delivered sales, qty) August + sales force
  const inv = await db.request().input('u', sql.Int, UNIT).input('f', sql.Date, F).input('t', sql.Date, T).query(`
    SELECT COUNT(DISTINCT intSalesInvoiceId) invoices, SUM(numQuantity) qty
    FROM oms.tblSalesInvoiceArc WHERE intUnitID=@u AND isActive=1 AND dteInvoiceDate>=@f AND dteInvoiceDate<=@t`);
  const invQty = num(inv.recordset[0].qty);

  // 3. Deliveries (lifting) value + qty by month
  const del = await db.request().input('u', sql.Int, UNIT).input('f', sql.Date, F).input('t', sql.Date, T).query(`
    SELECT COUNT(*) deliveries, SUM(numTotalDeliveryQuantity) qty, SUM(numTotalNetValue) value
    FROM sms.tblDeliveryHeaderArc WHERE intBusinessUnitId=@u AND dteDeliveryDate>=@f AND dteDeliveryDate<=@t`);
  const delQty = num(del.recordset[0].qty);
  const delVal = num(del.recordset[0].value);

  // 4. Collection (Trade Receivable journal)
  const coll = await db.request().input('u', sql.Int, UNIT).input('f', sql.Date, F).input('t', sql.Date, T).query(`
    SELECT SUM(numAmount) collected, COUNT(*) txns
    FROM fin.tblAccountingJournalArc
    WHERE intBusinessUnitId=@u AND isActive=1 AND numAmount>0 AND dteTransactionDate>=@f AND dteTransactionDate<=@t
      AND strGeneralLedgerName LIKE '%Trade Receivable%'`);
  const collected = num(coll.recordset[0].collected);

  // 5. Plant-wise delivery qty
  const byPlant = await db.request().input('u', sql.Int, UNIT).input('f', sql.Date, F).input('t', sql.Date, T).query(`
    SELECT strPlantName name, SUM(numTotalDeliveryQuantity) qty, SUM(numTotalNetValue) value
    FROM sms.tblDeliveryHeaderArc WHERE intBusinessUnitId=@u AND dteDeliveryDate>=@f AND dteDeliveryDate<=@t
    GROUP BY strPlantName ORDER BY qty DESC`);

  // 6. Product grade mix (order qty)
  const gradeMix = await db.request().input('u', sql.Int, UNIT).input('f', sql.Date, F).input('t', sql.Date, T).query(`
    SELECT TOP 12 r.strItemName item, SUM(r.numOrderQuantity) qty, SUM(r.numNetValue) value
    FROM oms.tblSalesOrderRowArc r JOIN oms.tblSalesOrderHeaderArc h ON r.intSalesOrderId=h.intSalesOrderId
    WHERE r.intBusinessUnitId=@u AND h.isActive=1 AND h.dteSalesOrderDate>=@f AND h.dteSalesOrderDate<=@t
    GROUP BY r.strItemName ORDER BY qty DESC`);

  // 7. Sales force from invoice strSoldByName
  const force = await db.request().input('u', sql.Int, UNIT).input('f', sql.Date, F).input('t', sql.Date, T).query(`
    SELECT strSoldByName name, COUNT(*) txns, SUM(numQuantity) qty
    FROM oms.tblSalesInvoiceArc WHERE intUnitID=@u AND isActive=1 AND dteInvoiceDate>=@f AND dteInvoiceDate<=@t
      AND strSoldByName IS NOT NULL AND strSoldByName<>''
    GROUP BY strSoldByName ORDER BY qty DESC`);

  // 8. Coverage
  const cov = await db.request().input('u', sql.Int, UNIT).input('f', sql.Date, F).input('t', sql.Date, T).query(`
    SELECT (SELECT COUNT(*) FROM prt.tblBusinessPartnerArc WHERE intBusinessUnitId=@u AND isActive=1) universe,
           (SELECT COUNT(DISTINCT intSoldToPartnerId) FROM oms.tblSalesOrderHeaderArc WHERE intBusinessUnitId=@u AND isActive=1 AND dteSalesOrderDate>=@f AND dteSalesOrderDate<=@t) active`);

  // 9. Order book / lifting
  const ob = await db.request().input('u', sql.Int, UNIT).query(`
    SELECT COALESCE(SUM(numOrderQuantity),0) order_qty, COALESCE(SUM(numDeliveredQuantity),0) delivered_qty
    FROM oms.tblSalesOrderRowArc r JOIN oms.tblSalesOrderHeaderArc h ON r.intSalesOrderId=h.intSalesOrderId
    WHERE r.intBusinessUnitId=@u AND h.isActive=1 AND h.isApproved=1 AND h.isRejected=0 AND h.isCompleted=0`);

  // 10. Daily delivery trend
  const daily = await db.request().input('u', sql.Int, UNIT).input('f', sql.Date, F).input('t', sql.Date, T).query(`
    SELECT CAST(dteDeliveryDate AS date) dt, SUM(numTotalDeliveryQuantity) qty
    FROM sms.tblDeliveryHeaderArc WHERE intBusinessUnitId=@u AND dteDeliveryDate>=@f AND dteDeliveryDate<=@t
    GROUP BY CAST(dteDeliveryDate AS date) ORDER BY dt`);

  const active = num(cov.recordset[0].active);
  const universe = num(cov.recordset[0].universe);
  const orderQty = num(ob.recordset[0].order_qty);
  const deliveredQty = num(ob.recordset[0].delivered_qty);

  const data = {
    meta: {
      title: 'ARMCL Sales Management System — August 2026 Control Tower',
      company: 'Akij Ready Mix Concrete Ltd (ARMCL)',
      source: 'iBOS ERP archive (DWH) · ARMCL = BU 175',
      period: 'August 1–31, 2026',
      collected: new Date().toISOString()
    },
    kpi: {
      salesOrders: ordCnt,
      salesOrderValue: round(ordVal, 0),
      invoices: num(inv.recordset[0].invoices),
      invoiceQty: round(invQty, 0),
      deliveries: num(del.recordset[0].deliveries),
      deliveryQty: round(delQty, 0),
      deliveryValue: round(delVal, 0),
      collection: round(collected, 0),
      collectionPct: round(delVal > 0 ? collected / delVal * 100 : 0, 1),
      activeCustomers: active,
      universe,
      coveragePct: round(universe > 0 ? active / universe * 100 : 0, 1),
      orderQty: round(orderQty, 0),
      deliveredQty: round(deliveredQty, 0),
      liftingPct: round(orderQty > 0 ? deliveredQty / orderQty * 100 : 0, 1),
      avgOrderValue: round(ordCnt > 0 ? ordVal / ordCnt : 0, 0),
      gradeCount: gradeMix.recordset.length,
      plantCount: byPlant.recordset.length,
      salesForce: force.recordset.length
    },
    daily: daily.recordset.map(r => ({ date: r.dt.toISOString().slice(0, 10), qty: num(r.qty) })),
    byPlant: byPlant.recordset.map(r => ({ name: r.name, qty: num(r.qty), value: num(r.value) })),
    gradeMix: gradeMix.recordset.map(r => ({ item: r.item, qty: num(r.qty), value: num(r.value) })),
    salesForce: force.recordset.map(r => ({ name: r.name, txns: r.txns, qty: num(r.qty) }))
  };

  fs.writeFileSync(path.join(__dirname, 'sms-control-tower', 'ibos-august-2026.json'), JSON.stringify(data, null, 2), 'utf8');
  console.log('Written: sms-control-tower/ibos-august-2026.json');
  console.log('Orders:', ordCnt, '| Order Value:', ordVal);
  console.log('Invoices:', num(inv.recordset[0].invoices), '| Qty:', invQty, '| Deliveries:', delQty, '| Deliv Value:', delVal);
  console.log('Collection:', collected, '(', data.kpi.collectionPct, '%)');
  console.log('Coverage:', active, '/', universe, '(', data.kpi.coveragePct, '%)');
  console.log('Sales Force reps:', force.recordset.length, '| Plants:', byPlant.recordset.length, '| Grades:', gradeMix.recordset.length);
  await db.close();
}

main().catch(e => { console.error('ERR', e.message); process.exit(1); });
