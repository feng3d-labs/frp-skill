import fs from 'fs/promises';
import path from 'path';
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
 * 获取平台包中的二进制文件路径
 *
 * 统一使用 npm 平台包中的二进制文件：
 * - npm 镜像缓存，下载更快
 * - 避免直接访问 GitHub（国内网络友好）
 * - 平台包通过 optionalDependencies 自动安装
 */
export async function getBinaryPath(platform: NodeJS.Platform, arch: string): Promise<string> {
  const binaryName = platform === 'win32' ? 'frps.exe' : 'frps';
  const platformPackageName = getPlatformPackageName(platform, arch);

  // 从 node_modules 中查找平台包
  const platformPkgPath = path.join(workspaceRoot, 'node_modules', platformPackageName, binaryName);

  await fs.access(platformPkgPath);
  return platformPkgPath;
}
