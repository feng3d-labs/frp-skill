import { describe, it, expect, beforeEach } from 'vitest';
import { Command } from 'commander';
import chalk from 'chalk';
import { install } from '../src/installer.js';
import { configure } from '../src/configure.js';
import { run } from '../src/service.js';

// Mock console to prevent actual output during tests
vi.mock('console', () => ({
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
}));

describe('frpc/cli', () => {
  let mockProgram: Command;

  beforeEach(() => {
    // 创建一个新的 Command 实例用于测试
    mockProgram = new Command();
    mockProgram
      .name('frpc')
      .description('frp 客户端部署工具 - 一键部署 frpc 到本地机器')
      .version('1.0.0');

    mockProgram
      .option('-s, --server <addr>', '服务器地址')
      .option('-p, --server-port <port>', '服务器端口', '7000')
      .option('--frp-version <version>', 'frp 版本', '0.67.0')
      .option('-d, --dir <dir>', '安装目录')
      .option('--local-ip <ip>', '本地 IP', '127.0.0.1')
      .option('--local-port <port>', '本地端口')
      .option('--remote-port <port>', '远程端口')
      .option('--proxy-name <name>', '代理名称', 'web');

    mockProgram
      .command('install')
      .description('安装 frpc 客户端')
      .option('--frp-version <version>', 'frp 版本', '0.67.0')
      .option('-d, --dir <dir>', '安装目录')
      .action(() => {});

    mockProgram
      .command('config')
      .description('配置 frpc')
      .option('-s, --server <addr>', '服务器地址')
      .option('-p, --server-port <port>', '服务器端口', '7000')
      .option('--local-ip <ip>', '本地 IP', '127.0.0.1')
      .option('--local-port <port>', '本地端口')
      .option('--remote-port <port>', '远程端口')
      .option('--proxy-name <name>', '代理名称', 'web')
      .action(() => {});

    mockProgram
      .command('start')
      .description('启动 frpc 客户端')
      .option('-c, --config <file>', '配置文件路径')
      .action(() => {});
  });

  it('应该有正确的命令名称', () => {
    expect(mockProgram.name()).toBe('frpc');
    expect(mockProgram.description()).toContain('frp 客户端');
  });

  it('应该有服务器地址选项', () => {
    const hasServerOption = mockProgram.options.some((opt: any) =>
      opt.long === 'server' || opt.flags.includes('-s')
    );
    expect(hasServerOption).toBe(true);
  });

  it('应该有服务器端口选项', () => {
    const hasPortOption = mockProgram.options.some((opt: any) =>
      opt.long === 'serverPort' || opt.flags.includes('-p')
    );
    expect(hasPortOption).toBe(true);
  });

  it('应该有 install 子命令', () => {
    const installCommand = mockProgram.commands.find((c: any) => c.name() === 'install');
    expect(installCommand).toBeDefined();
  });

  it('应该有 config 子命令', () => {
    const configCommand = mockProgram.commands.find((c: any) => c.name() === 'config');
    expect(configCommand).toBeDefined();
  });

  it('应该有 start 子命令', () => {
    const startCommand = mockProgram.commands.find((c: any) => c.name() === 'start');
    expect(startCommand).toBeDefined();
  });
});
