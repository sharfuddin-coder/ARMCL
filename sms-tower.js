const express = require('express');
const path = require('path');
const https = require('https');
const sql = require('mssql');
require('dotenv').config();

const PORT = parseInt(process.env.SMS_PORT || '3100');
const UNIT = 175; // ARMCL

const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '1vPlcijsZkj4p6ZHmzg7jEAutNrW5l2YKlbNUtgXkNbI';
const GID_TARGET = process.env.SHEET_GID || '990537426';   // Sales Target Achievement report (CFT)
const GID_DAYWISE = '2096727161';                            // Day wise Sales (CFT)

const dbConfig = {
  server: process.env.DB_SERVER || '203.202.241.211',
  port: parseInt(process.env.DB_PORT || '1433'),
  user: process.env.DB_USER || 'mcp_user',
  password: process.env.DB_PASSWORD || 'iAOS@35o997',
  database: process.env.DB_NAME || 'DWH',
  options: { trustServerCertificate: true, encrypt: false },
  connectionTimeout: 15000,
  requestTimeout: 60000
};

let pool = null;
async function getPool() {
  if (!pool) pool = await sql.connect(dbConfig);
  return pool;
}

const curYear = new Date().getFullYear();
const curMonth = new Date().getMonth() + 1;

// ---------- Google Sheets (authoritative CFT tracker) ----------
function fetchCsv(url) {
  return new Promise((res, rej) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (r) => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => res(d));
    }).on('error', rej);
  });
}
function parseCsv(text) {
  const rows = []; let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c === '\r') {}
      else field += c;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}
function cleanNum(v) { return parseFloat(String(v).replace(/[^0-9.\-]/g, '')) || 0; }

async function getTargetReport() {
  const text = await fetchCsv(`https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=${GID_TARGET}`);
  const rows = parseCsv(text);
  const employees = [];
  const glance = {};
  rows.forEach((row, i) => {
    if (i < 3) return;
    const name = String(row[1] || '').trim();
    const dg = String(row[2] || '').trim();
    const gKey = String(row[15] || '').trim();
    if (gKey && i >= 5) {
      const gVal = String(row[16] || '').trim();
      if (gVal) glance[gKey] = gVal;
    }
    if (name && dg && /^\d+$/.test(String(row[0]).trim())) {
      employees.push({
        name, designation: dg,
        monthlyTarget: cleanNum(row[3]), targetADS: cleanNum(row[4]),
        salesTillDate: cleanNum(row[5]), presentADS: cleanNum(row[6]),
        achivPct: cleanNum(row[7]), logicalSales: cleanNum(row[8]),
        logicalAchivPct: cleanNum(row[9]), salesTrend: cleanNum(row[10]),
        remainingSales: cleanNum(row[11]), rads: cleanNum(row[12])
      });
    }
  });
  return { employees, glance };
}

async function getDaywise() {
  const text = await fetchCsv(`https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=${GID_DAYWISE}`);
  const rows = parseCsv(text);
  const header = rows[1];
  const armclRow = rows.find(r => String(r[0]).includes('ARMCL'));
  if (!armclRow) return { days: [], target: 1230000, total: 0 };
  const target = cleanNum(String(armclRow[1]).replace(/[^0-9.]/g, '')) || 1230000;
  const days = [];
  // Day columns: c2-c13 = day 1-12 (header has date), c14-c23 = day 13-22 (merged/blank header)
  let dayNum = 0;
  for (let i = 2; i <= 23 && i < armclRow.length; i++) {
    dayNum++;
    const h = String(header[i] || '').trim();
    let dd, mm;
    if (/^\d{2}-\d{2}-\d{4}$/.test(h)) {
      const [d, m] = h.split('-');
      dd = d; mm = m;
    } else {
      dd = String(dayNum).padStart(2, '0'); mm = String(curMonth).padStart(2, '0');
    }
    const key = `${curYear}-${mm}-${dd}`;
    const v = cleanNum(armclRow[i]);
    days.push({ date: key, qty: v });
  }
  const withSales = days.filter(d => d.qty > 0);
  return { days, target, total: withSales.reduce((s, x) => s + x.qty, 0) };
}

