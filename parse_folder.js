const fs = require('fs');
const h = fs.readFileSync('downloads/10_SOP_Policy_folder.html', 'utf8');
const re = /href="https:\/\/drive\.google\.com\/(file\/d\/([\w-]+)|drive\/folders\/([\w-]+))[^"]*"[^>]*>(?:<div class="flip-entry-visual">)?[\s\S]*?flip-entry-title">([^<]+)</g;
let m;
while ((m = re.exec(h))) {
  console.log(m[2] ? 'FILE  ' : 'FOLDER', m[2] || m[3], '|', m[4]);
}
