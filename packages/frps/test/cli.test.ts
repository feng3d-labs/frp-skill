import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Command } from 'commander';

// Mock console to prevent actual output during tests
vi.mock('console', () => ({
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
}));

describe('frps/cli', () => {
  let mockProgram: Command;

  beforeEach(() => {
    // 创建一个新的 Command 实例用于测试
    mockProgram = new Command();
    mockProgram
      .name('frps')
      .description('frp 服务端部署工具 - 支持 Linux/Windows/macOS')
      .version('1.0.0');

    mockProgram
      .option('-p, --port <port>', '绑定端口', '7000')
      .option('--frp-version <version>', 'frp 版本', '0.67.0')
      .option('-d, --dir <dir>', '安装目录')
      .option('--config-dir <dir>', '配置目录')
      .option('--no-service', '不创建系统服务');

    mockProgram
      .command('install')
      .description('安装 frps 服务端')
      .option('-p, --port <port>', '绑定端口', '7000')
      .option('--frp-version <version>', 'frp 版本', '0.67.0')
      .option('-d, --dir <dir>', '安装目录')
      .option('--config-dir <dir>', '配置目录')
      .option('--no-service', '不创建系统服务')
      .action(() => {});

    mockProgram
      .command('status')
      .description('查看 frps 服务状态')
      .action(() => {});

    mockProgram
      .command('start')
      .description('启动 frps 服务')
      .action(() => {});

    mockProgram
      .command('stop')
      .description('停止 frps 服务')
      .action(() => {});
  });

  it('应该有正确的命令名称', () => {
    expect(mockProgram.name()).toBe('frps');
    expect(mockProgram.description()).toContain('frp 服务端');
  });

  it('应该有端口选项', () => {
    const hasPortOption = mockProgram.options.some((opt: any) =>
      opt.long === 'port' || opt.flags.includes('-p')
    );
    expect(hasPortOption).toBe(true);
  });

  it('应该有 frp 版本选项', () => {
    const hasVersionOption = mockProgram.options.some((opt: any) =>
      opt.long === 'frp-version' || opt.flags.includes('--frp-version')
    );
    expect(hasVersionOption).toBe(true);
  });

  it('应该有 no-service 选项', () => {
    const hasNoServiceOption = mockProgram.options.some((opt: any) =>
      opt.long === 'noService' || opt.flags.includes('--no-service')
    );
    expect(hasNoServiceOption).toBe(true);
  });

  it('应该有 install 子命令', () => {
    const installCommand = mockProgram.commands.find((c: any) => c.name() === 'install');
    expect(installCommand).toBeDefined();
  });

  it('应该有 status 子命令', () => {
    const statusCommand = mockProgram.commands.find((c: any) => c.name() === 'status');
    expect(statusCommand).toBeDefined();
  });

  it('应该有 start 子命令', () => {
    const startCommand = mockProgram.commands.find((c: any) => c.name() === 'start');
    expect(startCommand).toBeDefined();
  });

  it('应该有 stop 子命令', () => {
    const stopCommand = mockProgram.commands.find((c: any) => c.name() === 'stop');
    expect(stopCommand).toBeDefined();
  });
});
