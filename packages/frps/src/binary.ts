import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(__dirname, '..');

const FRP_VERSION = '0.67.0';
// 缓存目录，用于存储下载的二进制文件
const CACHE_DIR = path.join(os.tmpdir(), '@feng3d-frps');

export interface PlatformInfo {
  platform: NodeJS.Platform;
  arch: string;
  isWindows: boolean;
  isLinux: boolean;
  isMac: boolean;
}

export function getPlatformInfo(): PlatformInfo {
  // 支持通过环境变量强制指定平台（用于 Git Bash/MinGW 环境）
  const envPlatform = process.env.FRPS_PLATFORM || process.env.PLATFORM;
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

/**
 * 获取缓存的二进制文件路径
 */
function getCachedBinaryPath(platform: NodeJS.Platform, arch: string): string {
  const platformName = platform === 'win32' ? 'windows' : platform;
  const archName = arch === 'arm64' ? 'arm64' : 'amd64';
  const binaryName = platform === 'win32' ? 'frps.exe' : 'frps';
  return path.join(CACHE_DIR, `${platformName}-${archName}`, binaryName);
}

/**
 * 下载文件
 */
async function downloadFile(url: string, destPath: string): Promise<void> {
  console.log(`正在从 GitHub 下载: ${url}`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`下载失败: ${response.status} ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  await fs.writeFile(destPath, Buffer.from(buffer));
  console.log(`下载完成`);
}

/**
 * 解压 tar.gz 文件
 */
async function extractTar(tarballPath: string, destDir: string): Promise<void> {
  const tar = await import('tar');
  await fs.mkdir(destDir, { recursive: true });
  await tar.extract({
    file: tarballPath,
    cwd: destDir
  });
}

/**
 * 解压 zip 文件 (Windows)
 * 使用 adm-zip 而不是 unzipper，因为 unzipper 包含 AWS SDK 依赖会导致打包问题
 */
async function extractZip(zipPath: string, destDir: string): Promise<void> {
  const AdmZip = (await import('adm-zip')).default;
  await fs.mkdir(destDir, { recursive: true });
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(destDir, true);
}

/**
 * 在 Windows 上为缓存目录添加 Defender 排除
 */
async function ensureDefenderExclusion(dir: string): Promise<void> {
  if (process.platform !== 'win32') return;

  // 检查是否已有排除
  try {
    const { execaCommand } = await import('execa');
    const { stdout } = await execaCommand(`powershell -Command "(Get-MpPreference).ExclusionPath"`, { stdio: 'pipe' });
    if (stdout && stdout.includes(dir)) return;
  } catch {
    // 无法检查，继续尝试添加
  }

  try {
    // 先尝试直接添加（当前用户可能已是管理员）
    const { execaCommand } = await import('execa');
    await execaCommand(`powershell -Command "Add-MpPreference -ExclusionPath '${dir}'"`, { stdio: 'pipe' });
  } catch {
    // 非管理员，通过 UAC 提权请求
    try {
      const { execaCommand } = await import('execa');
      const escapedDir = dir.replace(/'/g, "''");
      await execaCommand(
        `powershell -Command "Start-Process powershell -ArgumentList '-Command','Add-MpPreference -ExclusionPath ''${escapedDir}''' -Verb RunAs -Wait"`,
        { stdio: 'pipe' }
      );
    } catch {
      // 用户拒绝 UAC 或其他错误
    }
  }
}

/**
 * 从 GitHub 下载并提取二进制文件
 */
async function downloadFromGitHub(platform: NodeJS.Platform, arch: string): Promise<string> {
  const binaryName = platform === 'win32' ? 'frps.exe' : 'frps';
  const platformName = platform === 'win32' ? 'windows' : platform;
  const archName = arch === 'arm64' ? 'arm64' : 'amd64';
  const ext = platform === 'win32' ? 'zip' : 'tar.gz';

  // 缓存路径
  const cachePath = getCachedBinaryPath(platform, arch);

  // 检查缓存
  try {
    await fs.access(cachePath);
    console.log(`使用缓存的二进制文件: ${cachePath}`);
    return cachePath;
  } catch {
    // 缓存不存在，需要下载
  }

  // Windows 下载前先添加 Defender 排除
  await ensureDefenderExclusion(CACHE_DIR);

  console.warn(`正在下载 frps ${platformName}-${archName}...`);

  // 下载 URL
  const baseUrl = `https://github.com/fatedier/frp/releases/download/v${FRP_VERSION}`;
  const tarballUrl = `${baseUrl}/frp_${FRP_VERSION}_${platformName}_${archName}.${ext}`;

  // 下载到临时目录
  const tempDownloadDir = path.join(os.tmpdir(), `frps-download-${Date.now()}`);
  await fs.mkdir(tempDownloadDir, { recursive: true });

  const tarballPath = path.join(tempDownloadDir, `frps.${ext}`);
  await downloadFile(tarballUrl, tarballPath);

  // 解压
  console.log('正在解压...');
  const extractDir = path.join(tempDownloadDir, 'extracted');

  if (ext === 'zip') {
    await extractZip(tarballPath, extractDir);
  } else {
    await extractTar(tarballPath, extractDir);
  }

  // 找到解压后的目录
  const files = await fs.readdir(extractDir);
  const frpDir = files.find(f => f.startsWith('frp_'));

  if (!frpDir) {
    throw new Error('未找到解压后的 frp 目录');
  }

  const binaryDir = path.join(extractDir, frpDir);
  const extractedPath = path.join(binaryDir, binaryName);

  // 确保缓存目录存在
  await fs.mkdir(path.dirname(cachePath), { recursive: true });

  // 复制到缓存目录
  await fs.copyFile(extractedPath, cachePath);

  if (platform === 'win32') {
    // 移除 Windows 安全标记（Zone.Identifier），避免被阻止执行
    try {
      const { execaCommand } = await import('execa');
      await execaCommand(`powershell -Command "Unblock-File -Path '${cachePath}'"`, { stdio: 'pipe' });
    } catch {
      // 忽略
    }
  } else {
    // 添加执行权限 (非 Windows)
    await fs.chmod(cachePath, 0o755);
  }

  // 清理临时目录
  await fs.rm(tempDownloadDir, { recursive: true, force: true });

  // 等待片刻让杀毒软件完成扫描，然后验证文件是否存在
  if (platform === 'win32') {
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  try {
    await fs.access(cachePath);
  } catch {
    throw new Error(
      `frps 二进制文件已下载但被杀毒软件（如 Windows Defender）删除。\n` +
      `请以管理员身份运行以下命令后重试:\n` +
      `  PowerShell: Add-MpPreference -ExclusionPath '${CACHE_DIR}'`
    );
  }

  console.log(`✓ frps ${platformName}-${archName} 下载完成`);
  return cachePath;
}

/**
 * 获取 frps 二进制文件路径
 *
 * 统一从 GitHub Releases 下载二进制文件：
 * - 使用系统缓存目录存储下载的文件
 * - 避免重复下载
 * - 支持所有平台
 */
export async function getBinaryPath(platform?: NodeJS.Platform, arch?: string): Promise<string> {
  const platformInfo = getPlatformInfo();
  const targetPlatform = platform || platformInfo.platform;
  const targetArch = arch || platformInfo.arch;

  const binaryName = targetPlatform === 'win32' ? 'frps.exe' : 'frps';

  try {
    return await downloadFromGitHub(targetPlatform, targetArch);
  } catch (downloadError: unknown) {
    const errorMessage = downloadError instanceof Error ? downloadError.message : String(downloadError);
    throw new Error(
      `无法获取 frps 二进制文件 (${targetPlatform} ${targetArch})\n` +
      `从 GitHub 下载失败: ${errorMessage}\n\n` +
      `调试信息:\n` +
      `  packageDir: ${packageDir}\n` +
      `  目标平台: ${targetPlatform}\n` +
      `  目标架构: ${targetArch}\n` +
      `  二进制文件名: ${binaryName}\n` +
      `  缓存目录: ${CACHE_DIR}\n\n` +
      `提示: 如果在 Git Bash/MinGW 中使用，请设置环境变量:\n` +
      `  export FRPS_PLATFORM=win32\n\n` +
      `提示: 您也可以手动从以下地址下载:\n` +
      `  https://github.com/fatedier/frp/releases/v${FRP_VERSION}`
    );
  }
}
