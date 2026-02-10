import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(__dirname, '..');

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
  arch: string;
  destDir: string;
}

export function getPlatformInfo(): PlatformInfo {
  // 支持通过环境变量强制指定平台（用于 Git Bash/MinGW 环境）
  const envPlatform = process.env.FRPS_PLATFORM || process.env.FRPC_PLATFORM || process.env.PLATFORM;
  let platform: NodeJS.Platform = process.platform;
  let arch = process.arch;

  // 如果设置了环境变量，使用指定的平台
  if (envPlatform) {
    platform = envPlatform as NodeJS.Platform;
  }

  // 在 Git Bash/MinGW 环境中，process.platform 可能是 'linux'，但实际在 Windows 上
  // 检测 Windows 的其他方式
  if (platform === 'linux') {
    // 检查是否有 Windows 系统路径
    if (process.env.WINDIR || process.env.COMSPEC?.includes('Windows') || process.env.PATH?.includes('\\')) {
      platform = 'win32';
    }
  }

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
  return `@feng3d/frpc-${platformName}-${archName}`;
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
  const binaryName = platform === 'win32' ? 'frpc.exe' : 'frpc';
  const platformPackageName = getPlatformPackageName(platform, arch);

  // 尝试多个可能的路径来找到平台包
  const possiblePaths = [
    // 同级 @feng3d namespace 目录 (最常见的 npx/npm 安装方式)
    path.join(path.dirname(packageDir), platformPackageName, binaryName),
    // 包的 node_modules 中
    path.join(packageDir, 'node_modules', platformPackageName, binaryName),
    // 传统 node_modules 结构
    path.join(packageDir, '..', 'node_modules', platformPackageName, binaryName),
    // 从当前目录向上查找 node_modules
    path.resolve(process.cwd(), 'node_modules', platformPackageName, binaryName),
    // 额外的兜底路径
    path.join(packageDir, '..', '..', '..', 'node_modules', platformPackageName, binaryName),
  ];

  for (const testPath of possiblePaths) {
    try {
      await fs.access(testPath);
      return testPath;
    } catch {
      // 继续尝试下一个路径
    }
  }

  // 如果所有路径都失败，抛出错误
  throw new Error(
    `无法找到平台包 ${platformPackageName} 中的二进制文件 ${binaryName}\n` +
    `已尝试的路径:\n${possiblePaths.map(p => '  - ' + p).join('\n')}\n\n` +
    `提示: 如果在 Git Bash/MinGW 中使用，请设置环境变量:\n` +
    `  export FRPC_PLATFORM=win32`
  );
}
