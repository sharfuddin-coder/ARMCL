const XLSX = require('xlsx');
const fs = require('fs');

const data = JSON.parse(fs.readFileSync('sms-control-tower/ibos-august-2026.json', 'utf8'));
const k = data.kpi;

const wb = XLSX.utils.book_new();

// ---------- Sheet 1: KPI Summary ----------
const kpiRows = [
  ['KPI', 'Value', 'Unit'],
  ['Sales Orders', k.salesOrders, 'count'],
  ['Sales Order Value', k.salesOrderValue, 'BDT'],
  ['Avg Order Value', k.avgOrderValue, 'BDT'],
  ['Invoices', k.invoices, 'count'],
  ['Invoice Qty', k.invoiceQty, 'CFT'],
  ['Deliveries', k.deliveries, 'count'],
  ['Delivery Qty', k.deliveryQty, 'CFT'],
  ['Delivery Value', k.deliveryValue, 'BDT'],
  ['Collection', k.collection, 'BDT'],
  ['Collection %', k.collectionPct, '%'],
  ['Lifting %', k.liftingPct, '%'],
  ['Active Customers', k.activeCustomers, 'count'],
  ['Customer Universe', k.universe, 'count'],
  ['Coverage %', k.coveragePct, '%'],
  ['Order Qty (open book)', k.orderQty, 'CFT'],
  ['Delivered Qty (open book)', k.deliveredQty, 'CFT'],
  ['Product Grades', k.gradeCount, 'count'],
  ['Plants', k.plantCount, 'count'],
  ['Sales Force', k.salesForce, 'count'],
  ['Delivery Days', data.daily.length, 'count'],
];
const wsKpi = XLSX.utils.aoa_to_sheet(kpiRows);
wsKpi['!cols'] = [{ wch: 28 }, { wch: 18 }, { wch: 8 }];
XLSX.utils.book_append_sheet(wb, wsKpi, 'KPI Summary');

// ---------- Sheet 2: Daily Delivery ----------
const dailyRows = [['Date', 'Delivery Qty (CFT)']];
data.daily.forEach(d => dailyRows.push([d.date, d.qty]));
const wsDaily = XLSX.utils.aoa_to_sheet(dailyRows);
wsDaily['!cols'] = [{ wch: 14 }, { wch: 20 }];
XLSX.utils.book_append_sheet(wb, wsDaily, 'Daily Delivery');

// ---------- Sheet 3: Plant-wise ----------
const plantRows = [['Plant', 'Delivery Qty (CFT)', 'Delivery Value (BDT)']];
data.byPlant.forEach(p => plantRows.push([String(p.name).trim(), p.qty, p.value]));
const wsPlant = XLSX.utils.aoa_to_sheet(plantRows);
wsPlant['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 18 }];
XLSX.utils.book_append_sheet(wb, wsPlant, 'Plant-wise');

// ---------- Sheet 4: Grade Mix ----------
const gradeRows = [['Product / Grade', 'Qty (CFT)', 'Value (BDT)']];
data.gradeMix.forEach(g => gradeRows.push([g.item, g.qty, g.value]));
const wsGrade = XLSX.utils.aoa_to_sheet(gradeRows);
wsGrade['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 18 }];
XLSX.utils.book_append_sheet(wb, wsGrade, 'Grade Mix');

// ---------- Sheet 5: Sales Force ----------
const forceRows = [['Sales Person', 'Transactions', 'Qty (CFT)']];
data.salesForce.forEach(s => forceRows.push([s.name, s.txns, s.qty]));
const wsForce = XLSX.utils.aoa_to_sheet(forceRows);
wsForce['!cols'] = [{ wch: 40 }, { wch: 14 }, { wch: 16 }];
XLSX.utils.book_append_sheet(wb, wsForce, 'Sales Force');

// ---------- Sheet 6: Metadata ----------
const metaRows = [
  ['Field', 'Value'],
  ['Title', data.meta.title],
  ['Company', data.meta.company],
  ['Source', data.meta.source],
  ['Period', data.meta.period],
  ['Collected', data.meta.collected],
];
const wsMeta = XLSX.utils.aoa_to_sheet(metaRows);
wsMeta['!cols'] = [{ wch: 18 }, { wch: 60 }];
XLSX.utils.book_append_sheet(wb, wsMeta, 'Metadata');

const out = 'ARMCL_August2026_SMS_Control_Tower_iBOS.xlsx';
XLSX.writeFile(wb, out);
console.log('Excel written:', out);
