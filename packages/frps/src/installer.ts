import path from 'path';
import fs from 'fs/promises';
import chalk from 'chalk';
import ora, { Ora } from 'ora';
import { execaCommand } from 'execa';
import { getBinaryPath, getPlatformInfo } from './binary.js';
import { setupSystemdService, startService } from './systemd.js';
import { configureFirewall } from './firewall.js';
import { setupWindowsService, startWindowsService, configureWindowsFirewall } from './windows-service.js';
import { generateFrpsConfig } from './config.js';

export interface InstallOptions {
  port: string;
  dir?: string;
  configDir?: string;
  noService?: boolean;
}

async function checkRoot(): Promise<boolean> {
  try {
    await execaCommand('id -u', { stdio: 'pipe' });
    const { stdout } = await execaCommand('id -u', { stdio: 'pipe' });
    return stdout.trim() === '0';
  } catch {
    return false;
  }
}

async function checkAdmin(): Promise<boolean> {
  try {
    await execaCommand('net session', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function getDefaultInstallDir(platformInfo: ReturnType<typeof getPlatformInfo>): string {
  if (platformInfo.isWindows) {
    return path.join(process.env.ProgramFiles || 'C:\\Program Files', 'frp');
  }
  if (platformInfo.isMac) {
    return path.join(process.env.HOME || '', 'frp');
  }
  return '/usr/local/bin';
}

function getDefaultConfigDir(platformInfo: ReturnType<typeof getPlatformInfo>): string {
  // 统一使用用户目录保存配置
  if (platformInfo.isWindows) {
    return path.join(process.env.USERPROFILE || '', 'frp');
  }
  return path.join(process.env.HOME || '', '.frp');
}

export async function install(options: InstallOptions): Promise<void> {
  const {
    port = '7000',
    dir: userDir,
    configDir: userConfigDir,
    noService = false
  } = options;

  const platformInfo = getPlatformInfo();

  const installDir = userDir || getDefaultInstallDir(platformInfo);
  const configDir = userConfigDir || getDefaultConfigDir(platformInfo);

  let spinner: Ora;

  try {
    // 1. 获取平台包中的二进制文件
    spinner = ora('正在准备 frps...').start();
    const binaryPath = await getBinaryPath(platformInfo.platform, platformInfo.arch);
    spinner.succeed(chalk.green('使用平台包二进制文件'));

    // 2. 安装二进制
    spinner = ora('正在安装 frps...').start();

    // 确保安装目录存在
    await fs.mkdir(installDir, { recursive: true });

    const binaryName = platformInfo.isWindows ? 'frps.exe' : 'frps';
    const destBinaryPath = path.join(installDir, binaryName);

    await fs.copyFile(binaryPath, destBinaryPath);

    if (!platformInfo.isWindows) {
      await fs.chmod(destBinaryPath, 0o755);
    }

    spinner.succeed(chalk.green('frps 已安装到 ' + destBinaryPath));

    // 3. 创建配置
    spinner = ora('正在创建配置文件...').start();
    await fs.mkdir(configDir, { recursive: true });
    const configPath = path.join(configDir, 'frps.toml');
    await generateFrpsConfig(configPath, { bindPort: port });
    spinner.succeed(chalk.green('配置文件已创建: ' + configPath));

    // 4. 配置防火墙
    spinner = ora('正在配置防火墙...').start();
    if (platformInfo.isWindows) {
      await configureWindowsFirewall([port]);
      spinner.succeed(chalk.green('防火墙规则已添加'));
    } else if (platformInfo.isLinux) {
      await configureFirewall([port]);
      spinner.succeed(chalk.green('防火墙规则已添加'));
    } else {
      spinner.info(chalk.yellow('请手动配置防火墙开放端口 ' + port));
    }

    // 5. 创建系统服务
    if (!noService) {
      if (platformInfo.isLinux) {
        const isRoot = await checkRoot();
        if (!isRoot) {
          console.log(chalk.yellow('\n警告: 需要 root 权限创建 systemd 服务，请使用 sudo 运行'));
          console.log(chalk.gray('或使用 --no-service 跳过服务创建'));
        } else {
          spinner = ora('正在创建 systemd 服务...').start();
          await setupSystemdService({
            name: 'frps',
            binaryPath: destBinaryPath,
            configPath,
            description: 'frp server service'
          });
          spinner.succeed(chalk.green('systemd 服务已创建'));

          // 6. 启动服务
          spinner = ora('正在启动 frps 服务...').start();
          await startService('frps');

          // 等待服务启动
          await new Promise(resolve => setTimeout(resolve, 1000));

          const { stdout } = await execaCommand('systemctl is-active frps', { stdio: 'pipe' });
          if (stdout.trim() === 'active') {
            spinner.succeed(chalk.green('frps 服务运行中'));
          } else {
            spinner.warn(chalk.yellow('frps 服务可能未正常启动，请检查日志'));
          }
        }
      } else if (platformInfo.isWindows) {
        const isAdmin = await checkAdmin();
        if (!isAdmin) {
          console.log(chalk.yellow('\n警告: 需要管理员权限创建 Windows 服务'));
          console.log(chalk.gray('请以管理员身份运行终端，或使用 --no-service 跳过服务创建'));
        } else {
          spinner = ora('正在创建 Windows 服务...').start();
          const serviceCreated = await setupWindowsService({
            name: 'frps',
            binaryPath: destBinaryPath,
            configPath,
            description: 'frp server service'
          });

          if (serviceCreated) {
            spinner.succeed(chalk.green('Windows 服务已创建'));

            spinner = ora('正在启动 frps 服务...').start();
            await startWindowsService('frps');
            spinner.succeed(chalk.green('frps 服务运行中'));
          } else {
            spinner.info(chalk.yellow('Windows 服务未创建，请手动启动'));
          }
        }
      } else {
        spinner.info(chalk.yellow('macOS 不支持自动创建服务，请手动启动'));
      }
    }

    // 6. 显示完成信息
    console.log('\n' + chalk.bold.green('=== 部署完成 ==='));
    console.log(chalk.blue('  通信端口  : ') + port);
    console.log(chalk.blue('  配置文件  : ') + configPath);
    console.log(chalk.blue('  二进制文件: ') + destBinaryPath);

    console.log('\n' + chalk.bold('启动服务:'));

    if (platformInfo.isLinux) {
      console.log(chalk.gray('  使用 systemd: sudo systemctl start frps'));
      console.log(chalk.gray('  直接运行:    ' + destBinaryPath + ' -c ' + configPath));
      console.log(chalk.gray('\n管理命令:'));
      console.log(chalk.gray('  查看状态: sudo systemctl status frps'));
      console.log(chalk.gray('  重启服务: sudo systemctl restart frps'));
      console.log(chalk.gray('  停止服务: sudo systemctl stop frps'));
      console.log(chalk.gray('  查看日志: journalctl -u frps -f'));
    } else if (platformInfo.isWindows) {
      console.log(chalk.gray('  使用服务:   net start frps'));
      console.log(chalk.gray('  直接运行:   ' + destBinaryPath + ' -c ' + configPath));
      console.log(chalk.gray('\n管理命令:'));
      console.log(chalk.gray('  查看服务: sc query frps'));
      console.log(chalk.gray('  停止服务: net stop frps'));
    } else {
      console.log(chalk.gray('  直接运行: ' + destBinaryPath + ' -c ' + configPath));
      console.log(chalk.gray('  后台运行: nohup ' + destBinaryPath + ' -c ' + configPath + ' &'));
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
