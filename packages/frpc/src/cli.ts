#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { install } from './installer.js';
import { configure } from './configure.js';
import { run } from './service.js';

const program = new Command();

program
  .name('frpc')
  .description('frp 客户端部署工具 - 一键部署 frpc 到本地机器')
  .version('1.0.0');

// 默认命令：npx @feng3d/frpc --server example.com
program
  .option('-s, --server <addr>', '服务器地址')
  .option('-p, --server-port <port>', '服务器端口', '7000')
  .option('-d, --dir <dir>', '安装目录')
  .option('--local-ip <ip>', '本地 IP', '127.0.0.1')
  .option('--local-port <port>', '本地端口')
  .option('--remote-port <port>', '远程端口')
  .option('--proxy-name <name>', '代理名称', 'web')
  .action(async (options) => {
    if (!options.server) {
      console.error(chalk.red('错误: 请指定服务器地址'));
      console.log(chalk.yellow('示例: npx @feng3d/frpc --server example.com'));
      program.help();
      return;
    }

    try {
      // 如果指定了 local-port 和 remote-port，则配置并运行
      if (options.localPort && options.remotePort) {
        await install(options);
        await configure(options);
        console.log(chalk.green('\n配置完成！现在可以运行 frpc start 来启动客户端'));
      } else {
        // 否则只安装
        await install(options);
      }
    } catch (error) {
      console.error(chalk.red('操作失败:'), error.message);
      process.exit(1);
    }
  });

// install 子命令
program
  .command('install')
  .description('安装 frpc 客户端')
  .option('-d, --dir <dir>', '安装目录')
  .action(async (options) => {
    try {
      await install(options);
    } catch (error) {
      console.error(chalk.red('安装失败:'), error.message);
      process.exit(1);
    }
  });

// config 子命令
program
  .command('config')
  .description('配置 frpc')
  .option('-s, --server <addr>', '服务器地址')
  .option('-p, --server-port <port>', '服务器端口', '7000')
  .option('--local-ip <ip>', '本地 IP', '127.0.0.1')
  .option('--local-port <port>', '本地端口')
  .option('--remote-port <port>', '远程端口')
  .option('--proxy-name <name>', '代理名称', 'web')
  .action(async (options) => {
    if (!options.server) {
      console.error(chalk.red('错误: 请指定服务器地址'));
      process.exit(1);
    }
    if (!options.localPort || !options.remotePort) {
      console.error(chalk.red('错误: 请指定本地端口和远程端口'));
      process.exit(1);
    }

    try {
      await configure(options);
    } catch (error) {
      console.error(chalk.red('配置失败:'), error.message);
      process.exit(1);
    }
  });

// start 子命令
program
  .command('start')
  .description('启动 frpc 客户端')
  .option('-c, --config <file>', '配置文件路径')
  .action(async (options) => {
    try {
      await run(options);
    } catch (error) {
      console.error(chalk.red('启动失败:'), error.message);
      process.exit(1);
    }
  });

program.parse();
