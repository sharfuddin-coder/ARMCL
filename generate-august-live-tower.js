const fs = require('fs');
const path = require('path');

// 1. iBOS ERP Setup Base Achievement (exact ERP report data - captured from live screen)
const sba = JSON.parse(fs.readFileSync(path.join(__dirname, 'sms-control-tower', 'setup-base-achievement-aug-2026.json'), 'utf8'));
// 2. Operational panels (DWH)
const panels = JSON.parse(fs.readFileSync(path.join(__dirname, 'sms-control-tower', 'august-ibos-panels.json'), 'utf8'));

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ARMCL August Live SMS Control Tower | iBOS ERP</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',-apple-system,sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh}
.topbar{background:#020617;border-bottom:1px solid #1e293b;padding:14px 24px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px}
.topbar h1{font-size:1.15rem;font-weight:800;color:#f8fafc}
.topbar .sub{font-size:0.75rem;color:#94a3b8;margin-top:2px}
.badge{background:#1e293b;border:1px solid #334155;color:#cbd5e1;border-radius:999px;padding:4px 12px;font-size:0.72rem}
.badge.live{background:#052e16;border-color:#166534;color:#4ade80}
.container{max-width:1600px;margin:0 auto;padding:20px 24px}
.controls{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}
.controls button{background:#1e293b;border:1px solid #334155;color:#cbd5e1;border-radius:6px;padding:6px 14px;font-size:0.72rem;cursor:pointer}
.controls button:hover{background:#334155}
.kpi-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px;margin-bottom:20px}
.kpi{background:#1e293b;border:1px solid #334155;border-radius:10px;padding:14px}
.kpi .lbl{font-size:0.62rem;text-transform:uppercase;color:#94a3b8;letter-spacing:0.05em;font-weight:600}
.kpi .val{font-size:1.05rem;font-weight:800;color:#f1f5f9;margin-top:5px;font-variant-numeric:tabular-nums}
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
    <h1>ARMCL August Live SMS Control Tower — iBOS ERP</h1>
    <div class="sub" id="subtitle">Loading…</div>
  </div>
  <div class="controls">
    <button onclick="location.reload()">Refresh</button>
    <span class="badge live">● iBOS ERP</span>
  </div>
</div>
<div class="container" id="root"></div>
<footer>Source: iBOS ERP report (setupbaseachivement) + DWH panels · ARMCL = BU 175 · August 2026 · Framework: Akij Resource — Sales Management OS</footer>
<script>
var SBA = ${JSON.stringify(sba)};
var PAN = ${JSON.stringify(panels)};

function num(n){ return (n===null||n===undefined||isNaN(n))?0:Number(n); }
function fmt(n){ return Math.round(num(n)).toLocaleString('en-US'); }
function pct(n){ return num(n).toFixed(1)+'%'; }
function rag(v,a,r){ return v>=a?'green':v>=r?'amber':'red'; }
function bar(label,val,total,cls,show){
  var w = total>0 ? Math.min(100,val/total*100) : 0;
  return '<div class="bar"><div class="fill fc '+cls+'" style="width:'+Math.max(2,w)+'%"></div><div class="txt"><span class="nm">'+label+'</span><span>'+(show||'')+'</span></div></div>';
}
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;'); }

function render(){
  var root=document.getElementById('root');
  root.innerHTML='';
  var t=SBA.totals;
  document.getElementById('subtitle').textContent = 'Akij Ready Mix Concrete Ltd (ARMCL) · August 2026 MTD · iBOS ERP report + DWH panels · Captured '+SBA.meta.captured.slice(0,10);

  var cards=[
    {l:'Monthly Target (CFT)',v:fmt(t.monthlyTargetCFT),c:'blue'},
    {l:'Sales Till Date (CFT)',v:fmt(t.monthlyQty),c:rag(t.achievementPct,95,80)},
    {l:'Achievement %',v:pct(t.achievementPct),c:rag(t.achievementPct,95,80)},
    {l:'Monthly Sales (BDT)',v:fmt(t.monthlySalesBDT),c:'blue'},
    {l:'Collection (BDT)',v:fmt(t.collectionBDT),c:rag(t.collectionVsSalesPct,80,60)},
    {l:'Collection vs Sales %',v:pct(t.collectionVsSalesPct),c:rag(t.collectionVsSalesPct,80,60)},
    {l:'TRT (BDT)',v:fmt(t.trt),c:'blue'},
    {l:'Active Customers',v:fmt(t.activeCustomers),c:'blue'},
    {l:'Sales Persons',v:fmt(SBA.byPerson.length),c:'blue'},
    {l:'Teams',v:fmt(SBA.byTeam.length),c:'blue'},
    {l:'Delivery Qty (CFT)',v:fmt(PAN.delivery.qty),c:'blue'},
    {l:'Delivery Value (BDT)',v:fmt(PAN.delivery.value),c:'blue'},
    {l:'Coverage %',v:pct(PAN.coverage.active/PAN.coverage.universe*100),c:rag(PAN.coverage.active/PAN.coverage.universe*100,50,30)},
    {l:'Plants / Grades',v:fmt(PAN.byPlant.length)+' / '+fmt(PAN.gradeMix.length),c:'blue'}
  ];
  var kpiSec=document.createElement('div'); kpiSec.className='kpi-grid';
  kpiSec.innerHTML=cards.map(function(x){return '<div class="kpi '+x.c+'"><div class="lbl">'+x.l+'</div><div class="val">'+x.v+'</div></div>';}).join('');
  root.appendChild(kpiSec);

  var gs=document.createElement('div'); gs.className='guard';
  gs.innerHTML=[
    ['SALES', rag(t.achievementPct,95,80)],
    ['CASH', rag(t.collectionVsSalesPct,80,60)],
    ['CREDIT', rag(t.collectionVsSalesPct,80,60)],
    ['COVERAGE', rag(PAN.coverage.active/PAN.coverage.universe*100,50,30)],
    ['SERVICE','amber'],['MARGIN','amber'],['STOCK','amber'],['DATA','blue']
  ].map(function(x){return '<div class="g"><span>'+x[0]+'</span><span class="dot '+x[1]+'"></span></div>';}).join('');
  root.appendChild(gs);

  // Row1: daily + target
  var r1=document.createElement('div'); r1.className='row'; root.appendChild(r1);
  var bDaily=document.createElement('div'); bDaily.className='box'; r1.appendChild(bDaily);
  var maxD=1; PAN.daily.forEach(function(x){if(x.qty>maxD)maxD=x.qty;});
  bDaily.innerHTML='<h3>Daily Delivery Trend (CFT)</h3><div class="daily">'+
    PAN.daily.map(function(x){var h=Math.max(2,x.qty/maxD*100);
      return '<div class="day" title="'+x.date+'"><div class="fill" style="height:'+h+'%;background:'+(x.qty>0?'#3b82f6':'#1e293b')+'"></div><div class="tt">'+fmt(x.qty/1000)+'k</div><div class="dl">'+x.date.slice(8,10)+'</div></div>';}).join('')+
    '</div><div class="note">'+PAN.daily.length+' delivery days · Total '+fmt(PAN.delivery.qty)+' CFT</div>';

  var bTgt=document.createElement('div'); bTgt.className='box'; r1.appendChild(bTgt);
  var ach=t.achievementPct;
  bTgt.innerHTML='<h3>Target vs Achievement <span class="rag '+rag(ach,95,80)+'">'+pct(ach)+'</span></h3>'+
    bar('Sales Till Date',t.monthlyQty,t.monthlyTargetCFT,rag(ach,95,80),fmt(t.monthlyQty)+' / '+fmt(t.monthlyTargetCFT)+' CFT')+
    bar('Collection vs Sales',t.collectionBDT,t.monthlySalesBDT,rag(t.collectionVsSalesPct,80,60),fmt(t.collectionBDT)+' / '+fmt(t.monthlySalesBDT)+' BDT')+
    '<div class="note">TRT (target revenue) '+fmt(t.trt)+' BDT · Source: iBOS ERP setupbaseachivement report</div>';

  // Row2: person-wise + team-wise
  var r2=document.createElement('div'); r2.className='row'; root.appendChild(r2);
  var bPerson=document.createElement('div'); bPerson.className='box'; r2.appendChild(bPerson);
  var maxP=1; SBA.byPerson.forEach(function(x){if(x.qty>maxP)maxP=x.qty;});
  bPerson.innerHTML='<h3>Sales Person Wise (Qty CFT)</h3>'+
    SBA.byPerson.slice().sort(function(a,b){return b.qty-a.qty;}).map(function(x){
      return bar(esc(x.name),x.qty,maxP,'blue',fmt(x.qty)+' · '+pct(x.achivPct));
    }).join('')+
    '<div class="note">Source: iBOS ERP report col "Region" (sales person)</div>';

  var bTeam=document.createElement('div'); bTeam.className='box'; r2.appendChild(bTeam);
  var maxT=1; SBA.byTeam.forEach(function(x){if(x.qty>maxT)maxT=x.qty;});
  bTeam.innerHTML='<h3>Team Wise</h3>'+
    SBA.byTeam.slice().sort(function(a,b){return b.qty-a.qty;}).map(function(x){
      return bar(esc(x.team),x.qty,maxT,'violet',fmt(x.qty)+' CFT · coll '+fmt(x.coll));
    }).join('');

  // Row3: plants + grades
  var r3=document.createElement('div'); r3.className='row2'; root.appendChild(r3);
  var bPlant=document.createElement('div'); bPlant.className='box'; r3.appendChild(bPlant);
  var maxPL=1; PAN.byPlant.forEach(function(x){if(x.qty>maxPL)maxPL=x.qty;});
  bPlant.innerHTML='<h3>Plant-wise Delivery (CFT)</h3>'+
    PAN.byPlant.map(function(x){return bar(esc(x.name.trim()),x.qty,maxPL,'blue',fmt(x.qty)+' CFT');}).join('');

  var bMix=document.createElement('div'); bMix.className='box'; r3.appendChild(bMix);
  var maxM=1; PAN.gradeMix.forEach(function(x){if(x.qty>maxM)maxM=x.qty;});
  bMix.innerHTML='<h3>Product / Grade Mix (CFT)</h3>'+
    PAN.gradeMix.map(function(x){return bar(esc(x.item),x.qty,maxM,'slate',fmt(x.qty)+' CFT');}).join('');

  // Row4: top customers + coverage
  var r4=document.createElement('div'); r4.className='row'; root.appendChild(r4);
  var bTop=document.createElement('div'); bTop.className='box'; r4.appendChild(bTop);
  bTop.innerHTML='<h3>Top 10 Customers (iBOS ERP)</h3><div style="overflow-x:auto"><table><thead><tr><th>Customer</th><th>Team</th><th>Qty</th><th>Sales</th><th>Collection</th></tr></thead><tbody>'+
    SBA.topCustomers.slice(0,10).map(function(c){
      return '<tr><td>'+esc(c.customer)+'</td><td>'+esc(c.team)+'</td><td class="num">'+fmt(c.monthlyQty)+'</td><td class="num">'+fmt(c.monthlySales)+'</td><td class="num">'+fmt(c.collection)+'</td></tr>';
    }).join('')+'</tbody></table></div>';

  var bCov=document.createElement('div'); bCov.className='box'; r4.appendChild(bCov);
  var cov=PAN.coverage;
  var covPct=cov.universe>0?cov.active/cov.universe*100:0;
  bCov.innerHTML='<h3>Market Coverage <span class="rag '+rag(covPct,50,30)+'">'+pct(covPct)+'</span></h3>'+
    bar('Active / Universe',cov.active,cov.universe,rag(covPct,50,30),cov.active+' / '+fmt(cov.universe))+
    '<div class="note">'+fmt(cov.active)+' active customers of '+fmt(cov.universe)+' universe</div>';
}

render();
</script>
</body>
</html>
`;
fs.writeFileSync(path.join(__dirname, 'sms-control-tower', 'august-live-tower.html'), html, 'utf8');
console.log('August live tower written: sms-control-tower/august-live-tower.html |', html.length, 'bytes');
