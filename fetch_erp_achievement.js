const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, 'downloads');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const USER_DATA = path.join(__dirname, '.gprofile');
const URL = 'https://erp.ibos.io/sales-management/report/setupbaseachivement';
const REPORT_NAME = 'setupbaseachivement';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function clickButtonByText(page, textRe) {
  // Robust: find all buttons, match text; click with race to tolerate navigation
  const btns = await page.$$('button, a, .k-button, [class*="btn"]');
  for (const b of btns) {
    let txt = '';
    try { txt = ((await b.innerText()).trim()) || ''; } catch (e) { continue; }
    if (textRe.test(txt)) {
      try {
        await Promise.race([b.click(), sleep(3000)]);
        return txt;
      } catch (e) { /* navigation race */ }
    }
  }
  return null;
}

async function fillDateInputs(page) {
  const now = new Date();
  const today = now.getFullYear() + '-' + ('0' + (now.getMonth() + 1)).slice(-2) + '-' + ('0' + now.getDate()).slice(-2);
  const firstDay = now.getFullYear() + '-' + ('0' + (now.getMonth() + 1)).slice(-2) + '-01';
  const dateInputs = await page.$$('input[type="date"]');
  let filled = 0;
  // date inputs order: [0]=From Date, [1]=To Date, [2]=Certain Date
  for (let i = 0; i < dateInputs.length; i++) {
    try {
      if (i === 0) await dateInputs[i].fill(firstDay);       // From Date = Aug 1
      else if (i === 1) await dateInputs[i].fill(today);     // To Date = today (MTD)
      else await dateInputs[i].fill('');                     // Certain Date = blank
      filled++;
    } catch (e) { /* ignore */ }
  }
  return filled;
}

(async () => {
  const ctx = await chromium.launchPersistentContext(USER_DATA, {
    headless: false, executablePath: CHROME,
    viewport: { width: 1750, height: 1000 },
    args: ['--start-maximized', '--disable-blink-features=AutomationControlled'],
  });
  const page = ctx.pages()[0] || (await ctx.newPage());
  let closed = false;
  ctx.on('close', () => { closed = true; console.log('[event] browser closed'); });

  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
  } catch (e) { console.log('goto warning:', e.message.split('\n')[0]); }

  console.log('Waiting for login / report...');
  const deadline = Date.now() + 420000;
  let loggedIn = false;
  let last = '';
  while (!closed && Date.now() < deadline) {
    try {
      await page.waitForTimeout(3000);
      const info = await page.evaluate(() => ({
        url: location.href, text: document.body ? document.body.innerText.length : 0,
        pwd: !!document.querySelector('input[type="password"]'),
        hasView: /View/.test(document.body.innerText),
      }));
      const state = `url=${info.url.slice(0, 70)} text=${info.text} pwd=${info.pwd} view=${info.hasView}`;
      if (state !== last) { console.log('[state]', state); last = state; }
      if (!info.pwd && info.hasView) { loggedIn = true; break; }
    } catch (e) { console.log('[poll error]', e.message.split('\n')[0]); break; }
  }

  if (closed) { console.log('Aborted: browser closed.'); return; }
  if (!loggedIn) { console.log('NOT logged in or View not found. Capturing current state.'); }
  else {
    console.log('Report form found. Setting dates (Aug 1-31, 2026)...');
    const filled = await fillDateInputs(page);
    console.log('Date inputs filled:', filled);
    await sleep(2000);
    console.log('Clicking View...');
    let clicked = null;
    try { clicked = await clickButtonByText(page, /^View\s*$/i); } catch (e) { console.log('view click note:', e.message.split('\n')[0]); }
    console.log('View clicked:', clicked);
    // Wait for grid to load (may be same-page render or navigation)
    try { await page.waitForLoadState('domcontentloaded', { timeout: 30000 }); } catch (e) {}
    await sleep(15000);
  }

  console.log('Final capture...');
  try {
    await page.waitForTimeout(5000);
    const title = await page.title();
    console.log('Title:', title);
    const html = await page.content();
    fs.writeFileSync(path.join(OUT_DIR, `${REPORT_NAME}.html`), html, 'utf8');
    const text = await page.evaluate(() => document.body.innerText);
    fs.writeFileSync(path.join(OUT_DIR, `${REPORT_NAME}.txt`), text, 'utf8');
    await page.screenshot({ path: path.join(OUT_DIR, `${REPORT_NAME}.png`), fullPage: true });
    const canvasN = await page.evaluate(() => document.querySelectorAll('canvas').length);
    console.log('HTML:', (html.length / 1024).toFixed(1) + 'KB | Text:', (text.length / 1024).toFixed(1) + 'KB | Canvases:', canvasN);

    const tables = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('table').forEach((tb, ti) => {
        const rows = [];
        tb.querySelectorAll('tr').forEach((tr) => {
          const cells = [...tr.querySelectorAll('th,td')].map((c) => (c.innerText || '').trim());
          if (cells.some((c) => c)) rows.push(cells);
        });
        if (rows.length) out.push({ table: ti, rows });
      });
      return out;
    });
    fs.writeFileSync(path.join(OUT_DIR, `${REPORT_NAME}_tables.json`), JSON.stringify(tables, null, 1), 'utf8');
    console.log('DOM tables:', tables.length);
    tables.slice(0, 3).forEach((t) => { console.log('--- table', t.table, t.rows.length, 'rows ---'); t.rows.slice(0, 8).forEach((r) => console.log('  ' + r.join(' | ').slice(0, 180))); });

    // Try Export to Sheets if data didn't render as DOM
    if (tables.length === 0) {
      console.log('No DOM tables — trying Export to Sheets...');
      const ex = await clickButtonByText(page, /export to sheets/i);
      console.log('Export clicked:', ex);
      await sleep(8000);
      const pages = ctx.pages();
      console.log('Pages after export:', pages.length);
      // Capture any new page (Sheets export may open new tab)
      for (const p of pages.slice(1)) {
        await p.waitForLoadState('domcontentloaded').catch(() => {});
        const t = await p.evaluate(() => document.body ? document.body.innerText : '');
        if (t && t.length > 50) {
          fs.writeFileSync(path.join(OUT_DIR, `${REPORT_NAME}_export.txt`), t, 'utf8');
          console.log('Export page text saved:', t.length, 'chars');
          console.log(t.slice(0, 1200));
        }
      }
    }
    console.log('Saved', REPORT_NAME + '.* in downloads/');
  } catch (e) {
    console.log('Extraction failed:', e.message.split('\n')[0]);
  }

  await ctx.close().catch(() => {});
})();
