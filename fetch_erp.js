const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, 'downloads');
const PROFILE_DIR = path.join(__dirname, '.gprofile');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL = 'https://erp.ibos.io/internal-control/budgetvariancereport/income_statement_new';

(async () => {
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    executablePath: CHROME,
    viewport: { width: 1600, height: 1000 },
    args: ['--disable-blink-features=AutomationControlled', '--start-maximized'],
  });
  const page = ctx.pages()[0] || (await ctx.newPage());
  let closed = false;
  ctx.on('close', () => {
    closed = true;
    console.log('[event] browser context closed');
  });

  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  } catch (e) {
    console.log('goto warning:', e.message.split('\n')[0]);
  }

  console.log('Chrome opened. Please log in to iBOS ERP in that window. Polling up to 10 min...');
  const deadline = Date.now() + 600000;
  let ready = false;
  let last = '';
  while (!closed && Date.now() < deadline) {
    try {
      await page.waitForTimeout(3000);
      const info = await page.evaluate(() => ({
        url: location.href,
        len: document.body ? document.body.innerText.length : 0,
        pwd: !!document.querySelector('input[type="password"]'),
        tables: document.querySelectorAll('table').length,
      }));
      const state = `url=${info.url.slice(0, 80)} text=${info.len} pwd=${info.pwd} tables=${info.tables}`;
      if (state !== last) {
        console.log('[state]', state);
        last = state;
      }
      if (info.url.includes('income_statement') && !info.pwd && (info.len > 800 || info.tables > 0)) {
        ready = true;
        break;
      }
    } catch (e) {
      console.log('[poll error]', e.message.split('\n')[0]);
      break;
    }
  }

  if (closed) {
    console.log('Aborted: browser closed.');
    return;
  }
  console.log(ready ? 'Report detected. Capturing...' : 'Timeout. Capturing current state...');

  try {
    await page.waitForTimeout(4000);
    const title = await page.title();
    const html = await page.content();
    fs.writeFileSync(path.join(OUT_DIR, 'income_statement.html'), html, 'utf8');
    const text = await page.evaluate(() => document.body.innerText);
    fs.writeFileSync(path.join(OUT_DIR, 'income_statement.txt'), text, 'utf8');
    await page.screenshot({ path: path.join(OUT_DIR, 'income_statement.png'), fullPage: true });
    const exportBtns = await page.evaluate(() =>
      [...document.querySelectorAll('a,button')]
        .filter((el) => /export|download|pdf|excel|xlsx|print/i.test((el.innerText || '') + (el.title || '')))
        .map((el) => ((el.innerText || '') + '|' + (el.title || '')).trim())
        .slice(0, 10)
    );
    console.log('Title:', title);
    console.log('Text length:', text.length);
    console.log('Export-like controls:', JSON.stringify(exportBtns));
    console.log('Saved income_statement.html/.txt/.png in downloads/');
  } catch (e) {
    console.log('Capture failed:', e.message.split('\n')[0]);
  }

  await ctx.close().catch(() => {});
})();
