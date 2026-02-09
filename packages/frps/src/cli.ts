#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { install } from './installer.js';
import { status as serviceStatus, start, stop } from './service.js';

const program = new Command();

program
  .name('frps')
  .description('frp 服务端部署工具 - 一键部署 frps 到 Linux 服务器')
  .version('1.0.0');

// 默认命令：npx @feng3d/frps -p 7000
program
  .option('-p, --port <port>', '绑定端口', '7000')
  .option('--frp-version <version>', 'frp 版本', '0.67.0')
  .option('-d, --dir <dir>', '安装目录', '/usr/local/bin')
  .option('--config-dir <dir>', '配置目录', '/etc/frp')
  .action(async (options) => {
    try {
      await install(options);
    } catch (error) {
      console.error(chalk.red('安装失败:'), error.message);
      process.exit(1);
    }
  });

// install 子命令
program
  .command('install')
  .description('安装 frps 服务端')
  .option('-p, --port <port>', '绑定端口', '7000')
  .option('--frp-version <version>', 'frp 版本', '0.67.0')
  .option('-d, --dir <dir>', '安装目录', '/usr/local/bin')
  .option('--config-dir <dir>', '配置目录', '/etc/frp')
  .action(async (options) => {
    try {
      await install(options);
    } catch (error) {
      console.error(chalk.red('安装失败:'), error.message);
      process.exit(1);
    }
  });

// status 子命令
program
  .command('status')
  .description('查看 frps 服务状态')
  .action(async () => {
    try {
      await serviceStatus();
    } catch (error) {
      console.error(chalk.red('查询失败:'), error.message);
      process.exit(1);
    }
  });

// start 子命令
program
  .command('start')
  .description('启动 frps 服务')
  .action(async () => {
    try {
      await start();
    } catch (error) {
      console.error(chalk.red('启动失败:'), error.message);
      process.exit(1);
    }
  });

// stop 子命令
program
  .command('stop')
  .description('停止 frps 服务')
  .action(async () => {
    try {
      await stop();
    } catch (error) {
      console.error(chalk.red('停止失败:'), error.message);
      process.exit(1);
    }
  });

program.parse();
