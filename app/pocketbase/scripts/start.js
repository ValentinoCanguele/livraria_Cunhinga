import { spawn, execSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const pbDir = path.join(rootDir, 'pb');
const pbDataDir = path.join(rootDir, 'pb_data');
const PB_VERSION = '0.27.2';

function getPlatformKey() {
  const arch = process.arch === 'arm64' ? 'arm64' : 'amd64';
  if (process.platform === 'darwin') return `pocketbase_${PB_VERSION}_darwin_${arch}.zip`;
  if (process.platform === 'linux') return `pocketbase_${PB_VERSION}_linux_${arch}.zip`;
  if (process.platform === 'win32') return `pocketbase_${PB_VERSION}_windows_${arch}.zip`;
  throw new Error(`Unsupported platform: ${process.platform}`);
}

function getBinaryName() {
  return process.platform === 'win32' ? 'pocketbase.exe' : 'pocketbase';
}

async function downloadPocketBase() {
  const zipName = getPlatformKey();
  const url = `https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/${zipName}`;
  const zipPath = path.join(rootDir, zipName);
  const binaryPath = path.join(pbDir, getBinaryName());

  mkdirSync(pbDir, { recursive: true });
  if (existsSync(binaryPath)) return binaryPath;

  console.log(`Downloading PocketBase ${PB_VERSION}...`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download PocketBase: ${response.statusText}`);

  writeFileSync(zipPath, Buffer.from(await response.arrayBuffer()));
  console.log('Extracting PocketBase...');

  if (process.platform === 'win32') {
    execSync(`powershell -command "Expand-Archive -Path '${zipPath}' -DestinationPath '${pbDir}' -Force"`);
  } else {
    execSync(`unzip -o "${zipPath}" -d "${pbDir}"`);
    chmodSync(binaryPath, 0o755);
  }

  unlinkSync(zipPath);
  return binaryPath;
}

async function main() {
  mkdirSync(pbDataDir, { recursive: true });
  const binary = await downloadPocketBase();

  console.log('Starting PocketBase at http://127.0.0.1:8090');
  console.log('Admin UI: http://127.0.0.1:8090/_/');

  const child = spawn(binary, [
    'serve',
    '--dir', pbDataDir,
    '--http=127.0.0.1:8090',
    '--hooksWatch=false',
  ], {
    cwd: rootDir,
    stdio: 'inherit',
  });

  child.on('exit', (code) => process.exit(code ?? 0));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
