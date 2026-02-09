import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import { execaCommand } from 'execa';
import { createServer } from 'http';
import { getRandomPort, waitForPort } from './helpers.js';

describe('frp 端口转发 E2E 测试', () => {
  let frpsProcess: ReturnType<typeof execaCommand>;
  let frpcProcess: ReturnType<typeof execaCommand>;
  let testServer: ReturnType<typeof createServer>;
  let testServerPort: number;
  let frpsPort: number;
  let remotePort: number;

  const tempDir = path.join(process.env.TMP || '/tmp', 'frp-e2e-test');
  const frpsConfigPath = path.join(tempDir, 'frps.toml');
  const frpcConfigPath = path.join(tempDir, 'frpc.toml');

  beforeAll(async () => {
    await fs.mkdir(tempDir, { recursive: true });

    // 获取随机端口
    frpsPort = await getRandomPort();
    testServerPort = await getRandomPort();
    remotePort = await getRandomPort();

    // 创建一个简单的测试 HTTP 服务器
    testServer = createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Hello from test server!');
    });

    await new Promise<void>((resolve) => {
      testServer.listen(testServerPort, () => resolve());
    });

    // 生成 frps 配置
    const frpsConfig = `bindPort = ${frpsPort}
`;
    await fs.writeFile(frpsConfigPath, frpsConfig);

    // 生成 frpc 配置
    const frpcConfig = `serverAddr = "127.0.0.1"
serverPort = ${frpsPort}

[[proxies]]
name = "test-http"
type = "tcp"
localIP = "127.0.0.1"
localPort = ${testServerPort}
remotePort = ${remotePort}
`;
    await fs.writeFile(frpcConfigPath, frpcConfig);
  }, 30000);

  afterAll(async () => {
    // 停止 frpc
    if (frpcProcess) {
      frpcProcess.kill();
      try {
        await frpcProcess;
      } catch {
        // Ignore
      }
    }

    // 停止 frps
    if (frpsProcess) {
      frpsProcess.kill();
      try {
        await frpsProcess;
      } catch {
        // Ignore
      }
    }

    // 关闭测试服务器
    if (testServer) {
      await new Promise<void>((resolve) => {
        testServer.close(() => resolve());
      });
    }

    // 清理临时文件
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  }, 30000);

  it('应该能够启动 frps 服务端', async () => {
    // 查找 frps 二进制文件
    const platform = process.platform;
    const binaryName = platform === 'win32' ? 'frps.exe' : 'frps';

    // 尝试从多个位置查找 frps
    const possiblePaths = [
      path.join(tempDir, binaryName),
      path.join(process.env.USERPROFILE || '', 'frp', binaryName),
      path.join(process.env.HOME || '', '.frp', binaryName),
      path.join('packages', 'frps', binaryName),
    ];

    let frpsBinary: string | null = null;
    for (const p of possiblePaths) {
      try {
        await fs.access(p);
        frpsBinary = p;
        break;
      } catch {
        // Continue
      }
    }

    if (!frpsBinary) {
      console.log('跳过 E2E 测试: frps 二进制文件未找到，请先运行安装命令');
      return;
    }

    // 启动 frps
    frpsProcess = execaCommand(`"${frpsBinary}" -c "${frpsConfigPath}"`, {
      stdio: 'pipe',
    });

    // 等待 frps 启动
    await waitForPort(frpsPort, 5000);

    expect(frpsProcess.pid).toBeGreaterThan(0);
  }, 10000);

  it('应该能够启动 frpc 客户端', async () => {
    if (!frpsProcess || !frpsProcess.pid) {
      return;
    }

    // 查找 frpc 二进制文件
    const platform = process.platform;
    const binaryName = platform === 'win32' ? 'frpc.exe' : 'frpc';

    const possiblePaths = [
      path.join(tempDir, binaryName),
      path.join(process.env.USERPROFILE || '', 'frp', binaryName),
      path.join(process.env.HOME || '', '.frp', binaryName),
      path.join('packages', 'frpc', binaryName),
    ];

    let frpcBinary: string | null = null;
    for (const p of possiblePaths) {
      try {
        await fs.access(p);
        frpcBinary = p;
        break;
      } catch {
        // Continue
      }
    }

    if (!frpcBinary) {
      console.log('跳过 E2E 测试: frpc 二进制文件未找到，请先运行安装命令');
      return;
    }

    // 启动 frpc
    frpcProcess = execaCommand(`"${frpcBinary}" -c "${frpcConfigPath}"`, {
      stdio: 'pipe',
    });

    // 等待 frpc 连接
    await new Promise(resolve => setTimeout(resolve, 2000));

    expect(frpcProcess.pid).toBeGreaterThan(0);
  }, 10000);

  it('应该能够通过转发端口访问本地服务器', async () => {
    if (!frpcProcess || !frpcProcess.pid) {
      return;
    }

    // 等待连接建立
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 尝试通过转发端口访问
    const response = await fetch(`http://127.0.0.1:${remotePort}`);
    const text = await response.text();

    expect(text).toBe('Hello from test server!');
    expect(response.status).toBe(200);
  }, 10000);

  it('应该支持多个并发连接', async () => {
    if (!frpcProcess || !frpcProcess.pid) {
      return;
    }

    const requests = Array.from({ length: 5 }, () =>
      fetch(`http://127.0.0.1:${remotePort}`)
    );

    const responses = await Promise.all(requests);

    for (const response of responses) {
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toBe('Hello from test server!');
    }
  }, 10000);
});
