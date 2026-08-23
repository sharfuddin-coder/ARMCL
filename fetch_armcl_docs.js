const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, 'downloads');
const PROFILE_DIR = path.join(__dirname, '.gprofile');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const SHEETS = [
  ['01_Budget_2026-27', '1s1LESuWg_Qub1gIJR75sLAINUjgy_qqzkujJmzr_PPI'],
  ['11_Market_Visit_Format', '1AU3nVzha-dpmKRXN6ZBnV5bxQ8O_5FLD_GeZ8Nm24oE'],
  ['12_Sales_Target_Achievement_Aug2026', '16DGYKr0X3sur5uc-ekqw_XW-kbmUtFdQTUbBlSYnoVo'],
  ['13_JD_ARMCL_Employees', '1jLSpTMDNz5iHt7PDBqOgcVzKEJKY6ldyRxqUrcREY64'],
  ['14_Sales_Manpower_Organogram', '1Z2QRR1W2oNC-fvbGT2LjztVDmNTORwEZ'],
  ['16_Trend_Analysis_Aug2026', '1DYBkmJEyaC1dNNtUK80InFw3GRUql3oyYObYtmcFgUM'],
  ['18_Daily_Production_Report', '18wNQ-5uz8Tt9RZCSRIPPT5SrL5lsHeyi'],
  ['22_Cost_Controlling', '1r1Da3-mm8LaTxnGtAzcKhBbkw0VDwn_RwRKAkLvgPms'],
  ['23_Diesel_Report', '1lVVZ4Iw9zbasAfmrnNDnKwvqZKBqdDz8NQMD5x8PPYo'],
];

const DOCS = [
  ['02_5_Years_Plan', '1jelyBUv3CSPYLwoNC-SbP3lrqCMYbALikQTw20txMMo'],
  ['20_SOP_Production', '18xljt0Fj7yYjLDl6CuYdIxaDFQF4U3K-9Bpscv83wj8'],
  ['21_Work_Details', '120ghGgexvf0Mlqd35y0klV8K0lloy8fNPhASk2Y8B0E'],
];

const FOLDER_ID = '15l1-fB_dfFcOS7nIlVHZV5GLHcDg7zpF';

async function downloadViaPage(page, url, file) {
  try {
    const [dl] = await Promise.all([
      page.waitForEvent('download', { timeout: 120000 }),
      page.goto(url, { waitUntil: 'commit' }).catch(() => {}),
    ]);
    await dl.saveAs(path.join(OUT_DIR, file));
    console.log(`OK   ${file}`);
    return true;
  } catch (e) {
    console.log(`FAIL ${file} | page url: ${page.url()}`);
    return false;
  }
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    executablePath: CHROME,
    viewport: null,
    args: ['--disable-blink-features=AutomationControlled', '--start-maximized'],
  });

  const page = ctx.pages()[0] || (await ctx.newPage());

  await page
    .goto('https://docs.google.com/document/u/0/', { waitUntil: 'domcontentloaded' })
    .catch(() => {});

  if (/accounts\.google\.com/.test(page.url())) {
    console.log('Not signed in. Log in to Google in the opened Chrome window (waiting up to 10 min)...');
    try {
      await page.waitForURL(/docs\.google\.com\/document\/u\/\d+\//, { timeout: 600000 });
    } catch {
      console.log('Login not detected, continuing anyway...');
    }
  }
  console.log('Session ready. Current URL:', page.url());

  const probeUrl = `https://docs.google.com/document/d/${DOCS[0][1]}/edit`;
  await page.goto(probeUrl, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(5000);
  console.log(`Probe "${DOCS[0][0]}": url=${page.url()} title="${await page.title().catch(() => '')}"`);
  await page.screenshot({ path: path.join(OUT_DIR, '_probe.png') }).catch(() => {});

  for (const [name, id] of SHEETS) {
    await downloadViaPage(page, `https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`, `${name}.xlsx`);
  }
  for (const [name, id] of DOCS) {
    await downloadViaPage(page, `https://docs.google.com/document/d/${id}/export?format=docx`, `${name}.docx`);
  }

  await page
    .goto(`https://drive.google.com/embeddedfolderview?id=${FOLDER_ID}#list`, { waitUntil: 'domcontentloaded' })
    .catch(() => {});
  await page.waitForTimeout(3000);
  const html = await page.content().catch(() => '');
  if (html) {
    fs.writeFileSync(path.join(OUT_DIR, '10_SOP_Policy_folder.html'), html);
    const ids = [...new Set([...html.matchAll(/\/file\/d\/([\w-]+)/g)].map((m) => m[1]))];
    fs.writeFileSync(path.join(OUT_DIR, '10_folder_file_ids.txt'), ids.join('\n'));
    console.log(`OK   folder listing (${ids.length} file ids)`);
  } else {
    console.log('FAIL folder listing');
  }

  await ctx.close();
  console.log('Done.');
})();
