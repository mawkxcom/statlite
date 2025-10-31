#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import readline from 'node:readline';

const root = process.cwd();
const CONFIG_FILE = path.join(root, 'deploy.config.json');

// Default config template
const DEFAULT_CONFIG = {
  host: '',
  port: 22,
  username: '',
  password: '', // or empty if using keyFile
  keyFile: '', // path to SSH private key (e.g. ~/.ssh/id_rsa)
  remoteDir: '/opt/statlite',
  runMode: 'systemd', // 'systemd' or 'command'
  useNvm: false,
  nvmNodeVersion: '18' // or 'lts', 'node', etc.
};

function loadConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')) };
  }
  return { ...DEFAULT_CONFIG };
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  console.log(`[deploy] config saved to ${CONFIG_FILE}`);
}

async function prompt(question, defaultValue = '') {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${question}${defaultValue ? ` [${defaultValue}]` : ''}: `, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue);
    });
  });
}

async function interactiveConfig(config) {
  console.log('[deploy] interactive configuration...');
  config.host = await prompt('Server IP/hostname', config.host);
  config.port = Number(await prompt('SSH port', String(config.port)));
  config.username = await prompt('SSH username', config.username);
  
  const authMode = await prompt('Auth mode (password/keyfile)', config.keyFile ? 'keyfile' : 'password');
  if (authMode === 'keyfile') {
    config.keyFile = await prompt('Path to SSH private key', config.keyFile || '~/.ssh/id_rsa');
    config.password = '';
  } else {
    console.log('[deploy] Password auth: SSH will prompt interactively during connection.');
    config.password = '';
    config.keyFile = '';
  }

  config.remoteDir = await prompt('Remote directory', config.remoteDir);
  config.runMode = await prompt('Run mode (systemd/command)', config.runMode);
  config.useNvm = (await prompt('Use nvm? (yes/no)', config.useNvm ? 'yes' : 'no')) === 'yes';
  if (config.useNvm) {
    config.nvmNodeVersion = await prompt('nvm node version', config.nvmNodeVersion);
  }

  const save = await prompt('Save config to deploy.config.json? (yes/no)', 'yes');
  if (save === 'yes') {
    saveConfig(config);
  }
  return config;
}

function exec(cmd, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, { shell: true, stdio: 'inherit', ...opts });
    p.on('close', (code) => {
      if (code !== 0) return reject(new Error(`Command failed: ${cmd}`));
      resolve();
    });
  });
}

async function deploy() {
  console.log('[deploy] starting deployment...');

  // 1) Load or prompt config
  let config = loadConfig();
  const needInteractive = !config.host || !config.username;
  if (needInteractive) {
    config = await interactiveConfig(config);
  } else {
    console.log('[deploy] using config from deploy.config.json');
  }

  // 2) Build release
  console.log('[deploy] building release...');
  await exec('npm run release');

  const releaseDir = path.join(root, 'release');
  if (!fs.existsSync(releaseDir)) {
    throw new Error('release/ not found. Run npm run release first.');
  }

  // 3) Prepare SSH/SCP options
  const sshOpts = [];
  const scpOpts = [];
  sshOpts.push(`-p ${config.port}`);
  scpOpts.push(`-P ${config.port}`); // SCP uses uppercase -P for port
  if (config.keyFile) {
    const keyPath = config.keyFile.replace(/^~/, process.env.HOME || '');
    sshOpts.push(`-i ${keyPath}`);
    scpOpts.push(`-i ${keyPath}`);
  }
  const sshOptsStr = sshOpts.join(' ');
  const scpOptsStr = scpOpts.join(' ');

  const userHost = `${config.username}@${config.host}`;

  // 4) Upload release/ to remote
  console.log(`[deploy] uploading release/ to ${userHost}:${config.remoteDir}-tmp ...`);
  // First create remote temp dir, then upload release/* into it
  const mkdirCmd = `ssh ${sshOptsStr} ${userHost} 'mkdir -p ${config.remoteDir}-tmp'`;
  await exec(mkdirCmd);
  const scpCmd = `scp -r ${scpOptsStr} ${releaseDir}/* ${userHost}:${config.remoteDir}-tmp/`;
  await exec(scpCmd);

  // 5) SSH: install deps, move to final location, start service
  console.log('[deploy] installing dependencies and starting service on remote...');

  const nvmInit = config.useNvm
    ? `source ~/.nvm/nvm.sh && nvm install ${config.nvmNodeVersion} && nvm use ${config.nvmNodeVersion} &&`
    : '';

  const remoteScript = `
set -e
cd ${config.remoteDir}-tmp/server
${nvmInit} npm install --omit=dev
cd ${config.remoteDir}-tmp
sudo mkdir -p ${config.remoteDir}
sudo cp -rf * ${config.remoteDir}/
cd ${config.remoteDir}
${config.runMode === 'systemd' ? `
  sudo cp statlite.service /etc/systemd/system/statlite.service
  sudo systemctl daemon-reload
  sudo systemctl restart statlite
  sudo systemctl enable statlite
  sudo systemctl status statlite --no-pager
` : `
  nohup ${nvmInit} ./start.sh > statlite.log 2>&1 &
  echo "Started statlite in background. Check statlite.log"
`}
rm -rf ${config.remoteDir}-tmp
  `.trim();

  const sshCmd = `ssh ${sshOptsStr} ${userHost} '${remoteScript}'`;

  await exec(sshCmd);

  console.log('[deploy] deployment completed successfully!');
}

deploy().catch((err) => {
  console.error('[deploy] ERROR:', err.message);
  process.exit(1);
});

