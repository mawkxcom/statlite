import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();

function sh(cmd, args = [], opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', cwd: root, ...opts });
  if (r.status !== 0) {
    console.error(`[release] command failed:`, cmd, args.join(' '));
    process.exit(r.status ?? 1);
  }
}

console.log('[release] building workspaces...');
sh('npm', ['-w', '@statlite/server', 'run', 'build']);
sh('npm', ['-w', '@statlite/sdk', 'run', 'build']);

// postbuild copies sdk to public
sh('node', ['scripts/copy-sdk.mjs']);

const out = path.join(root, 'release');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

// files to include
const files = [
  // 将 dist 直接放入 release/server 下，便于直接运行 node server/index.js
  { src: 'server/dist', dest: 'server' },
  { src: 'public', dest: 'public' },
  { src: 'README.md', dest: 'README.md' },
  { src: 'server/package.json', dest: 'server/package.json' },
  { src: 'systemd/statlite.service', dest: 'statlite.service' }
];

for (const f of files) {
  const srcPath = path.join(root, f.src);
  const destPath = path.join(out, f.dest);
  const stat = fs.statSync(srcPath);
  if (stat.isDirectory()) {
    fs.mkdirSync(destPath, { recursive: true });
    for (const entry of fs.readdirSync(srcPath)) {
      const s = path.join(srcPath, entry);
      const d = path.join(destPath, entry);
      fs.cpSync(s, d, { recursive: true });
    }
  } else {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(srcPath, destPath);
  }
}

// install production deps into release/server so it can run standalone
const shouldInstall = process.env.RELEASE_INSTALL_DEPS === 'true';
if (shouldInstall) {
  console.log('[release] installing production dependencies into release/server ...');
  try {
    sh('npm', ['install', '--omit=dev', '--no-audit', '--no-fund'], { cwd: path.join(out, 'server') });
  } catch (e) {
    console.error('[release] failed to install deps inside release/server. You can run:');
    console.error('  (cd release/server && npm install --omit=dev)');
    throw e;
  }
} else {
  console.log('[release] skip installing deps locally (set RELEASE_INSTALL_DEPS=true to enable).');
  console.log('[release] On server, run: (cd server && npm install --omit=dev)');
}

// create a start script for convenience (avoid Node template interpolation by string pieces)
const startSh = [
  '#!/usr/bin/env bash',
  'set -euo pipefail',
  'DIR="$(cd "$(dirname "$0")" && pwd)"',
  'export STATLITE_DATA="' + '${STATLITE_DATA:-$DIR/data}' + '"',
  'PORT_ARG=""',
  'if [[ -n "' + '${PORT:-}' + '" ]]; then PORT_ARG="--port=' + '$PORT' + '"; fi',
  'if [[ -n "' + '${STATLITE_PORT:-}' + '" ]]; then PORT_ARG="--port=' + '$STATLITE_PORT' + '"; fi',
  'node "$DIR/server/index.js" $PORT_ARG "$@"'
].join('\n') + '\n';
fs.writeFileSync(path.join(out, 'start.sh'), startSh, { mode: 0o755 });

console.log('[release] bundle ready at ./release');
console.log('[release] copy ./release to server, then run ./start.sh');


