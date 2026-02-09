import fs from 'fs/promises';
import path from 'path';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import tar from 'tar';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(packageDir, '..');

export interface PlatformInfo {
  platform: NodeJS.Platform;
  arch: string;
  isWindows: boolean;
  isLinux: boolean;
  isMac: boolean;
}

export interface DownloadOptions {
  version: string;
  platform?: NodeJS.Platform;
  arch?: string;
  destDir: string;
  onProgress?: (progress: number) => void;
  useLocalBinary?: boolean;
}

export function getPlatformInfo(): PlatformInfo {
  const platform = process.platform;
  const arch = process.arch;

  return {
    platform,
    arch,
    isWindows: platform === 'win32',
    isLinux: platform === 'linux',
    isMac: platform === 'darwin'
  };
}

export function getPlatformPackageName(platform: NodeJS.Platform, arch: string): string {
  const platformName = platform;
  const archName = arch === 'arm64' ? 'arm64' : 'x64';
  return `@feng3d/frps-${platformName}-${archName}`;
}

/**
 * 检查平台包中是否已存在二进制文件
 * 优先查找已安装的平台包（通过 optionalDependencies）
 */
export async function getLocalBinary(platform: NodeJS.Platform, arch: string): Promise<string | null> {
  const binaryName = platform === 'win32' ? 'frps.exe' : 'frps';
  const platformPackageName = getPlatformPackageName(platform, arch);

  // 尝试从 node_modules 中查找平台包
  const platformPkgPath = path.join(workspaceRoot, 'node_modules', platformPackageName, binaryName);

  try {
    await fs.access(platformPkgPath);
    return platformPkgPath;
  } catch {
    // 如果 node_modules 中没有，尝试从本地 packages 目录查找（开发环境）
    const localPlatformPkg = path.join(workspaceRoot, 'packages', platformPackageName.replace('@feng3d/frps-', 'frps-'), binaryName);
    try {
      await fs.access(localPlatformPkg);
      return localPlatformPkg;
    } catch {
      return null;
    }
  }
}

export function buildDownloadUrl(
  version: string,
  platform: NodeJS.Platform,
  arch: string
): string {
  const platformName = platform === 'win32' ? 'windows' : platform;
  const archName = arch === 'arm64' ? 'arm64' : 'amd64';
  const ext = platform === 'win32' ? 'zip' : 'tar.gz';
  const filename = `frp_${version}_${platformName}_${archName}`;

  return `https://github.com/fatedier/frp/releases/download/v${version}/${filename}.${ext}`;
}

export async function downloadWithProgress(
  url: string,
  destPath: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const totalSize = Number(response.headers.get('content-length') || 0);
  const reader = response.body?.getReader();

  if (!reader) {
    throw new Error('无法获取响应流');
  }

  const fileStream = createWriteStream(destPath);
  let downloadedSize = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      downloadedSize += value.length;
      if (totalSize > 0 && onProgress) {
        onProgress((downloadedSize / totalSize) * 100);
      }

      fileStream.write(value);
    }
  } finally {
    fileStream.end();
  }
}

export async function downloadFrps(options: DownloadOptions): Promise<string> {
  const {
    version,
    platform = process.platform,
    arch = process.arch,
    destDir,
    onProgress,
    useLocalBinary = true
  } = options;

  // 确保 destDir 存在
  await fs.mkdir(destDir, { recursive: true });

  // 首先尝试使用本地二进制文件
  if (useLocalBinary) {
    const localBinary = await getLocalBinary(platform, arch);
    if (localBinary) {
      return localBinary;
    }
  }

  // 下载二进制文件
  const url = buildDownloadUrl(version, platform, arch);
  const ext = platform === 'win32' ? 'zip' : 'tar.gz';
  const tarballPath = path.join(destDir, `frp.${ext}`);

  await downloadWithProgress(url, tarballPath, onProgress);

  return tarballPath;
}

export async function extractTar(tarballPath: string, destDir: string): Promise<string> {
  await fs.mkdir(destDir, { recursive: true });

  await tar.extract({
    file: tarballPath,
    cwd: destDir
  });

  // 查找解压后的目录
  const files = await fs.readdir(destDir);
  const frpDir = files.find(f => f.startsWith('frp_'));
  if (!frpDir) {
    throw new Error('未找到解压后的 frp 目录');
  }

  return path.join(destDir, frpDir);
}

export async function extractZip(zipPath: string, destDir: string): Promise<string> {
  await fs.mkdir(destDir, { recursive: true });

  // 使用动态导入 unzipper
  const { Extract } = await import('unzipper');
  const { createReadStream } = await import('fs');
  const { pipeline } = await import('stream/promises');

  await pipeline(
    createReadStream(zipPath),
    Extract({ path: destDir })
  );

  // 查找解压后的目录
  const files = await fs.readdir(destDir);
  const frpDir = files.find(f => f.startsWith('frp_'));
  if (!frpDir) {
    throw new Error('未找到解压后的 frp 目录');
  }

  return path.join(destDir, frpDir);
}
