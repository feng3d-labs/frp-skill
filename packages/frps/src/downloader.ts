import fs from 'fs/promises';
import path from 'path';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import tar from 'tar';

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
  const { version, platform = process.platform, arch = process.arch, destDir, onProgress } = options;

  // 确保 destDir 存在
  await fs.mkdir(destDir, { recursive: true });

  // 构建下载 URL
  const url = buildDownloadUrl(version, platform, arch);

  // 确定文件扩展名
  const ext = platform === 'win32' ? 'zip' : 'tar.gz';
  const tarballPath = path.join(destDir, `frp.${ext}`);

  // 下载文件
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
