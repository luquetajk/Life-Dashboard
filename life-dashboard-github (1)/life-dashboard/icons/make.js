const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
(async () => {
  const b = await chromium.launch(); const D = __dirname;
  const jobs = [['icon.svg', 'icon-192.png', 192], ['icon.svg', 'icon-512.png', 512], ['icon-maskable.svg', 'icon-maskable-512.png', 512], ['icon-maskable.svg', 'apple-touch-icon.png', 180]];
  for (const [src, out, n] of jobs) {
    const p = await b.newPage({ viewport: { width: n, height: n }, deviceScaleFactor: 1 });
    const svg = fs.readFileSync(path.join(D, src), 'utf8');
    await p.setContent('<body style="margin:0;background:transparent">' + svg.replace('<svg ', '<svg width="' + n + '" height="' + n + '" ') + '</body>');
    await p.screenshot({ path: path.join(D, out), omitBackground: true, clip: { x: 0, y: 0, width: n, height: n } });
    await p.close();
  }
  await b.close(); console.log('icons ok');
})();
