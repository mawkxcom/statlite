import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sdkJs = path.join(root, 'sdk', 'dist', 'index.global.js');
const sdkMap = path.join(root, 'sdk', 'dist', 'index.global.js.map');
const outDir = path.join(root, 'public', 'statlite');

if (!fs.existsSync(sdkJs)) {
  console.error('[statlite] SDK build output not found:', sdkJs);
  process.exit(0);
}

fs.mkdirSync(outDir, { recursive: true });
fs.copyFileSync(sdkJs, path.join(outDir, 'index.global.js'));
if (fs.existsSync(sdkMap)) {
  fs.copyFileSync(sdkMap, path.join(outDir, 'index.global.js.map'));
}
console.log('[statlite] Copied SDK to', outDir);


