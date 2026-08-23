const express = require('express');
const path = require('path');
const sql = require('mssql');
require('dotenv').config();

const PORT = parseInt(process.env.SMS_IBOS_PORT || '3200');
const UNIT = 175; // ARMCL

const dbConfig = {
  server: process.env.DB_SERVER || '203.202.241.211',
  port: parseInt(process.env.DB_PORT || '1433'),
  user: process.env.DB_USER || 'mcp_user',
  password: process.env.DB_PASSWORD || 'iAOS@35o997',
  database: process.env.DB_NAME || 'DWH',
  options: { trustServerCertificate: true, encrypt: false },
  connectionTimeout: 15000,
  requestTimeout: 90000
};

let pool = null;
async function getPool() {
  if (!pool) pool = await sql.connect(dbConfig);
  return pool;
}

function num(v) { return (v === null || v === undefined || isNaN(v)) ? 0 : Number(v); }
function round(v, d) { const f = Math.pow(10, d || 0); return Math.round(num(v) * f) / f; }

async function buildTower(year, month) {
  const db = await getPool();
  const F = `${year}-${String(month).padStart(2, '0')}-01`;
  const T = `${year}-${String(month).padStart(2, '0')}-31`;
  const P = `${year}-${String(month - 1).padStart(2, '0')}-01`; // prior month start
  const Q = `${year}-${String(month - 1).padStart(2, '0')}-31`; // prior month end

  // 1. Orders (current + prior for MoM)
  const orders = await db.request().input('u', sql.Int, UNIT).input('f', sql.Date, F).input('t', sql.Date, T).query(`
    SELECT COUNT(*) orders, SUM(numNetOrderValue) value
    FROM oms.tblSalesOrderHeaderArc
    WHERE intBusinessUnitId=@u AND isActive=1 AND isRejected=0 AND dteSalesOrderDate>=@f AND dteSalesOrderDate<=@t`);
  const priorOrders = await db.request().input('u', sql.Int, UNIT).input('f', sql.Date, P).input('t', sql.Date, Q).query(`
    SELECT COUNT(*) orders, SUM(numNetOrderValue) value
    FROM oms.tblSalesOrderHeaderArc
    WHERE intBusinessUnitId=@u AND isActive=1 AND isRejected=0 AND dteSalesOrderDate>=@f AND dteSalesOrderDate<=@t`);

  // 2. Invoices
  const inv = await db.request().input('u', sql.Int, UNIT).input('f', sql.Date, F).input('t', sql.Date, T).query(`
    SELECT COUNT(DISTINCT intSalesInvoiceId) invoices, SUM(numQuantity) qty
    FROM oms.tblSalesInvoiceArc WHERE intUnitID=@u AND isActive=1 AND dteInvoiceDate>=@f AND dteInvoiceDate<=@t`);

  // 3. Deliveries + daily trend
  const del = await db.request().input('u', sql.Int, UNIT).input('f', sql.Date, F).input('t', sql.Date, T).query(`
    SELECT COUNT(*) deliveries, SUM(numTotalDeliveryQuantity) qty, SUM(numTotalNetValue) value
    FROM sms.tblDeliveryHeaderArc WHERE intBusinessUnitId=@u AND dteDeliveryDate>=@f AND dteDeliveryDate<=@t`);
  const daily = await db.request().input('u', sql.Int, UNIT).input('f', sql.Date, F).input('t', sql.Date, T).query(`
    SELECT CAST(dteDeliveryDate AS date) dt, SUM(numTotalDeliveryQuantity) qty
    FROM sms.tblDeliveryHeaderArc WHERE intBusinessUnitId=@u AND dteDeliveryDate>=@f AND dteDeliveryDate<=@t
    GROUP BY CAST(dteDeliveryDate AS date) ORDER BY dt`);

  // 4. Collection (Trade Receivable journal)
  const coll = await db.request().input('u', sql.Int, UNIT).input('f', sql.Date, F).input('t', sql.Date, T).query(`
    SELECT SUM(numAmount) collected, COUNT(*) txns
    FROM fin.tblAccountingJournalArc
    WHERE intBusinessUnitId=@u AND isActive=1 AND numAmount>0 AND dteTransactionDate>=@f AND dteTransactionDate<=@t
      AND strGeneralLedgerName LIKE '%Trade Receivable%'`);

  // 5. Plant-wise delivery
  const byPlant = await db.request().input('u', sql.Int, UNIT).input('f', sql.Date, F).input('t', sql.Date, T).query(`
    SELECT strPlantName name, SUM(numTotalDeliveryQuantity) qty, SUM(numTotalNetValue) value
    FROM sms.tblDeliveryHeaderArc WHERE intBusinessUnitId=@u AND dteDeliveryDate>=@f AND dteDeliveryDate<=@t
    GROUP BY strPlantName ORDER BY qty DESC`);

  // 6. Grade mix
  const gradeMix = await db.request().input('u', sql.Int, UNIT).input('f', sql.Date, F).input('t', sql.Date, T).query(`
    SELECT TOP 12 r.strItemName item, SUM(r.numOrderQuantity) qty, SUM(r.numNetValue) value
    FROM oms.tblSalesOrderRowArc r JOIN oms.tblSalesOrderHeaderArc h ON r.intSalesOrderId=h.intSalesOrderId
    WHERE r.intBusinessUnitId=@u AND h.isActive=1 AND h.dteSalesOrderDate>=@f AND h.dteSalesOrderDate<=@t
    GROUP BY r.strItemName ORDER BY qty DESC`);

  // 7. Sales force
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

  const ordVal = num(orders.recordset[0].value);
  const ordCnt = num(orders.recordset[0].orders);
  const prevVal = num(priorOrders.recordset[0].value);
  const delVal = num(del.recordset[0].value);
  const delQty = num(del.recordset[0].qty);
  const collected = num(coll.recordset[0].collected);
  const active = num(cov.recordset[0].active);
  const universe = num(cov.recordset[0].universe);
  const orderQty = num(ob.recordset[0].order_qty);
  const deliveredQty = num(ob.recordset[0].delivered_qty);

  const kpi = {
    salesOrders: ordCnt,
    salesOrderValue: round(ordVal, 0),
    avgOrderValue: round(ordCnt > 0 ? ordVal / ordCnt : 0, 0),
    invoices: num(inv.recordset[0].invoices),
    invoiceQty: round(num(inv.recordset[0].qty), 0),
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
    momGrowthPct: round(prevVal > 0 ? (ordVal - prevVal) / prevVal * 100 : 0, 1),
    prevMonthValue: round(prevVal, 0),
    gradeCount: gradeMix.recordset.length,
    plantCount: byPlant.recordset.length,
    salesForce: force.recordset.length
  };

  return {
    meta: {
      title: `ARMCL Live SMS Control Tower — iBOS ERP`,
      company: 'Akij Ready Mix Concrete Ltd (ARMCL)',
      source: 'iBOS ERP archive (DWH) · ARMCL = BU 175 · LIVE query',
      period: `${F} to ${T}`,
      month: `${['','January','February','March','April','May','June','July','August','September','October','November','December'][month]} ${year}`,
      collected: new Date().toISOString()
    },
    kpi,
    daily: daily.recordset.map(r => ({ date: r.dt.toISOString().slice(0, 10), qty: num(r.qty) })),
    byPlant: byPlant.recordset.map(r => ({ name: r.name, qty: num(r.qty), value: num(r.value) })),
    gradeMix: gradeMix.recordset.map(r => ({ item: r.item, qty: num(r.qty), value: num(r.value) })),
    salesForce: force.recordset.map(r => ({ name: r.name, txns: r.txns, qty: num(r.qty) }))
  };
}

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/sms-tower-ibos', async (req, res) => {
  try {
    const now = new Date();
    const year = parseInt(req.query.year) || now.getFullYear();
    const month = parseInt(req.query.month) || (now.getMonth() + 1);
    res.json(await buildTower(year, month));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/sms-tower-ibos', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'sms-tower-ibos.html'));
});

module.exports = app;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`iBOS Live SMS Control Tower: http://localhost:${PORT}/sms-tower-ibos`);
    console.log(`API: http://localhost:${PORT}/api/sms-tower-ibos?year=2026&month=8`);
  });
}
