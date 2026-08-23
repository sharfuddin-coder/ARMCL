const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const https = require('https');
const sql = require('mssql');
require('dotenv').config();

const APP_PORT = process.env.APP_PORT || 3000;
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '1vPlcijsZkj4p6ZHmzg7jEAutNrW5l2YKlbNUtgXkNbI';
const GID = process.env.SHEET_GID || '990537426';
const DAYWISE_GID = '2096727161';

const dbConfig = {
  server: process.env.DB_SERVER || '203.202.241.211',
  port: parseInt(process.env.DB_PORT || '1433'),
  database: process.env.DB_NAME || 'DWH',
  user: process.env.DB_USER || '',
  password: process.env.DB_PASSWORD || '',
  options: { encrypt: false, trustServerCertificate: true }
};

let dbPool = null;
async function getDb() {
  if (!dbPool) dbPool = await sql.connect(dbConfig);
  return dbPool;
}

function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c === '\r') {}
      else field += c;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function fetchSheet(gid) {
  return new Promise((resolve, reject) => {
    const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&gid=${gid}`;
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (r) => {
      let d = '';
      r.on('data', (c) => d += c);
      r.on('end', () => resolve(parseCSV(d)));
    }).on('error', reject);
  });
}

function cleanNum(v) { return parseFloat(String(v).replace(/[^0-9.\-]/g, '')) || 0; }
function cleanPct(v) { return parseFloat(String(v).replace(/[^0-9.\-]/g, '')) || 0; }

async function getReport() {
  const rows = await fetchSheet(GID);
  const employees = [];
  const glance = {};
  rows.forEach((row, i) => {
    if (i < 3) return;
    const name = String(row[1] || '').trim();
    const dg = String(row[2] || '').trim();
    const gKey = String(row[15] || '').trim();
    if (gKey) {
      const gVal = String(row[16] || '').trim();
      if (gVal) glance[gKey] = gVal;
      else if (gKey === 'SBU') glance[gKey] = 'SBU';
    }
    if (name && dg && /^\d+$/.test(String(row[0]).trim())) {
      employees.push({
        id: parseInt(row[0]) || 0, name, designation: dg,
        monthlyTarget: cleanNum(row[3]), targetADS: cleanNum(row[4]),
        salesTillDate: cleanNum(row[5]), presentADS: cleanNum(row[6]),
        achivPct: cleanPct(row[7]), logicalSales: cleanNum(row[8]),
        logicalAchivPct: cleanPct(row[9]), salesTrend: cleanNum(row[10]),
        remainingSales: cleanNum(row[11]), rads: cleanNum(row[12])
      });
    }
  });
  return { employees, glance };
}

function computeDashboard(report) {
  const emps = report.employees;
  const stats = {
    monthlyTarget: cleanNum(report.glance['Monthly Target']) || emps.reduce((s, e) => s + e.monthlyTarget, 0),
    salesTillDate: cleanNum(report.glance['Sales Till Date']) || emps.reduce((s, e) => s + e.salesTillDate, 0),
    salesTrend: cleanNum(report.glance['Sales Trend']) || emps.reduce((s, e) => s + e.salesTrend, 0),
    remainingSales: cleanNum(report.glance['Remaining Sales']) || emps.reduce((s, e) => s + e.remainingSales, 0),
    achivPct: cleanPct(report.glance['Achiv % till date']),
    logicalSales: cleanNum(report.glance['Logical Sales till date']),
    logicalAchivPct: cleanPct(report.glance['Logical Achiv % till date']),
    presentADS: cleanNum(report.glance['Present ADS']),
    targetADS: cleanNum(report.glance['Target ADS']),
    daysConsumed: cleanNum(report.glance["Day's consumed"]),
    daysRemaining: cleanNum(report.glance['Days Remaining']),
    rads: cleanNum(report.glance['RADS']), employees: emps.length
  };
  const sortedBySales = [...emps].sort((a, b) => b.salesTillDate - a.salesTillDate);
  const topPerformers = sortedBySales.slice(0, 5);
  const desigAgg = {};
  emps.forEach(e => {
    if (!desigAgg[e.designation]) desigAgg[e.designation] = { count: 0, salesTillDate: 0, monthlyTarget: 0 };
    desigAgg[e.designation].count++;
    desigAgg[e.designation].salesTillDate += e.salesTillDate;
    desigAgg[e.designation].monthlyTarget += e.monthlyTarget;
  });
  const byDesignation = Object.entries(desigAgg).map(([des, v]) => ({
    designation: des, ...v,
    achivPct: v.monthlyTarget > 0 ? Math.round((v.salesTillDate / v.monthlyTarget) * 100) : 0
  }));
  return { stats, topPerformers, byDesignation };
}

async function getArmclDaywiseSales() {
  const db = await getDb();
  const daily = await db.request()
    .input('year', sql.Int, 2026)
    .input('month', sql.Int, 8)
    .input('unitId', sql.Int, 175)
    .query(`
      SELECT CAST(si.dteInvoiceDate AS DATE) AS SaleDate,
             COUNT(*) AS InvoiceCount,
             SUM(si.numQuantity) AS DailyQuantity
      FROM oms.tblSalesInvoiceArc si
      WHERE si.intUnitID = @unitId
        AND YEAR(si.dteInvoiceDate) = @year
        AND MONTH(si.dteInvoiceDate) = @month
      GROUP BY CAST(si.dteInvoiceDate AS DATE)
      ORDER BY SaleDate
    `);

  const summary = await db.request()
    .input('year', sql.Int, 2026)
    .input('month', sql.Int, 8)
    .input('unitId', sql.Int, 175)
    .query(`
      SELECT COUNT(*) AS TotalInvoices, SUM(si.numQuantity) AS TotalQuantity,
             MIN(CAST(si.dteInvoiceDate AS DATE)) AS FirstDate,
             MAX(CAST(si.dteInvoiceDate AS DATE)) AS LastDate
      FROM oms.tblSalesInvoiceArc si
      WHERE si.intUnitID = @unitId
        AND YEAR(si.dteInvoiceDate) = @year
        AND MONTH(si.dteInvoiceDate) = @month
    `);

  const topPersons = await db.request()
    .input('year', sql.Int, 2026)
    .input('month', sql.Int, 8)
    .input('unitId', sql.Int, 175)
    .query(`
      SELECT TOP 10 si.strSoldByName AS SalesPerson,
             COUNT(*) AS Transactions, SUM(si.numQuantity) AS TotalSales
      FROM oms.tblSalesInvoiceArc si
      WHERE si.intUnitID = @unitId
        AND YEAR(si.dteInvoiceDate) = @year
        AND MONTH(si.dteInvoiceDate) = @month
        AND si.strSoldByName IS NOT NULL AND si.strSoldByName <> ''
      GROUP BY si.strSoldByName
      ORDER BY TotalSales DESC
    `);

  const target = 1230000;
  const totalQty = summary.recordset[0].TotalQuantity || 0;
  const totalTxns = summary.recordset[0].TotalInvoices || 0;
  const firstDate = summary.recordset[0].FirstDate;
  const lastDate = summary.recordset[0].LastDate;

  const days = [];
  const start = new Date('2026-08-01');
  const end = new Date('2026-08-31');
  const dailyMap = {};
  daily.recordset.forEach(r => {
    const key = r.SaleDate.toISOString().split('T')[0];
    dailyMap[key] = { count: r.InvoiceCount, qty: r.DailyQuantity };
  });

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().split('T')[0];
    const m = dailyMap[key];
    days.push({
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      fullDate: key,
      count: m ? m.count : 0,
      qty: m ? m.qty : 0
    });
  }

  const activeDays = days.filter(d => d.qty > 0).length;
  const dailyAvg = activeDays > 0 ? totalQty / activeDays : 0;
  const dailyTarget = target / 31;
  const achivPct = target > 0 ? (totalQty / target * 100) : 0;

  const persons = topPersons.recordset.map((p, i) => ({
    name: p.SalesPerson,
    txns: p.Transactions,
    sales: p.TotalSales,
    rank: i + 1,
    share: totalQty > 0 ? (p.TotalSales / totalQty * 100) : 0,
    avg: p.Transactions > 0 ? p.TotalSales / p.Transactions : 0
  }));

  return {
    target, totalSales: totalQty, totalTxns,
    firstDate: firstDate ? firstDate.toISOString().split('T')[0] : null,
    lastDate: lastDate ? lastDate.toISOString().split('T')[0] : null,
    dailyAvg, dailyTarget, achivPct, activeDays, totalDays: 31,
    days, persons, salesPersons: persons.length
  };
}

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// SMS Control Tower (mounted for Vercel single-app deployment)
app.use(require('./sms-tower'));
// iBOS ERP Live SMS Control Tower
app.use(require('./sms-tower-ibos'));

app.get('/api/report', async (req, res) => {
  try { res.json(await getReport()); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/dashboard', async (req, res) => {
  try { res.json(computeDashboard(await getReport())); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/armcl-sales-collection-august-2026', (req, res) => {
  res.json(JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'armcl-sales-collection-august-2026.json'), 'utf8')));
});

app.get('/armcl-august-sales-coll', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'armcl-august-sales-coll.html'));
});

app.get('/api/armcl-sales-collection-july-2026', (req, res) => {
  res.json(JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'armcl-sales-collection-july-2026.json'), 'utf8')));
});

app.get('/armcl-july', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'armcl-sales-coll.html'));
});

app.get('/api/absl-asphalt-august-2026', (req, res) => {
  res.json(JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'absl-asphalt-august-2026.json'), 'utf8')));
});

app.get('/absl-asphalt', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'absl-asphalt.html'));
});

app.get('/api/armcl-august-2026', async (req, res) => {
  try {
    const data = await getArmclDaywiseSales();
    res.json({
      totalSales: data.totalSales,
      totalTxns: data.totalTxns,
      salesPersons: data.salesPersons,
      daily: data.days.filter(d => d.qty > 0).map(d => ({ date: d.fullDate, total: d.qty, count: d.count })),
      persons: data.persons
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/armcl-august', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'armcl-august.html'));
});

app.get('/armcl-august-target-achievement', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'armcl-august-target-achievement.html'));
});

app.get('/armcl-dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'armcl-dashboard.html'));
});

app.get('/api/armcl-dashboard', async (req, res) => {
  try { res.json(await getArmclDaywiseSales()); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/person-sales', async (req, res) => {
  try { res.json(await getReport()); } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/budget-dashboard', async (req, res) => {
  try {
    const report = await getReport();
    const emps = report.employees;
    const totalTarget = emps.reduce((s, e) => s + e.monthlyTarget, 0);
    const totalSales = emps.reduce((s, e) => s + e.salesTillDate, 0);
    const totalAchiv = totalTarget > 0 ? (totalSales / totalTarget) * 100 : 0;
    const logicalSales = report.glance['Logical Sales till date'] ? cleanNum(report.glance['Logical Sales till date']) : totalSales;
    const logicalAchiv = totalTarget > 0 ? (logicalSales / totalTarget) * 100 : 0;
    const remaining = totalTarget - totalSales;
    const rads = report.glance['RADS'] ? cleanNum(report.glance['RADS']) : (remaining / 13);
    res.json({
      totalTarget,
      totalSales,
      achievementPct: Math.round(totalAchiv),
      logicalAchivPct: Math.round(logicalAchiv),
      remainingSales: remaining,
      rads: Math.round(rads),
      employees: emps.length
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/daywise-sales-aug26', async (req, res) => {
  try {
    const rows = await fetchSheet(DAYWISE_GID);
    const dates = [];
    for (let i = 2; i <= 32; i++) dates.push(String(rows[1][i] || '').trim());
    function parseRow(row) { const v = []; for (let i = 2; i <= 32; i++) v.push(cleanNum(row[i])); return v; }
    const armclVals = parseRow(rows[2]), abslVals = parseRow(rows[3]);
    res.json({
      armcl: { target: cleanNum(String(rows[2][1] || '').replace(/[^0-9.]/g, '')), total: armclVals.reduce((s, d) => s + d, 0), days: dates.map((d, i) => ({ date: d, val: armclVals[i] })) },
      absl: { target: cleanNum(String(rows[3][1] || '').replace(/[^0-9.]/g, '')), total: abslVals.reduce((s, d) => s + d, 0), days: dates.map((d, i) => ({ date: d, val: abslVals[i] })) }
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/daywise-sales', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'daywise-sales.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

module.exports = app;

if (require.main === module) {
  app.listen(APP_PORT, () => {
    console.log(`Dashboard: http://localhost:${APP_PORT}`);
  });
}
