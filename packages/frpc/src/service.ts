import { execaCommand } from 'execa';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs/promises';
import { getPlatformInfo } from './binary.js';

export interface RunOptions {
  config?: string;
}

function getDefaultInstallDir(): string {
  const platformInfo = getPlatformInfo();
  if (platformInfo.isWindows) {
    return path.join(process.env.USERPROFILE || '', 'frp');
  }
  return path.join(process.env.HOME || '', '.frp');
}

export async function run(options: RunOptions = {}): Promise<void> {
  const { config } = options;
  const platformInfo = getPlatformInfo();
  const installDir = getDefaultInstallDir();

  let configPath = config;
  let binaryPath: string;

  if (platformInfo.isWindows) {
    binaryPath = path.join(installDir, 'frpc.exe');
  } else {
    binaryPath = path.join(installDir, 'frpc');
  }

  // 如果没有指定配置文件，使用默认配置
  if (!configPath) {
    configPath = path.join(installDir, 'frpc.toml');
  }

  // 检查可执行文件是否存在
  try {
    await fs.access(binaryPath);
  } catch {
    throw new Error(`frpc 未安装，找不到可执行文件: ${binaryPath}\n请先运行: frpc install`);
  }

  // 检查配置文件是否存在
  try {
    await fs.access(configPath);
  } catch {
    throw new Error(`配置文件不存在: ${configPath}\n请先运行: frpc config --server <服务器地址> --local-port <本地端口> --remote-port <远程端口>`);
  }

  console.log(chalk.blue('正在启动 frpc...'));
  console.log(chalk.gray('配置文件: ') + configPath);
  console.log(chalk.gray('按 Ctrl+C 停止\n'));

  try {
    // 使用 execa 直接运行，这样可以看到输出
    const subprocess = execaCommand(`"${binaryPath}" -c "${configPath}"`, {
      stdio: 'inherit'
    });

    await subprocess;
  } catch (error) {
    // 用户主动终止，不显示错误
    if (error.signal === 'SIGINT') {
      console.log(chalk.yellow('\nfrpc 已停止'));
      return;
    }
    throw error;
  }
}
