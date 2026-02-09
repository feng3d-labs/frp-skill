#!/usr/bin/env node
/**
 * 下载 frp 二进制文件用于 E2E 测试
 * 在 npm install 时自动运行
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const binariesDir = path.join(rootDir, 'binaries');

const FRP_VERSION = '0.67.0';

/**
 * 获取当前平台信息
 */
function getPlatformInfo() {
  const platform = process.platform;
  const arch = process.arch === 'arm64' ? 'arm64' : 'amd64';
  const platformName = platform === 'win32' ? 'windows' : platform;
  const ext = platform === 'win32' ? 'zip' : 'tar.gz';
  const binaryExt = platform === 'win32' ? '.exe' : '';

  return { platform, arch, platformName, ext, binaryExt };
}

/**
 * 下载文件
 */
async function downloadFile(url, destPath) {
  console.log(`下载: ${url}`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`下载失败: ${response.status} ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  await fs.writeFile(destPath, Buffer.from(buffer));
  console.log('下载完成');
}

/**
 * 解压 tar.gz 文件
 */
async function extractTar(tarballPath, destDir) {
  const tar = await import('tar');
  await fs.mkdir(destDir, { recursive: true });
  await tar.extract({
    file: tarballPath,
    cwd: destDir
  });
}

/**
 * 解压 zip 文件 (Windows)
 */
async function extractZip(zipPath, destDir) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { Extract } = await import('unzipper') as any;
  await fs.mkdir(destDir, { recursive: true });
  await pipeline(
    createReadStream(zipPath),
    Extract({ path: destDir })
  );
}

/**
 * 主函数
 */
async function main() {
  const { platformName, arch, ext, binaryExt } = getPlatformInfo();

  console.log(`\n准备下载 frp ${FRP_VERSION} 二进制文件...`);
  console.log(`平台: ${platformName} ${arch}\n`);

  // 确保目录存在
  await fs.mkdir(binariesDir, { recursive: true });

  // 检查是否已存在
  const frpsBinary = path.join(binariesDir, `frps${binaryExt}`);
  const frpcBinary = path.join(binariesDir, `frpc${binaryExt}`);

  try {
    await fs.access(frpsBinary);
    await fs.access(frpcBinary);
    console.log('二进制文件已存在，跳过下载\n');
    return;
  } catch {
    // 继续下载
  }

  // 下载 URL
  const baseUrl = `https://github.com/fatedier/frp/releases/download/v${FRP_VERSION}`;
  const tarballUrl = `${baseUrl}/frp_${FRP_VERSION}_${platformName}_${arch}.${ext}`;

  // 下载压缩包
  const tarballPath = path.join(binariesDir, `frp.${ext}`);
  await downloadFile(tarballUrl, tarballPath);

  // 解压
  console.log('解压中...');
  const extractDir = path.join(binariesDir, 'extracted');

  if (ext === 'zip') {
    await extractZip(tarballPath, extractDir);
  } else {
    await extractTar(tarballPath, extractDir);
  }

  console.log('解压完成');

  // 找到解压后的目录
  const files = await fs.readdir(extractDir);
  const frpDir = files.find(f => f.startsWith('frp_'));

  if (!frpDir) {
    throw new Error('未找到解压后的 frp 目录');
  }

  const binaryDir = path.join(extractDir, frpDir);

  // 复制二进制文件
  await fs.copyFile(
    path.join(binaryDir, `frps${binaryExt}`),
    frpsBinary
  );
  await fs.copyFile(
    path.join(binaryDir, `frpc${binaryExt}`),
    frpcBinary
  );

  // 添加执行权限 (非 Windows)
  if (process.platform !== 'win32') {
    await fs.chmod(frpsBinary, 0o755);
    await fs.chmod(frpcBinary, 0o755);
  }

  // 清理
  await fs.rm(tarballPath, { force: true });
  await fs.rm(extractDir, { recursive: true, force: true });

  console.log('\n✓ 二进制文件已下载到:');
  console.log(`  - ${frpsBinary}`);
  console.log(`  - ${frpcBinary}\n`);
}

// 运行
main().catch(err => {
  console.error('下载失败:', err.message);
  process.exit(1);
});
