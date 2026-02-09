import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import ora, { Ora } from 'ora';
import { getPlatformInfo } from './binary.js';

export interface ConfigureOptions {
  server: string;
  serverPort?: string;
  localIP?: string;
  localPort: string;
  remotePort: string;
  proxyName?: string;
}

function getDefaultConfigDir(): string {
  const platformInfo = getPlatformInfo();
  if (platformInfo.isWindows) {
    return path.join(process.env.USERPROFILE || '', 'frp');
  }
  return path.join(process.env.HOME || '', '.frp');
}

export async function configure(options: ConfigureOptions): Promise<void> {
  const {
    server,
    serverPort = '7000',
    localIP = '127.0.0.1',
    localPort,
    remotePort,
    proxyName = 'web'
  } = options;

  const configDir = getDefaultConfigDir();
  const configPath = path.join(configDir, 'frpc.toml');

  const spinner = ora('正在生成配置文件...').start();

  try {
    // 确保目录存在
    await fs.mkdir(configDir, { recursive: true });

    // 生成配置内容
    const content = `serverAddr = "${server}"
serverPort = ${serverPort}

[[proxies]]
name = "${proxyName}"
type = "tcp"
localIP = "${localIP}"
localPort = ${localPort}
remotePort = ${remotePort}
`;

    await fs.writeFile(configPath, content);

    spinner.succeed(chalk.green('配置文件已创建: ' + configPath));

    console.log('\n' + chalk.bold('配置信息:'));
    console.log(chalk.gray('  服务器地址  : ') + chalk.white(server));
    console.log(chalk.gray('  服务器端口  : ') + chalk.white(serverPort));
    console.log(chalk.gray('  本地 IP    : ') + chalk.white(localIP));
    console.log(chalk.gray('  本地端口    : ') + chalk.white(localPort));
    console.log(chalk.gray('  远程端口    : ') + chalk.white(remotePort));
    console.log(chalk.gray('  代理名称    : ') + chalk.white(proxyName));

  } catch (error) {
    spinner.fail(chalk.red('配置失败: ' + error.message));
    throw error;
  }
}
