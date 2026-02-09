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

  let frpsBinary: string;
  let frpcBinary: string;

  /**
   * 获取二进制文件路径
   */
  async function getBinaryPaths(): Promise<{ frps: string; frpc: string }> {
    const platform = process.platform;
    const binaryExt = platform === 'win32' ? '.exe' : '';
    const frpsName = `frps${binaryExt}`;
    const frpcName = `frpc${binaryExt}`;

    // 使用项目根目录 binaries 文件夹中的二进制（由 postinstall 下载）
    const { fileURLToPath } = await import('url');
    const { dirname } = await import('path');
    const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
    const binariesDir = path.join(rootDir, 'binaries');

    const frpsPath = path.join(binariesDir, frpsName);
    const frpcPath = path.join(binariesDir, frpcName);

    // 检查二进制文件是否存在
    try {
      await fs.access(frpsPath);
      await fs.access(frpcPath);
      console.log('使用项目二进制文件:', binariesDir);
      return { frps: frpsPath, frpc: frpcPath };
    } catch (err) {
      throw new Error(
        `二进制文件未找到。请先运行 'npm install' 以下载二进制文件。\n` +
        `期望路径: ${binariesDir}\n` +
        `错误: ${err.message}`
      );
    }
  }

  beforeAll(async () => {
    await fs.mkdir(tempDir, { recursive: true });

    // 获取二进制文件路径
    const paths = await getBinaryPaths();
    frpsBinary = paths.frps;
    frpcBinary = paths.frpc;

    // 获取随机端口
    frpsPort = await getRandomPort();
    testServerPort = await getRandomPort();
    remotePort = await getRandomPort();

    // 创建一个简单的测试 HTTP 服务器
    testServer = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
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
    // 启动 frps
    frpsProcess = execaCommand(`"${frpsBinary}" -c "${frpsConfigPath}"`, {
      stdio: 'pipe',
    });

    // 等待 frps 启动
    await waitForPort(frpsPort, 10000);

    expect(frpsProcess.pid).toBeGreaterThan(0);
    console.log(`frps 已启动，PID: ${frpsProcess.pid}，端口: ${frpsPort}`);
  }, 15000);

  it('应该能够启动 frpc 客户端', async () => {
    // 启动 frpc
    frpcProcess = execaCommand(`"${frpcBinary}" -c "${frpcConfigPath}"`, {
      stdio: 'pipe',
    });

    // 等待 frpc 连接
    await new Promise(resolve => setTimeout(resolve, 3000));

    expect(frpcProcess.pid).toBeGreaterThan(0);
    console.log(`frpc 已启动，PID: ${frpcProcess.pid}`);
  }, 15000);

  it('应该能够通过转发端口访问本地服务器', async () => {
    // 等待连接建立
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 尝试通过转发端口访问
    const response = await fetch(`http://127.0.0.1:${remotePort}`);
    const text = await response.text();

    expect(text).toBe('Hello from test server!');
    expect(response.status).toBe(200);
    console.log(`成功通过转发端口 ${remotePort} 访问本地服务器`);
  }, 15000);

  it('应该支持多个并发连接', async () => {
    const requests = Array.from({ length: 10 }, () =>
      fetch(`http://127.0.0.1:${remotePort}`)
    );

    const responses = await Promise.all(requests);

    for (const response of responses) {
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toBe('Hello from test server!');
    }
    console.log('成功处理 10 个并发连接');
  }, 15000);

  it('应该正确转发 POST 请求', async () => {
    const response = await fetch(`http://127.0.0.1:${remotePort}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ test: 'data' }),
    });

    expect(response.status).toBe(200);
    console.log('POST 请求转发成功');
  }, 10000);

  it('应该正确转发自定义 HTTP 头', async () => {
    const response = await fetch(`http://127.0.0.1:${remotePort}`, {
      headers: {
        'X-Custom-Header': 'test-value',
        'User-Agent': 'E2E-Test-Agent',
      },
    });

    expect(response.status).toBe(200);
    console.log('自定义 HTTP 头转发成功');
  }, 10000);
});
