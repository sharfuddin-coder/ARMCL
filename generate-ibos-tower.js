const fs = require('fs');
const path = require('path');

// Read the iBOS ERP collected data
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'sms-control-tower', 'ibos-august-2026.json'), 'utf8'));

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ARMCL SMS Control Tower | iBOS ERP</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',-apple-system,sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh}
.topbar{background:#020617;border-bottom:1px solid #1e293b;padding:14px 24px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px}
.topbar h1{font-size:1.15rem;font-weight:800;color:#f8fafc}
.topbar .sub{font-size:0.75rem;color:#94a3b8;margin-top:2px}
.badge{background:#1e293b;border:1px solid #334155;color:#cbd5e1;border-radius:999px;padding:4px 12px;font-size:0.72rem}
.badge.live{background:#052e16;border-color:#166534;color:#4ade80}
.container{max-width:1600px;margin:0 auto;padding:20px 24px}
.kpi-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px;margin-bottom:20px}
.kpi{background:#1e293b;border:1px solid #334155;border-radius:10px;padding:14px}
.kpi .lbl{font-size:0.62rem;text-transform:uppercase;color:#94a3b8;letter-spacing:0.05em;font-weight:600}
.kpi .val{font-size:1.05rem;font-weight:800;color:#f1f5f9;margin-top:5px;font-variant-numeric:tabular-nums}
.kpi .val small{font-size:0.62rem;font-weight:600;color:#64748b}
.kpi.green{border-top:3px solid #10b981}
.kpi.amber{border-top:3px solid #f59e0b}
.kpi.red{border-top:3px solid #ef4444}
.kpi.blue{border-top:3px solid #3b82f6}
.row{display:grid;grid-template-columns:1.6fr 1fr;gap:16px;margin-bottom:16px}
.row2{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}
.box{background:#1e293b;border:1px solid #334155;border-radius:10px;padding:18px}
.box h3{font-size:0.72rem;color:#94a3b8;margin-bottom:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em}
.box h3 .rag{float:right;font-size:0.62rem;border-radius:4px;padding:2px 8px}
.rag.green{background:#052e16;color:#4ade80}
.rag.amber{background:#451a03;color:#fbbf24}
.rag.red{background:#450a0a;color:#f87171}
.bar{position:relative;height:26px;background:#0f172a;border-radius:5px;margin-bottom:6px;overflow:hidden}
.bar .fill{height:100%;border-radius:5px}
.bar .txt{position:absolute;inset:0;display:flex;align-items:center;justify-content:space-between;padding:0 9px;font-size:0.7rem;font-weight:600;color:#e2e8f0}
.bar .txt .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:62%}
.fc.green{background:#10b981}.fc.amber{background:#f59e0b}.fc.red{background:#ef4444}.fc.blue{background:#3b82f6}.fc.slate{background:#475569}.fc.violet{background:#8b5cf6}
table{width:100%;border-collapse:collapse}
th,td{padding:8px 10px;text-align:right;border-bottom:1px solid #0f172a;font-size:0.78rem}
th{color:#94a3b8;font-weight:600;text-transform:uppercase;font-size:0.62rem;letter-spacing:0.04em;background:#0f172a}
th:first-child,td:first-child{text-align:left}
tr:hover{background:#0f172a}
.num{font-variant-numeric:tabular-nums;font-weight:600}
.daily{display:flex;align-items:flex-end;gap:3px;height:140px;padding-top:6px}
.day{flex:1;background:#1e293b;border-radius:4px 4px 0 0;position:relative;min-width:0}
.day .fill{position:absolute;bottom:0;left:0;right:0;border-radius:4px 4px 0 0}
.day .tt{position:absolute;top:-16px;left:50%;transform:translateX(-50%);font-size:0.58rem;color:#94a3b8;white-space:nowrap}
.day .dl{position:absolute;bottom:-18px;left:50%;transform:translateX(-50%);font-size:0.55rem;color:#475569}
.guard{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin-bottom:20px}
.g{background:#1e293b;border:1px solid #334155;border-radius:8px;padding:10px 14px;display:flex;align-items:center;justify-content:space-between;font-size:0.75rem}
.g .d{font-weight:700;letter-spacing:0.05em}
.dot{width:10px;height:10px;border-radius:50%}
.dot.green{background:#10b981}.dot.amber{background:#f59e0b}.dot.red{background:#ef4444}.dot.blue{background:#3b82f6}
.note{font-size:0.68rem;color:#64748b;margin-top:10px;line-height:1.5}
footer{color:#475569;font-size:0.68rem;text-align:center;padding:20px}
</style>
</head>
<body>
<div class="topbar">
  <div>
    <h1>ARMCL SMS Control Tower — iBOS ERP</h1>
    <div class="sub" id="subtitle">Loading…</div>
  </div>
  <span class="badge live">● iBOS ERP Data</span>
</div>
<div class="container" id="root"></div>
<footer>Source: iBOS ERP archive (DWH) · ARMCL = BU 175 · ${data.meta.period} · Framework: Akij Resource — Sales Management OS</footer>
<script>
// ===== Embedded iBOS ERP data (collected offline, baked into this page) =====
var DATA = ${JSON.stringify(data)};

function num(n){ return (n===null||n===undefined||isNaN(n))?0:Number(n); }
function fmt(n){ return Math.round(num(n)).toLocaleString('en-US'); }
function pct(n){ return num(n).toFixed(1)+'%'; }
function rag(v,a,r){ return v>=a?'green':v>=r?'amber':'red'; }
function bar(label,val,total,cls,show){
  var w = total>0 ? Math.min(100,val/total*100) : 0;
  return '<div class="bar"><div class="fill fc '+cls+'" style="width:'+Math.max(2,w)+'%"></div><div class="txt"><span class="nm">'+label+'</span><span>'+(show||'')+'</span></div></div>';
}
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;'); }

function render(d){
  var root=document.getElementById('root');
  root.innerHTML='';
  var k=d.kpi;
  document.getElementById('subtitle').textContent = d.meta.company+' · '+d.meta.period+' · '+d.meta.source;

  var cards=[
    {l:'Sales Orders',v:fmt(k.salesOrders),c:'blue'},
    {l:'Order Value (BDT)',v:fmt(k.salesOrderValue),c:'blue'},
    {l:'Avg Order Value',v:fmt(k.avgOrderValue),c:'blue'},
    {l:'Invoices',v:fmt(k.invoices),c:'blue'},
    {l:'Invoice Qty (CFT)',v:fmt(k.invoiceQty),c:'blue'},
    {l:'Deliveries',v:fmt(k.deliveries),c:'blue'},
    {l:'Delivery Qty (CFT)',v:fmt(k.deliveryQty),c:'blue'},
    {l:'Delivery Value (BDT)',v:fmt(k.deliveryValue),c:'blue'},
    {l:'Collection (BDT)',v:fmt(k.collection),c:rag(k.collectionPct,80,60)},
    {l:'Collection %',v:pct(k.collectionPct),c:rag(k.collectionPct,80,60)},
    {l:'Lifting %',v:pct(k.liftingPct),c:rag(k.liftingPct,80,60)},
    {l:'Coverage %',v:pct(k.coveragePct),c:rag(k.coveragePct,50,30)},
    {l:'Active Customers',v:fmt(k.activeCustomers),c:'blue'},
    {l:'Customer Universe',v:fmt(k.universe),c:'blue'},
    {l:'Sales Force',v:fmt(k.salesForce),c:'blue'},
    {l:'Plants',v:fmt(k.plantCount),c:'blue'},
    {l:'Product Grades',v:fmt(k.gradeCount),c:'blue'},
    {l:'Delivery Days',v:d.daily.length,c:'blue'}
  ];
  var kpiSec=document.createElement('div'); kpiSec.className='kpi-grid';
  kpiSec.innerHTML=cards.map(function(x){return '<div class="kpi '+x.c+'"><div class="lbl">'+x.l+'</div><div class="val">'+x.v+'</div></div>';}).join('');
  root.appendChild(kpiSec);

  var gs=document.createElement('div'); gs.className='guard';
  gs.innerHTML=[
    ['SALES', k.salesOrderValue>0?'green':'amber'],
    ['CASH', rag(k.collectionPct,80,60)],
    ['CREDIT', rag(k.collectionPct,80,60)],
    ['SERVICE', rag(k.liftingPct,80,60)],
    ['COVERAGE', rag(k.coveragePct,50,30)],
    ['MARGIN','amber'],['STOCK','amber'],['DATA','blue']
  ].map(function(x){return '<div class="g"><span>'+x[0]+'</span><span class="dot '+x[1]+'"></span></div>';}).join('');
  root.appendChild(gs);

  var r1=document.createElement('div'); r1.className='row'; root.appendChild(r1);
  var bDaily=document.createElement('div'); bDaily.className='box'; r1.appendChild(bDaily);
  var maxD=1; d.daily.forEach(function(x){if(x.qty>maxD)maxD=x.qty;});
  bDaily.innerHTML='<h3>Daily Delivery Trend (CFT)</h3><div class="daily">'+
    d.daily.map(function(x){var h=Math.max(2,x.qty/maxD*100);
      return '<div class="day" title="'+x.date+'"><div class="fill" style="height:'+h+'%;background:'+(x.qty>0?'#3b82f6':'#1e293b')+'"></div><div class="tt">'+fmt(x.qty/1000)+'k</div><div class="dl">'+x.date.slice(8,10)+'</div></div>';}).join('')+
    '</div><div class="note">'+(d.daily[0]?d.daily[0].date+' to '+d.daily[d.daily.length-1].date:'')+' · '+d.daily.length+' active delivery days</div>';

  var bPlant=document.createElement('div'); bPlant.className='box'; r1.appendChild(bPlant);
  var maxP=1; d.byPlant.forEach(function(x){if(x.qty>maxP)maxP=x.qty;});
  bPlant.innerHTML='<h3>Plant-wise Delivery (CFT)</h3>'+
    d.byPlant.map(function(x){return bar(esc(x.name.trim()),x.qty,maxP,'blue',fmt(x.qty)+' CFT');}).join('')+
    '<div class="note">Total delivery value: '+fmt(k.deliveryValue)+' BDT</div>';

  var r2=document.createElement('div'); r2.className='row2'; root.appendChild(r2);
  var bMix=document.createElement('div'); bMix.className='box'; r2.appendChild(bMix);
  var maxM=1; d.gradeMix.forEach(function(x){if(x.qty>maxM)maxM=x.qty;});
  bMix.innerHTML='<h3>Product / Grade Mix (CFT)</h3>'+
    d.gradeMix.map(function(x){return bar(esc(x.item),x.qty,maxM,'slate',fmt(x.qty)+' CFT');}).join('');

  var bForce=document.createElement('div'); bForce.className='box'; r2.appendChild(bForce);
  var maxF=1; d.salesForce.forEach(function(x){if(x.qty>maxF)maxF=x.qty;});
  bForce.innerHTML='<h3>Sales Force (iBOS)</h3>'+
    d.salesForce.slice(0,10).map(function(x){return bar(esc(x.name),x.qty,maxF,'violet',fmt(x.qty)+' CFT');}).join('')+
    '<div class="note">'+d.salesForce.length+' sales persons · Source: oms.tblSalesInvoiceArc.strSoldByName</div>';

  var r3=document.createElement('div'); r3.className='row2'; root.appendChild(r3);
  var bLift=document.createElement('div'); bLift.className='box'; r3.appendChild(bLift);
  var lift=k.liftingPct;
  bLift.innerHTML='<h3>Order Book & Lifting <span class="rag '+rag(lift,80,60)+'">'+pct(lift)+'</span></h3>'+
    bar('Lifting',k.deliveredQty,k.orderQty,rag(lift,80,60),fmt(k.deliveredQty)+' / '+fmt(k.orderQty)+' CFT')+
    '<div class="note">Approved open orders: delivered vs ordered quantity</div>';

  var bColl=document.createElement('div'); bColl.className='box'; r3.appendChild(bColl);
  var coll=k.collectionPct;
  bColl.innerHTML='<h3>Collection vs Delivery Value <span class="rag '+rag(coll,80,60)+'">'+pct(coll)+'</span></h3>'+
    bar('Collection',k.collection,k.deliveryValue,rag(coll,80,60),fmt(k.collection)+' BDT')+
    '<div class="note">Collected (Trade Receivable journal) vs delivered '+fmt(k.deliveryValue)+' BDT · fin.tblAccountingJournalArc</div>';
}

render(DATA);
</script>
</body>
</html>
`;

const out = path.join(__dirname, 'sms-control-tower', 'ibos-control-tower.html');
fs.writeFileSync(out, html, 'utf8');
console.log('Self-contained tower written:', out, '|', html.length, 'bytes');
