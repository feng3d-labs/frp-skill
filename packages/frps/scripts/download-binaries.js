#!/usr/bin/env node
/**
 * 下载各平台的 frp 二进制文件到对应平台包目录
 * 用途：打包到独立的平台包中
 */

import fs from 'fs/promises';
import path from 'path';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import tar from 'tar';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');
const packagesDir = path.resolve(rootDir, 'packages');

const VERSION = '0.67.0';
const PLATFORMS = [
  { name: 'linux-x64', platform: 'linux', arch: 'amd64', ext: 'tar.gz', pkgDir: 'frps-linux-x64', binary: 'frps' },
  { name: 'linux-arm64', platform: 'linux', arch: 'arm64', ext: 'tar.gz', pkgDir: 'frps-linux-arm64', binary: 'frps' },
  { name: 'win32-x64', platform: 'windows', arch: 'amd64', ext: 'zip', pkgDir: 'frps-win32-x64', binary: 'frps.exe' },
  { name: 'darwin-x64', platform: 'darwin', arch: 'amd64', ext: 'tar.gz', pkgDir: 'frps-darwin-x64', binary: 'frps' },
  { name: 'darwin-arm64', platform: 'darwin', arch: 'arm64', ext: 'tar.gz', pkgDir: 'frps-darwin-arm64', binary: 'frps' },
];

function buildUrl(platform, arch, ext) {
  const platformName = platform === 'windows' ? 'windows' : platform;
  const archName = arch === 'amd64' ? 'amd64' : 'arm64';
  const filename = `frp_${VERSION}_${platformName}_${archName}`;
  return `https://github.com/fatedier/frp/releases/download/v${VERSION}/${filename}.${ext}`;
}

async function downloadFile(url, destPath) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`下载失败: ${response.status} ${response.statusText}`);
  }

  const fileStream = createWriteStream(destPath);
  await pipeline(response.body, fileStream);
}

async function extractTar(tarPath, destDir) {
  await tar.extract({ file: tarPath, cwd: destDir });
}

async function extractZip(zipPath, destDir) {
  const { Extract } = await import('unzipper');
  const { createReadStream } = await import('fs');
  const { pipeline } = await import('stream/promises');

  await pipeline(
    createReadStream(zipPath),
    Extract({ path: destDir })
  );
}

async function downloadPlatform(platform) {
  const { name, platform: p, arch, ext, pkgDir, binary } = platform;
  const url = buildUrl(p, arch, ext);
  const destPkgDir = path.join(packagesDir, pkgDir);

  console.log(`下载 ${name}...`);

  // 创建临时目录
  const tmpDir = path.join(packagesDir, `tmp-${name}`);
  await fs.mkdir(tmpDir, { recursive: true });

  try {
    // 下载
    const archivePath = path.join(tmpDir, `frp.${ext}`);
    await downloadFile(url, archivePath);

    // 解压
    if (ext === 'tar.gz') {
      await extractTar(archivePath, tmpDir);
    } else {
      await extractZip(archivePath, tmpDir);
    }

    // 查找解压后的目录
    const files = await fs.readdir(tmpDir);
    const frpDir = files.find(f => f.startsWith('frp_'));

    if (!frpDir) {
      throw new Error('未找到 frp 目录');
    }

    const extractedDir = path.join(tmpDir, frpDir);

    // 复制二进制文件到平台包目录
    const srcBinary = path.join(extractedDir, binary);
    const destBinary = path.join(destPkgDir, binary);

    await fs.copyFile(srcBinary, destBinary);

    // 设置执行权限（非 Windows）
    if (p !== 'windows') {
      await fs.chmod(destBinary, 0o755);
    }

    // 清理
    await fs.rm(tmpDir, { recursive: true, force: true });

    // 获取文件大小
    const stats = await fs.stat(destBinary);
    console.log(`  ✓ ${name} -> ${pkgDir}/ (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

  } catch (error) {
    await fs.rm(tmpDir, { recursive: true, force: true });
    throw error;
  }
}

async function main() {
  console.log(`开始下载 frp ${VERSION} 二进制文件...\n`);

  // 并发下载所有平台
  await Promise.all(PLATFORMS.map(downloadPlatform));

  console.log('\n所有平台二进制文件下载完成！');
}

main().catch(console.error);
