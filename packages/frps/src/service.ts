import { execaCommand } from 'execa';
import chalk from 'chalk';

const SERVICE_NAME = 'frps';

export async function status(): Promise<void> {
  try {
    const { stdout } = await execaCommand(`systemctl status ${SERVICE_NAME}`, {
      stdio: 'pipe',
      reject: false
    });
    console.log(stdout);
  } catch (error) {
    console.log(chalk.yellow('无法获取服务状态'));
  }
}

export async function start(): Promise<void> {
  try {
    await execaCommand(`systemctl start ${SERVICE_NAME}`, { stdio: 'inherit' });
    console.log(chalk.green('frps 服务已启动'));
  } catch (error) {
    throw new Error(`启动服务失败: ${error.message}`);
  }
}

export async function stop(): Promise<void> {
  try {
    await execaCommand(`systemctl stop ${SERVICE_NAME}`, { stdio: 'inherit' });
    console.log(chalk.green('frps 服务已停止'));
  } catch (error) {
    throw new Error(`停止服务失败: ${error.message}`);
  }
}
