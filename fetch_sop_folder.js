const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, 'downloads', '10_SOP_and_Policy');
const PROFILE_DIR = path.join(__dirname, '.gprofile');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function sanitize(s) {
  return s.replace(/[\\/:*?"<>|]/g, '_').slice(0, 120);
}

async function listFolder(page, folderId) {
  const url = `https://drive.google.com/embeddedfolderview?id=${folderId}#list`;
  await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForTimeout(2000);
  const html = await page.content().catch(() => '');
  const entries = [];
  const re = /href="https:\/\/drive\.google\.com\/(file\/d\/([\w-]+)|drive\/folders\/([\w-]+))[^"]*"[^>]*>[\s\S]*?flip-entry-title">([^<]+)</g;
  let m;
  while ((m = re.exec(html))) {
    entries.push({ kind: m[2] ? 'file' : 'folder', id: m[2] || m[3], title: m[4] });
  }
  return entries;
}

async function downloadFile(page, id, title) {
  const safe = sanitize(title);
  const isNativeSheetDoc = false;
  const candidates = [
    `https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`,
    `https://drive.google.com/uc?export=download&id=${id}`,
  ];
  for (const url of candidates) {
    try {
      const [dl] = await Promise.all([
        page.waitForEvent('download', { timeout: 60000 }),
        page.goto(url, { waitUntil: 'commit' }).catch(() => {}),
      ]);
      const suggested = dl.suggestedFilename() || safe;
      const finalName = /\.\w+$/.test(safe) ? safe : suggested.replace(/[\\/:*?"<>|]/g, '_');
      await dl.saveAs(path.join(OUT_DIR, finalName));
      console.log(`OK   ${finalName}`);
      return true;
    } catch {
      // try next candidate
    }
  }
  console.log(`FAIL ${title} (${id})`);
  return false;
}

async function walk(page, folderId, prefix) {
  const entries = await listFolder(page, folderId);
  console.log(`${prefix}folder ${folderId}: ${entries.length} entries`);
  for (const e of entries) {
    if (e.kind === 'file') {
      await downloadFile(page, e.id, e.title);
    } else {
      await walk(page, e.id, prefix + '  ');
    }
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

  await page.goto('https://drive.google.com/', { waitUntil: 'domcontentloaded' }).catch(() => {});
  if (/accounts\.google\.com/.test(page.url())) {
    console.log('Not signed in. Log in within 10 min...');
    await page.waitForURL(/drive\.google\.com/, { timeout: 600000 }).catch(() => {});
  }

  await walk(page, '15l1-fB_dfFcOS7nIlVHZV5GLHcDg7zpF', '');

  await ctx.close();
  console.log('Done.');
})();
