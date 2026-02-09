import path from 'path';
import fs from 'fs/promises';
import chalk from 'chalk';
import ora, { Ora } from 'ora';
import { execaCommand } from 'execa';
import { downloadFrps, extractTar, getPlatformInfo } from './downloader.js';
import { setupSystemdService, startService } from './systemd.js';
import { configureFirewall } from './firewall.js';
import { generateFrpsConfig } from './config.js';

export interface InstallOptions {
  port: string;
  frpVersion?: string;
  dir?: string;
  configDir?: string;
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

export async function install(options: InstallOptions): Promise<void> {
  const {
    port = '7000',
    frpVersion = '0.67.0',
    dir = '/usr/local/bin',
    configDir = '/etc/frp'
  } = options;

  const version = frpVersion;

  // 检查是否为 root
  const isRoot = await checkRoot();
  if (!isRoot) {
    console.error(chalk.red('错误: 此命令需要 root 权限，请使用 sudo 运行'));
    console.log(chalk.yellow('示例: sudo npx @feng3d/frps -p 7000'));
    process.exit(1);
  }

  const platformInfo = getPlatformInfo();

  if (!platformInfo.isLinux) {
    console.error(chalk.red('错误: frps 服务端目前仅支持 Linux 系统'));
    process.exit(1);
  }

  let spinner: Ora;

  try {
    // 1. 下载二进制
    spinner = ora('正在下载 frps...').start();
    const tarballPath = await downloadFrps({
      version,
      destDir: '/tmp',
      onProgress: (progress) => {
        spinner.text = `正在下载 frps... ${Math.round(progress)}%`;
      }
    });
    spinner.succeed(chalk.green('下载完成'));

    // 2. 解压
    spinner = ora('正在解压...').start();
    const extractDir = await extractTar(tarballPath, '/tmp');
    spinner.succeed(chalk.green('解压完成'));

    // 3. 安装二进制
    spinner = ora('正在安装 frps...').start();
    const binaryPath = path.join(extractDir, 'frps');
    const destBinaryPath = path.join(dir, 'frps');

    await fs.copyFile(binaryPath, destBinaryPath);
    await fs.chmod(destBinaryPath, 0o755);

    // 清理临时文件
    await fs.unlink(tarballPath);
    await fs.rm(extractDir, { recursive: true, force: true });

    spinner.succeed(chalk.green('frps 已安装到 ' + destBinaryPath));

    // 4. 创建配置
    spinner = ora('正在创建配置文件...').start();
    const configPath = path.join(configDir, 'frps.toml');
    await generateFrpsConfig(configPath, { bindPort: port });
    spinner.succeed(chalk.green('配置文件已创建: ' + configPath));

    // 5. 配置防火墙
    spinner = ora('正在配置防火墙...').start();
    await configureFirewall([port]);
    spinner.succeed(chalk.green('防火墙规则已添加'));

    // 6. 创建 systemd 服务
    spinner = ora('正在创建系统服务...').start();
    await setupSystemdService({
      name: 'frps',
      binaryPath: destBinaryPath,
      configPath,
      description: 'frp server service'
    });
    spinner.succeed(chalk.green('系统服务已创建'));

    // 7. 启动服务
    spinner = ora('正在启动 frps 服务...').start();
    await startService('frps');

    // 等待一下让服务启动
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 检查服务状态
    const { stdout } = await execaCommand('systemctl is-active frps', { stdio: 'pipe' });
    if (stdout.trim() === 'active') {
      spinner.succeed(chalk.green('frps 服务运行中'));
    } else {
      spinner.warn(chalk.yellow('frps 服务可能未正常启动，请检查日志'));
    }

    // 8. 显示完成信息
    console.log('\n' + chalk.bold.green('=== 部署完成 ==='));
    console.log(chalk.blue('  通信端口  : ') + port);
    console.log(chalk.blue('  配置文件  : ') + configPath);
    console.log(chalk.blue('  二进制文件: ') + destBinaryPath);
    console.log('\n' + chalk.bold('管理命令:'));
    console.log(chalk.gray('  查看状态: sudo systemctl status frps'));
    console.log(chalk.gray('  重启服务: sudo systemctl restart frps'));
    console.log(chalk.gray('  停止服务: sudo systemctl stop frps'));
    console.log(chalk.gray('  查看日志: journalctl -u frps -f'));

  } catch (error) {
    if (spinner) {
      spinner.fail(chalk.red('安装失败: ' + error.message));
    } else {
      console.error(chalk.red('安装失败:'), error.message);
    }
    throw error;
  }
}
