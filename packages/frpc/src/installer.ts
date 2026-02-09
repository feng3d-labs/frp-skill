import path from 'path';
import fs from 'fs/promises';
import chalk from 'chalk';
import ora, { Ora } from 'ora';
import { getBinaryPath, getPlatformInfo } from './binary.js';
import { addDefenderExclusion } from './windows.js';

export interface InstallOptions {
  dir?: string;
}

function getDefaultInstallDir(): string {
  const platformInfo = getPlatformInfo();
  if (platformInfo.isWindows) {
    return path.join(process.env.USERPROFILE || '', 'frp');
  }
  return path.join(process.env.HOME || '', '.frp');
}

export async function install(options: InstallOptions): Promise<void> {
  const {
    dir: userDir
  } = options;

  const installDir = userDir || getDefaultInstallDir();
  const platformInfo = getPlatformInfo();

  let spinner: Ora;

  try {
    // Windows 下添加 Defender 排除
    if (platformInfo.isWindows) {
      spinner = ora('正在配置 Windows Defender...').start();
      try {
        await addDefenderExclusion(installDir);
        spinner.succeed(chalk.green('Windows Defender 排除已添加'));
      } catch (error) {
        spinner.warn(chalk.yellow('无法添加 Defender 排除: ' + error.message));
        console.log(chalk.yellow('如果 frpc.exe 被删除，请手动将安装目录添加到杀毒软件白名单'));
      }
    }

    // 1. 获取平台包中的二进制文件
    spinner = ora('正在准备 frpc...').start();
    const binaryPath = await getBinaryPath(platformInfo.platform, platformInfo.arch);
    spinner.succeed(chalk.green('使用平台包二进制文件'));

    // 2. 安装二进制
    spinner = ora('正在安装 frpc...').start();

    // 确保安装目录存在
    await fs.mkdir(installDir, { recursive: true });

    const binaryName = platformInfo.isWindows ? 'frpc.exe' : 'frpc';
    const destBinaryPath = path.join(installDir, binaryName);

    await fs.copyFile(binaryPath, destBinaryPath);

    // 非Windows系统添加执行权限
    if (!platformInfo.isWindows) {
      await fs.chmod(destBinaryPath, 0o755);
    }

    spinner.succeed(chalk.green('frpc 已安装到 ' + destBinaryPath));

    // 3. 显示完成信息
    console.log('\n' + chalk.bold.green('=== 安装完成 ==='));
    console.log(chalk.blue('  安装目录  : ') + installDir);
    console.log(chalk.blue('  可执行文件: ') + destBinaryPath);

    if (platformInfo.isWindows) {
      console.log('\n' + chalk.bold('使用方法:'));
      console.log(chalk.gray('  1. 配置客户端: frpc config --server <服务器地址> --local-port <本地端口> --remote-port <远程端口>'));
      console.log(chalk.gray('  2. 启动客户端: frpc start'));
    } else {
      console.log('\n' + chalk.bold('使用方法:'));
      console.log(chalk.gray('  1. 配置客户端: frpc config --server <服务器地址> --local-port <本地端口> --remote-port <远程端口>'));
      console.log(chalk.gray('  2. 启动客户端: frpc start'));
      console.log(chalk.gray('\n或者添加到 PATH:'));
      console.log(chalk.gray(`  export PATH="$PATH:${installDir}"`));
    }

  } catch (error) {
    if (spinner) {
      spinner.fail(chalk.red('安装失败: ' + error.message));
    } else {
      console.error(chalk.red('安装失败:'), error.message);
    }
    throw error;
  }
}
