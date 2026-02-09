import { execaCommand } from 'execa';
import chalk from 'chalk';
import { getPlatformInfo } from './downloader.js';

const SERVICE_NAME = 'frps';

export async function status(): Promise<void> {
  const platformInfo = getPlatformInfo();

  if (platformInfo.isLinux) {
    try {
      const { stdout } = await execaCommand(`systemctl status ${SERVICE_NAME}`, {
        stdio: 'pipe',
        reject: false
      });
      console.log(stdout);
    } catch {
      console.log(chalk.yellow('无法获取服务状态'));
    }
  } else if (platformInfo.isWindows) {
    try {
      const { stdout } = await execaCommand(`sc query ${SERVICE_NAME}`, {
        stdio: 'pipe',
        reject: false
      });
      console.log(stdout);
    } catch {
      console.log(chalk.yellow('无法获取服务状态'));
    }
  } else {
    console.log(chalk.yellow('macOS 不支持系统服务管理，请手动运行 frps'));
  }
}

export async function start(): Promise<void> {
  const platformInfo = getPlatformInfo();

  if (platformInfo.isLinux) {
    try {
      await execaCommand(`systemctl start ${SERVICE_NAME}`, { stdio: 'inherit' });
      console.log(chalk.green('frps 服务已启动'));
    } catch (error) {
      throw new Error(`启动服务失败: ${error.message}`);
    }
  } else if (platformInfo.isWindows) {
    try {
      await execaCommand(`net start ${SERVICE_NAME}`, { stdio: 'inherit' });
      console.log(chalk.green('frps 服务已启动'));
    } catch (error) {
      throw new Error(`启动服务失败: ${error.message}`);
    }
  } else {
    throw new Error('macOS 不支持系统服务管理，请手动运行 frps');
  }
}

export async function stop(): Promise<void> {
  const platformInfo = getPlatformInfo();

  if (platformInfo.isLinux) {
    try {
      await execaCommand(`systemctl stop ${SERVICE_NAME}`, { stdio: 'inherit' });
      console.log(chalk.green('frps 服务已停止'));
    } catch (error) {
      throw new Error(`停止服务失败: ${error.message}`);
    }
  } else if (platformInfo.isWindows) {
    try {
      await execaCommand(`net stop ${SERVICE_NAME}`, { stdio: 'inherit' });
      console.log(chalk.green('frps 服务已停止'));
    } catch (error) {
      throw new Error(`停止服务失败: ${error.message}`);
    }
  } else {
    throw new Error('macOS 不支持系统服务管理，请手动停止 frps 进程');
  }
}
