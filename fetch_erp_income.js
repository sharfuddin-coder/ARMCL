const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, 'downloads');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const USER_DATA = path.join(__dirname, '.gprofile');
const URL = 'https://erp.ibos.io/internal-control/budgetvariancereport/income_statement_new';
const REPORT_NAME = 'income_statement';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function pickReactOption(page, inputId, text) {
  const inp = await page.$('#' + inputId);
  if (!inp) return 'no-input';
  await inp.click();
  await sleep(1500);
  return await page.evaluate((t) => {
    const opts = [...document.querySelectorAll('[id*="option"], [role="option"], [class*="option"]')].map(el => el.innerText.trim()).filter(Boolean);
    const hit = opts.find(o => t ? o.toLowerCase().includes(t.toLowerCase()) : o);
    if (hit) {
      const el = [...document.querySelectorAll('[id*="option"], [role="option"], [class*="option"]')].find(e => e.innerText.trim() === hit);
      if (el) el.click();
      return 'picked: ' + hit;
    }
    return 'opts: ' + JSON.stringify(opts.slice(0, 12));
  }, text);
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

  console.log('Waiting for income statement report (login + load)...');
  const deadline = Date.now() + 420000;
  let ready = false;
  let last = '';
  while (!closed && Date.now() < deadline) {
    try {
      await page.waitForTimeout(3000);
      const info = await page.evaluate(() => ({
        url: location.href,
        text: document.body ? document.body.innerText.length : 0,
        pwd: !!document.querySelector('input[type="password"]'),
        tables: document.querySelectorAll('table').length,
        canvas: document.querySelectorAll('canvas').length,
      }));
      const state = `url=${info.url.slice(0, 70)} text=${info.text} pwd=${info.pwd} tbl=${info.tables} cv=${info.canvas}`;
      if (state !== last) { console.log('[state]', state); last = state; }
      if (!info.pwd && info.url.includes('income_statement') && (info.text > 500 || info.tables > 0)) { ready = true; break; }
    } catch (e) { console.log('[poll error]', e.message.split('\n')[0]); break; }
  }

  if (closed) { console.log('Aborted: browser closed.'); return; }
  console.log(ready ? 'Income statement loaded. Capturing...' : 'Timeout. Capturing current state...');

  // Interact with the form: React-select comboboxes + dates + Show
  try {
    await page.waitForTimeout(3000);

    // Set dates
    const fromDate = await page.$('input[name="fromDate"]');
    const toDate = await page.$('input[name="toDate"]');
    if (fromDate) await fromDate.fill('2026-08-01');
    if (toDate) await toDate.fill('2026-08-31');
    console.log('Dates set: from=2026-08-01 to=2026-08-31');

    // Enterprise Division -> Akij Ready Mix Concrete Ltd
    console.log('EntDiv:', await pickReactOption(page, 'react-select-2-input', 'Akij Ready Mix'));
    await sleep(1500);

    // Re-locate comboboxes (form may re-render) and pick Business Unit + View Type
    const inputs = await page.$$('input[role="combobox"]');
    console.log('Comboboxes now:', inputs.length);
    let comboIds = [];
    for (const inp of inputs) {
      const id = await inp.getAttribute('id').catch(() => '');
      if (id) comboIds.push(id);
    }
    console.log('Combo IDs:', JSON.stringify(comboIds));
    // Business Unit (3rd combobox) = Akij Ready Mix Concrete Ltd
    if (comboIds.length >= 3) {
      console.log('BusUnit:', await pickReactOption(page, comboIds[2], 'Akij Ready Mix'));
      await sleep(1200);
    }
    // View Type (4th combobox) = Monthly (if present)
    if (comboIds.length >= 4) {
      console.log('ViewType:', await pickReactOption(page, comboIds[3], 'Monthly'));
      await sleep(1200);
    }

    // Click Show
    const btns = await page.$$('button, a, .k-button, [class*="btn"]');
    for (const b of btns) {
      let txt = '';
      try { txt = ((await b.innerText()).trim()) || ''; } catch (e) { continue; }
      if (/^Show$/i.test(txt)) {
        try { await Promise.race([b.click(), new Promise((res) => setTimeout(res, 3000))]); console.log('Clicked Show'); }
        catch (e) { console.log('click note:', e.message.split('\n')[0]); }
        break;
      }
    }
    await sleep(5000);
    try { await page.waitForLoadState('domcontentloaded', { timeout: 30000 }); } catch (e) {}
    await sleep(18000);
  } catch (e) { console.log('form interaction note:', e.message.split('\n')[0]); }

  if (closed || !page) {
    console.log('Page closed after Show click - re-capturing via new page');
  }

  try {
    await sleep(3000);
    const title = await page.title();
    console.log('Title:', title);
    const html = await page.content();
    fs.writeFileSync(path.join(OUT_DIR, `${REPORT_NAME}.html`), html, 'utf8');
    const text = await page.evaluate(() => document.body.innerText);
    fs.writeFileSync(path.join(OUT_DIR, `${REPORT_NAME}.txt`), text, 'utf8');
    await page.screenshot({ path: path.join(OUT_DIR, `${REPORT_NAME}.png`), fullPage: true });
    console.log('HTML:', (html.length / 1024).toFixed(1) + 'KB | Text:', (text.length / 1024).toFixed(1) + 'KB');

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
    tables.slice(0, 3).forEach((t) => { console.log('--- table', t.table, t.rows.length, 'rows ---'); t.rows.slice(0, 15).forEach((r) => console.log('  ' + r.join(' | ').slice(0, 200))); });

    const exportBtns = await page.evaluate(() =>
      [...document.querySelectorAll('a,button')]
        .filter((el) => /export|download|pdf|excel|xlsx|print/i.test((el.innerText || '') + (el.title || '')))
        .map((el) => ((el.innerText || '').trim() + '|' + (el.title || '').trim()).replace(/\s+/g, ' '))
        .slice(0, 15)
    );
    console.log('Export controls:', JSON.stringify(exportBtns));
    console.log('Saved', REPORT_NAME + '.* in downloads/');
  } catch (e) {
    console.log('Extraction failed:', e.message.split('\n')[0]);
  }

  await ctx.close().catch(() => {});
})();
