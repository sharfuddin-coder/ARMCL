const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, 'downloads');
const PROFILE_DIR = path.join(__dirname, '.gprofile');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ID = '1vPlcijsZkj4p6ZHmzg7jEAutNrW5l2YKlbNUtgXkNbI';
const FILE = 'Sales_Target_Achievement_new.xlsx';

(async () => {
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    executablePath: CHROME,
    viewport: null,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const page = ctx.pages()[0] || (await ctx.newPage());
  try {
    const [dl] = await Promise.all([
      page.waitForEvent('download', { timeout: 120000 }),
      page.goto(`https://docs.google.com/spreadsheets/d/${ID}/export?format=xlsx`, { waitUntil: 'commit' }).catch(() => {}),
    ]);
    await dl.saveAs(path.join(OUT_DIR, FILE));
    console.log('OK', FILE);
  } catch (e) {
    console.log('FAIL | page url:', page.url());
  }
  await ctx.close();
})();
