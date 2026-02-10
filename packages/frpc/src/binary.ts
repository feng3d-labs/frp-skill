import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import { execaCommand } from 'execa';

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
 * 获取命名空间名称（从包路径中提取 @feng3d）
 */
function getNamespaceName(): string {
  const parentDir = path.dirname(packageDir);
  const basename = path.basename(parentDir);
  // 如果父目录是 @feng3d，直接返回；否则向上查找
  if (basename.startsWith('@')) {
    return basename;
  }
  // 尝试从 packageDir 向上查找 @scope 目录
  const parts = packageDir.split(path.sep);
  for (let i = parts.length - 1; i >= 0; i--) {
    if (parts[i].startsWith('@')) {
      return parts[i];
    }
  }
  return '@feng3d'; // 默认值
}

/**
 * 从 npm registry 下载平台包的 tarball
 */
async function downloadPlatformPackage(platformPackageName: string): Promise<Buffer> {
  // 使用 npm pack 下载 tarball 到临时目录
  const tmpDir = os.tmpdir();
  const tempDownloadDir = path.join(tmpDir, `npm-download-${Date.now()}`);
  await fs.mkdir(tempDownloadDir, { recursive: true });

  try {
    // 使用 npm pack 下载包
    await execaCommand(`npm pack ${platformPackageName}`, {
      cwd: tempDownloadDir,
      stdio: 'pipe'
    });

    // 查找下载的 tarball 文件
    // npm pack 会把 @feng3d/xxx 转换为 feng3d-xxx-version.tgz
    const files = await fs.readdir(tempDownloadDir);
    const tarballFile = files.find(f => f.endsWith('.tgz'));

    if (!tarballFile) {
      throw new Error(`下载的 tarball 文件未找到`);
    }

    const tarballPath = path.join(tempDownloadDir, tarballFile);
    const tarballBuffer = await fs.readFile(tarballPath);

    // 清理临时文件
    await fs.rm(tempDownloadDir, { recursive: true, force: true });

    return tarballBuffer;
  } catch (error) {
    // 清理临时文件
    await fs.rm(tempDownloadDir, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

/**
 * 从 tarball 中提取二进制文件到临时目录
 */
async function extractBinaryFromTarball(tarballBuffer: Buffer, binaryName: string): Promise<string> {
  const tmpDir = os.tmpdir();
  const extractDir = path.join(tmpDir, `frpc-${Date.now()}`);

  await fs.mkdir(extractDir, { recursive: true });

  // 使用 tar 提取
  const { extract: tarExtract } = await import('tar');
  const { Readable } = await import('stream');

  return new Promise((resolve, reject) => {
    const stream = Readable.from(tarballBuffer);
    stream.pipe(
      tarExtract({
        cwd: extractDir,
        strip: 1 // 去掉 'package/' 前缀
      }, [binaryName])
    ).on('error', reject).on('end', () => {
      const extractedPath = path.join(extractDir, binaryName);
      resolve(extractedPath);
    });
  });
}

/**
 * 获取平台包中的二进制文件路径
 *
 * 统一使用 npm 平台包中的二进制文件：
 * - npm 镜像缓存，下载更快
 * - 避免直接访问 GitHub（国内网络友好）
 * - 平台包通过 optionalDependencies 自动安装
 *
 * 如果平台包不存在，会自动从 npm registry 下载
 */
export async function getBinaryPath(platform: NodeJS.Platform, arch: string): Promise<string> {
  const binaryName = platform === 'win32' ? 'frpc.exe' : 'frpc';
  const platformPackageName = getPlatformPackageName(platform, arch);

  // 获取父级命名空间目录名称（如 @feng3d）
  const namespaceName = getNamespaceName();

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
    // 嵌套命名空间路径: node_modules/@feng3d/@feng3d/frpc-PLATFORM-ARCH
    path.join(path.dirname(packageDir), namespaceName, platformPackageName, binaryName),
    path.join(packageDir, 'node_modules', namespaceName, platformPackageName, binaryName),
    path.join(packageDir, '..', 'node_modules', namespaceName, platformPackageName, binaryName),
    path.resolve(process.cwd(), 'node_modules', namespaceName, platformPackageName, binaryName),
    // 额外的兜底路径
    path.join(packageDir, '..', '..', '..', 'node_modules', platformPackageName, binaryName),
    path.join(packageDir, '..', '..', '..', 'node_modules', namespaceName, platformPackageName, binaryName),
  ];

  for (const testPath of possiblePaths) {
    try {
      await fs.access(testPath);
      return testPath;
    } catch {
      // 继续尝试下一个路径
    }
  }

  // 所有路径都失败，尝试从 npm 下载平台包
  console.warn(`平台包 ${platformPackageName} 未找到，正在从 npm 下载...`);

  try {
    const tarballBuffer = await downloadPlatformPackage(platformPackageName);
    const extractedPath = await extractBinaryFromTarball(tarballBuffer, binaryName);
    console.warn(`已从 npm 下载 ${platformPackageName} 到临时目录`);
    return extractedPath;
  } catch (downloadError: unknown) {
    const errorMessage = downloadError instanceof Error ? downloadError.message : String(downloadError);
    // 下载也失败，抛出详细错误
    throw new Error(
      `无法找到平台包 ${platformPackageName} 中的二进制文件 ${binaryName}\n` +
      `已尝试的路径:\n${possiblePaths.map(p => '  - ' + p).join('\n')}\n\n` +
      `从 npm 下载也失败: ${errorMessage}\n\n` +
      `调试信息:\n` +
      `  packageDir: ${packageDir}\n` +
      `  namespaceName: ${namespaceName}\n` +
      `  platformPackageName: ${platformPackageName}\n` +
      `  current cwd: ${process.cwd()}\n\n` +
      `提示: 如果在 Git Bash/MinGW 中使用，请设置环境变量:\n` +
      `  export FRPC_PLATFORM=win32`
    );
  }
}