function num(v) { return (v === null || v === undefined || isNaN(v)) ? 0 : Number(v); }
function round(v, d) { const f = Math.pow(10, d || 0); return Math.round(num(v) * f) / f; }

async function buildControlTower() {
  const db = await getPool();
  const monthStart = `${curYear}-${String(curMonth).padStart(2, '0')}-01`;

  // ---- Authoritative CFT tracker from the official Google Sheet ----
  const report = await getTargetReport();
  const daywise = await getDaywise();
  const g = report.glance;
  const mtdTarget = cleanNum(g['Monthly Target']) || 1230000;
  const salesTillDate = cleanNum(g['Sales Till Date']);
  const achPct = cleanNum(g['Achiv % till date']);
  const logicalSales = cleanNum(g['Logical Sales till date']);
  const logicalAchPct = cleanNum(g['Logical Achiv % till date']);
  const targetADS = cleanNum(g['Target ADS']);
  const presentADS = cleanNum(g['Present ADS']);
  const rads = cleanNum(g['RADS']);
  const salesTrend = cleanNum(g['Sales Trend']);
  const remainingSales = cleanNum(g['Remaining Sales']);
  const daysConsumed = cleanNum(g["Day's consumed"]);
  const daysRemaining = cleanNum(g['Days Remaining']);
  const workDays = daysConsumed || daywise.days.length;

  // ---- DWH breakdown panels (CFT volume) ----
  const byPlant = await db.request()
    .input('unit', sql.Int, UNIT).input('from', sql.Date, monthStart)
    .query(`SELECT strPlantName name, SUM(numTotalDeliveryQuantity) qty
            FROM sms.tblDeliveryHeaderArc
            WHERE intBusinessUnitId=@unit AND dteDeliveryDate>=@from
            GROUP BY strPlantName ORDER BY qty DESC`);

  const byOffice = await db.request()
    .input('unit', sql.Int, UNIT).input('from', sql.Date, monthStart)
    .query(`SELECT strSalesOfficeName name, SUM(numNetOrderValue) value, COUNT(*) orders
            FROM oms.tblSalesOrderHeaderArc
            WHERE intBusinessUnitId=@unit AND isActive=1 AND dteSalesOrderDate>=@from
            GROUP BY strSalesOfficeName ORDER BY value DESC`);

  const gradeMix = await db.request()
    .input('unit', sql.Int, UNIT).input('from', sql.Date, monthStart)
    .query(`SELECT TOP 12 r.strItemName item, SUM(r.numOrderQuantity) qty
            FROM oms.tblSalesOrderRowArc r
            JOIN oms.tblSalesOrderHeaderArc h ON r.intSalesOrderId=h.intSalesOrderId
            WHERE r.intBusinessUnitId=@unit AND h.isActive=1 AND h.dteSalesOrderDate>=@from
            GROUP BY r.strItemName ORDER BY qty DESC`);

  const drivers = await db.request()
    .input('unit', sql.Int, UNIT).input('from', sql.Date, monthStart)
    .query(`SELECT COUNT(DISTINCT intSoldToPartnerId) active, COUNT(*) orders
            FROM oms.tblSalesOrderHeaderArc
            WHERE intBusinessUnitId=@unit AND isActive=1 AND dteSalesOrderDate>=@from`);

  const coverage = await db.request()
    .input('unit', sql.Int, UNIT).input('from', sql.Date, monthStart)
    .query(`SELECT
              (SELECT COUNT(*) FROM prt.tblBusinessPartnerArc WHERE intBusinessUnitId=@unit AND isActive=1) universe,
              (SELECT COUNT(DISTINCT intSoldToPartnerId) FROM oms.tblSalesOrderHeaderArc
               WHERE intBusinessUnitId=@unit AND isActive=1 AND dteSalesOrderDate>=@from) active`);

  const force = await db.request()
    .input('unit', sql.Int, UNIT).input('from', sql.Date, monthStart)
    .query(`SELECT strSalesForceEmpName name, COUNT(*) orders
            FROM oms.tblSalesOrderHeaderArc
            WHERE intBusinessUnitId=@unit AND isActive=1 AND dteSalesOrderDate>=@from
              AND strSalesForceEmpName IS NOT NULL AND strSalesForceEmpName<>''
            GROUP BY strSalesForceEmpName ORDER BY orders DESC`);

  const overdue = await db.request()
    .input('unit', sql.Int, UNIT).input('cut', sql.Date, new Date(Date.now() - 60 * 864e5))
    .query(`SELECT TOP 10 strSoldToPartnerName name, SUM(numTotalNetValue) value
            FROM sms.tblDeliveryHeaderArc
            WHERE intBusinessUnitId=@unit AND isCommercialInvoice=1 AND dteDeliveryDate<@cut
            GROUP BY strSoldToPartnerName ORDER BY value DESC`);

  const collection = await db.request()
    .input('unit', sql.Int, UNIT).input('from', sql.Date, monthStart)
    .query(`SELECT SUM(numAmount) collected, COUNT(*) txns
            FROM fin.tblAccountingJournalArc
            WHERE intBusinessUnitId=@unit AND isActive=1 AND numAmount>0
              AND dteTransactionDate>=@from
              AND strGeneralLedgerName LIKE '%Trade Receivable%'`);

  // ---- Order book / lifting (CFT) ----
  const orderBook = await db.request()
    .input('unit', sql.Int, UNIT)
    .query(`SELECT COALESCE(SUM(r.numOrderQuantity),0) order_qty,
                   COALESCE(SUM(r.numDeliveredQuantity),0) delivered_qty
            FROM oms.tblSalesOrderRowArc r
            JOIN oms.tblSalesOrderHeaderArc h ON r.intSalesOrderId=h.intSalesOrderId
            WHERE r.intBusinessUnitId=@unit AND h.isActive=1 AND h.isApproved=1 AND h.isRejected=0 AND h.isCompleted=0`);
  const orderQty = num(orderBook.recordset[0].order_qty);
  const deliveredQty = num(orderBook.recordset[0].delivered_qty);
  const liftingPct = orderQty > 0 ? deliveredQty / orderQty * 100 : 0;

  const activeCust = num(drivers.recordset[0].active);
  const totalOrders = num(drivers.recordset[0].orders);
  const freq = activeCust > 0 ? totalOrders / activeCust : 0;
  const universe = num(coverage.recordset[0].universe);
  const covPct = universe > 0 ? activeCust / universe * 100 : 0;
  const collectedV = num(collection.recordset[0].collected);
  const collectionPct = salesTillDate > 0 ? collectedV / (salesTillDate * 0) : 0; // placeholder, replaced below

  // Collection % against sales value (use sales value from DWH orders for value basis)
  const mtdSalesValue = await db.request()
    .input('unit', sql.Int, UNIT).input('from', sql.Date, monthStart)
    .query(`SELECT SUM(numNetOrderValue) v FROM oms.tblSalesOrderHeaderArc
            WHERE intBusinessUnitId=@unit AND isActive=1 AND dteSalesOrderDate>=@from`);
  const salesValue = num(mtdSalesValue.recordset[0].v);
  const collVsValue = salesValue > 0 ? collectedV / salesValue * 100 : 0;

  const rag = (v, amber, red) => v >= amber ? 'green' : v >= red ? 'amber' : 'red';

  return {
    meta: {
      unit: UNIT, name: 'Akij Ready Mix Concrete Ltd (ARMCL)',
      period: `${monthStart} to ${new Date().toISOString().slice(0,10)}`,
      source: 'Official Target Achievement Sheet (CFT) + DWH (iBOS ERP archive)',
      unit_label: 'CFT'
    },
    kpi_cards: [
      { key: 'mtd_target', label: 'Monthly Target', value: mtdTarget, fmt: 'num', unit: ' CFT' },
      { key: 'sales_till_date', label: 'Sales Till Date', value: salesTillDate, fmt: 'num', unit: ' CFT', rag: rag(achPct, 95, 80) },
      { key: 'ach', label: 'Achievement %', value: round(achPct, 0), fmt: 'pct', rag: rag(achPct, 95, 80) },
      { key: 'logical_sales', label: 'Logical Sales', value: logicalSales, fmt: 'num', unit: ' CFT' },
      { key: 'logical_ach', label: 'Logical Achiv %', value: round(logicalAchPct, 0), fmt: 'pct', rag: rag(logicalAchPct, 95, 80) },
      { key: 'sales_trend', label: 'Sales Trend', value: salesTrend, fmt: 'num', unit: ' CFT' },
      { key: 'remaining', label: 'Remaining Sales', value: remainingSales, fmt: 'num', unit: ' CFT' },
      { key: 'rads', label: 'RADS (CFT/day)', value: round(rads, 0), fmt: 'num', rag: rads >= targetADS ? 'green' : rads >= targetADS * 0.85 ? 'amber' : 'red' },
      { key: 'target_ads', label: 'Target ADS', value: round(targetADS, 0), fmt: 'num' },
      { key: 'present_ads', label: 'Present ADS', value: round(presentADS, 0), fmt: 'num' },
      { key: 'collection', label: 'Collection vs Value', value: round(collVsValue, 1), fmt: 'pct', rag: rag(collVsValue, 80, 60) },
      { key: 'active', label: 'Active Customers', value: activeCust, fmt: 'num' }
    ],
    panels: {
      p1: {
        target: mtdTarget, actual: salesTillDate, achPct: round(achPct, 0),
        logical: logicalSales, logicalAchPct: round(logicalAchPct, 0),
        gap: remainingSales, daysConsumed, daysRemaining, targetADS, presentADS, rads,
        employees: report.employees
      },
      p2: {
        workDays, daysRemaining,
        daily: daywise.days.map(d => ({ date: d.date, qty: d.qty })),
        total: daywise.total, target: daywise.target
      },
      p4: { orderQty, deliveredQty, liftingPct: round(liftingPct, 1) },
      p5: { activeCustomers: activeCust, totalOrders, frequency: round(freq, 2), gradeMix: gradeMix.recordset.map(r => ({ item: r.item, qty: num(r.qty) })) },
      p6: {
        byPlant: byPlant.recordset.map(r => ({ name: r.name, qty: num(r.qty) })),
        byOffice: byOffice.recordset.map(r => ({ name: r.name, value: num(r.value), orders: r.orders }))
      },
      p8: { force: force.recordset.map(r => ({ name: r.name, orders: r.orders })), limitation: 'Only orders with strSalesForceEmpName populated are shown' },
      p9: { universe, active: activeCust, coveragePct: round(covPct, 1) },
      p10: { overdue: overdue.recordset.map(r => ({ name: r.name, value: num(r.value) })) },
      p11: { salesValue, collected: collectedV, collectionPct: round(collVsValue, 1), source: 'fin.tblAccountingJournalArc (Trade Receivable) vs MTD Sales value' }
    },
    guardrails: {
      sales: rag(achPct, 95, 80),
      cash: rag(collVsValue, 80, 60),
      credit: collVsValue < 60 ? 'red' : collVsValue < 80 ? 'amber' : 'green',
      service: liftingPct >= 80 ? 'green' : liftingPct >= 60 ? 'amber' : 'red',
      coverage: covPct >= 50 ? 'green' : covPct >= 30 ? 'amber' : 'red',
      overall: achPct >= 80 ? 'green' : achPct >= 60 ? 'amber' : 'red'
    }
  };
}

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/sms-tower', async (req, res) => {
  try {
    res.json(await buildControlTower());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/sms-control-tower', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'sms-control-tower.html'));
});

module.exports = app;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`SMS Control Tower: http://localhost:${PORT}/sms-control-tower`);
    console.log(`API: http://localhost:${PORT}/api/sms-tower`);
  });
}
