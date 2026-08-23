const sql = require('mssql');
const https = require('https');
const fs = require('fs');
const path = require('path');

const UNIT = 175;

// ---------- iBOS ERP (DWH) ----------
const cfg = { server: '203.202.241.211', port: 1433, user: 'mcp_user', password: 'iAOS@35o997', database: 'DWH', options: { trustServerCertificate: true, encrypt: false }, requestTimeout: 90000 };
function num(v) { return (v === null || v === undefined || isNaN(v)) ? 0 : Number(v); }
function round(v, d) { const f = Math.pow(10, d || 0); return Math.round(num(v) * f) / f; }

// ---------- Official Google Sheet (CFT tracker) ----------
function fetchCsv(url) {
  return new Promise((res, rej) => { https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (r) => { let d = ''; r.on('data', c => d += c); r.on('end', () => res(d)); }).on('error', rej); });
}
function parseCsv(text) {
  const rows = []; let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; } else field += c; }
    else { if (c === '"') inQ = true; else if (c === ',') { row.push(field); field = ''; } else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; } else if (c === '\r') {} else field += c; }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}
function cleanNum(s) { return parseFloat(String(s).replace(/[^0-9.\-]/g, '')) || 0; }

async function getOfficialTracker() {
  const text = await fetchCsv('https://docs.google.com/spreadsheets/d/1vPlcijsZkj4p6ZHmzg7jEAutNrW5l2YKlbNUtgXkNbI/gviz/tq?tqx=out:csv&gid=990537426');
  const rows = parseCsv(text);
  const employees = [], glance = {};
  rows.forEach((row, i) => {
    if (i < 3) return;
    const name = String(row[1] || '').trim(), dg = String(row[2] || '').trim();
    const gKey = String(row[15] || '').trim();
    if (gKey && i >= 5) { const gVal = String(row[16] || '').trim(); if (gVal) glance[gKey] = gVal; }
    if (name && dg && /^\d+$/.test(String(row[0]).trim())) {
      employees.push({ name, designation: dg, monthlyTarget: cleanNum(row[3]), targetADS: cleanNum(row[4]), salesTillDate: cleanNum(row[5]), presentADS: cleanNum(row[6]), achivPct: cleanNum(row[7]), logicalSales: cleanNum(row[8]), logicalAchivPct: cleanNum(row[9]), salesTrend: cleanNum(row[10]), remainingSales: cleanNum(row[11]), rads: cleanNum(row[12]) });
    }
  });
  return { employees, glance };
}

async function main() {
  const db = await sql.connect(cfg);
  const F = '2026-08-01', T = '2026-08-31';

  // Official tracker
  const official = await getOfficialTracker();
  const g = official.glance;
  const mtdTarget = cleanNum(g['Monthly Target']) || 1230000;
  const salesTillDate = cleanNum(g['Sales Till Date']);
  const achPct = cleanNum(g['Achiv % till date']);
  const logicalSales = cleanNum(g['Logical Sales till date']);
  const logicalAchPct = cleanNum(g['Logical Achiv % till date']);
  const rads = cleanNum(g['RADS']);
  const targetADS = cleanNum(g['Target ADS']);
  const presentADS = cleanNum(g['Present ADS']);
  const salesTrend = cleanNum(g['Sales Trend']);
  const remaining = cleanNum(g['Remaining Sales']);
  const daysConsumed = cleanNum(g["Day's consumed"]);
  const daysRemaining = cleanNum(g['Days Remaining']);

  // iBOS ERP (DWH)
  const [orders, inv, del, coll, byPlant, gradeMix, force, cov, ob, daily] = await Promise.all([
    db.request().input('u', sql.Int, UNIT).input('f', sql.Date, F).input('t', sql.Date, T).query(`SELECT COUNT(*) n, SUM(numNetOrderValue) v FROM oms.tblSalesOrderHeaderArc WHERE intBusinessUnitId=@u AND isActive=1 AND isRejected=0 AND dteSalesOrderDate>=@f AND dteSalesOrderDate<=@t`),
    db.request().input('u', sql.Int, UNIT).input('f', sql.Date, F).input('t', sql.Date, T).query(`SELECT COUNT(DISTINCT intSalesInvoiceId) n, SUM(numQuantity) q FROM oms.tblSalesInvoiceArc WHERE intUnitID=@u AND isActive=1 AND dteInvoiceDate>=@f AND dteInvoiceDate<=@t`),
    db.request().input('u', sql.Int, UNIT).input('f', sql.Date, F).input('t', sql.Date, T).query(`SELECT COUNT(*) n, SUM(numTotalDeliveryQuantity) q, SUM(numTotalNetValue) v FROM sms.tblDeliveryHeaderArc WHERE intBusinessUnitId=@u AND dteDeliveryDate>=@f AND dteDeliveryDate<=@t`),
    db.request().input('u', sql.Int, UNIT).input('f', sql.Date, F).input('t', sql.Date, T).query(`SELECT SUM(numAmount) v FROM fin.tblAccountingJournalArc WHERE intBusinessUnitId=@u AND isActive=1 AND numAmount>0 AND dteTransactionDate>=@f AND dteTransactionDate<=@t AND strGeneralLedgerName LIKE '%Trade Receivable%'`),
    db.request().input('u', sql.Int, UNIT).input('f', sql.Date, F).input('t', sql.Date, T).query(`SELECT strPlantName name, SUM(numTotalDeliveryQuantity) q, SUM(numTotalNetValue) v FROM sms.tblDeliveryHeaderArc WHERE intBusinessUnitId=@u AND dteDeliveryDate>=@f AND dteDeliveryDate<=@t GROUP BY strPlantName ORDER BY q DESC`),
    db.request().input('u', sql.Int, UNIT).input('f', sql.Date, F).input('t', sql.Date, T).query(`SELECT TOP 12 r.strItemName item, SUM(r.numOrderQuantity) q FROM oms.tblSalesOrderRowArc r JOIN oms.tblSalesOrderHeaderArc h ON r.intSalesOrderId=h.intSalesOrderId WHERE r.intBusinessUnitId=@u AND h.isActive=1 AND h.dteSalesOrderDate>=@f AND h.dteSalesOrderDate<=@t GROUP BY r.strItemName ORDER BY q DESC`),
    db.request().input('u', sql.Int, UNIT).input('f', sql.Date, F).input('t', sql.Date, T).query(`SELECT strSoldByName name, COUNT(*) txn, SUM(numQuantity) q FROM oms.tblSalesInvoiceArc WHERE intUnitID=@u AND isActive=1 AND dteInvoiceDate>=@f AND dteInvoiceDate<=@t AND strSoldByName IS NOT NULL AND strSoldByName<>'' GROUP BY strSoldByName ORDER BY q DESC`),
    db.request().input('u', sql.Int, UNIT).input('f', sql.Date, F).input('t', sql.Date, T).query(`SELECT (SELECT COUNT(*) FROM prt.tblBusinessPartnerArc WHERE intBusinessUnitId=@u AND isActive=1) universe, (SELECT COUNT(DISTINCT intSoldToPartnerId) FROM oms.tblSalesOrderHeaderArc WHERE intBusinessUnitId=@u AND isActive=1 AND dteSalesOrderDate>=@f AND dteSalesOrderDate<=@t) active`),
    db.request().input('u', sql.Int, UNIT).query(`SELECT COALESCE(SUM(numOrderQuantity),0) oq, COALESCE(SUM(numDeliveredQuantity),0) dq FROM oms.tblSalesOrderRowArc r JOIN oms.tblSalesOrderHeaderArc h ON r.intSalesOrderId=h.intSalesOrderId WHERE r.intBusinessUnitId=@u AND h.isActive=1 AND h.isApproved=1 AND h.isRejected=0 AND h.isCompleted=0`),
    db.request().input('u', sql.Int, UNIT).input('f', sql.Date, F).input('t', sql.Date, T).query(`SELECT CAST(dteDeliveryDate AS date) dt, SUM(numTotalDeliveryQuantity) q FROM sms.tblDeliveryHeaderArc WHERE intBusinessUnitId=@u AND dteDeliveryDate>=@f AND dteDeliveryDate<=@t GROUP BY CAST(dteDeliveryDate AS date) ORDER BY dt`)
  ]);

  const ordVal = num(orders.recordset[0].v);
  const ordCnt = num(orders.recordset[0].n);
  const invQty = num(inv.recordset[0].q);
  const delQty = num(del.recordset[0].q);
  const delVal = num(del.recordset[0].v);
  const collected = num(coll.recordset[0].v);
  const active = num(cov.recordset[0].active);
  const universe = num(cov.recordset[0].universe);
  const orderQty = num(ob.recordset[0].oq);
  const deliveredQty = num(ob.recordset[0].dq);

  const data = {
    meta: {
      title: 'ARMCL SMS Control Tower — August 2026',
      company: 'Akij Ready Mix Concrete Ltd (ARMCL)',
      source: 'iBOS ERP (DWH) + Official Target Achievement Sheet (Google)',
      period: 'August 1–31, 2026',
      collected: new Date().toISOString(),
      targetSource: 'Official Google Sheet (CFT) · gid 990537426',
      ibosSource: 'iBOS ERP archive (DWH) · ARMCL = BU 175'
    },
    official: {
      monthlyTarget: mtdTarget,
      salesTillDate: salesTillDate,
      achivPct: achPct,
      logicalSales: logicalSales,
      logicalAchivPct: logicalAchPct,
      rads: rads,
      targetADS: targetADS,
      presentADS: presentADS,
      salesTrend: salesTrend,
      remainingSales: remaining,
      daysConsumed: daysConsumed,
      daysRemaining: daysRemaining,
      employees: official.employees
    },
    kpi: {
      salesOrders: ordCnt,
      salesOrderValue: round(ordVal, 0),
      avgOrderValue: round(ordCnt > 0 ? ordVal / ordCnt : 0, 0),
      invoices: num(inv.recordset[0].n),
      invoiceQty: round(invQty, 0),
      deliveries: num(del.recordset[0].n),
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
      gradeCount: gradeMix.recordset.length,
      plantCount: byPlant.recordset.length,
      salesForce: force.recordset.length
    },
    daily: daily.recordset.map(r => ({ date: r.dt.toISOString().slice(0, 10), qty: num(r.q) })),
    byPlant: byPlant.recordset.map(r => ({ name: r.name, qty: num(r.q), value: num(r.v) })),
    gradeMix: gradeMix.recordset.map(r => ({ item: r.item, qty: num(r.q) })),
    salesForce: force.recordset.map(r => ({ name: r.name, txns: r.txn, qty: num(r.q) }))
  };

  fs.writeFileSync(path.join(__dirname, 'sms-control-tower', 'ibos-august-2026.json'), JSON.stringify(data, null, 2), 'utf8');
  console.log('Merged data written: sms-control-tower/ibos-august-2026.json');
  console.log('Official: target', mtdTarget, '| sales', salesTillDate, '| ach', achPct + '%', '| RADS', rads);
  console.log('iBOS: orders', ordCnt, '| delivery', delQty, 'CFT | collection', collected, '(', Math.round(collected / delVal * 1000) / 10, '%)');
  await db.close();
}

main().catch(e => { console.error('ERR', e.message); process.exit(1); });
