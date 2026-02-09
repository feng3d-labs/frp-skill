import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import { execa } from 'execa';
import { createServer } from 'http';
import { getRandomPort, waitForPort } from './helpers.js';

/**
 * 优雅地终止进程，避免 unhandled rejection
 */
async function gracefulKill(process: ReturnType<typeof execa> | undefined, signal: NodeJS.Signals = 'SIGTERM'): Promise<void> {
  if (!process) return Promise.resolve();

  // 先抑制 promise rejection 错误传播
  void process.catch(() => {});

  try {
    // 先尝试正常终止
    process.kill(signal);

    // 等待进程退出，最多等待 2 秒
    const timeout = 2000;
    const startTime = Date.now();

    while (process.exitCode === null && Date.now() - startTime < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // 如果还没退出，强制终止
    if (process.exitCode === null) {
      process.kill('SIGKILL');
      // 给进程一点时间清理
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  } catch {
    // 进程可能已经退出
  }

  return Promise.resolve();
}

describe('frp 端口转发 E2E 测试', () => {
  let frpsProcess: ReturnType<typeof execa>;
  let frpcProcess: ReturnType<typeof execa>;
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
   *
   * 开发环境：直接使用 packages/ 目录下平台包中的二进制文件
   * 生产环境：用户通过 npm 安装后，二进制文件在 node_modules/ 中
   */
  async function getBinaryPaths(): Promise<{ frps: string; frpc: string }> {
    const platform = process.platform;
    const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
    const binaryExt = platform === 'win32' ? '.exe' : '';
    const frpsName = `frps${binaryExt}`;
    const frpcName = `frpc${binaryExt}`;

    const { fileURLToPath } = await import('url');
    const { dirname } = await import('path');
    const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));

    // 平台包目录名
    const frpsPlatformDir = `frps-${platform}-${arch}`;
    const frpcPlatformDir = `frpc-${platform}-${arch}`;

    // 优先使用 packages/ 目录中的二进制（开发环境）
    let frpsPath = path.join(rootDir, 'packages', frpsPlatformDir, frpsName);
    let frpcPath = path.join(rootDir, 'packages', frpcPlatformDir, frpcName);

    // 检查 packages/ 是否存在
    let usePackagesDir = false;
    try {
      await fs.access(frpsPath);
      await fs.access(frpcPath);
      usePackagesDir = true;
    } catch {
      // 尝试 node_modules/
      frpsPath = path.join(rootDir, 'node_modules', `@feng3d`, frpsPlatformDir, frpsName);
      frpcPath = path.join(rootDir, 'node_modules', `@feng3d`, frpcPlatformDir, frpcName);
    }

    // 检查二进制文件是否存在
    try {
      await fs.access(frpsPath);
      await fs.access(frpcPath);
      const location = usePackagesDir ? 'packages/' : 'node_modules/';
      console.log(`使用平台包二进制文件 (${location}):\n  frps: ${frpsPlatformDir}\n  frpc: ${frpcPlatformDir}`);
      return { frps: frpsPath, frpc: frpcPath };
    } catch (err) {
      throw new Error(
        `平台包二进制文件未找到。\n` +
        `请确保已运行 'npm install' 下载二进制文件。\n` +
        `期望路径:\n` +
        `  - ${path.join(rootDir, 'packages', frpsPlatformDir, frpsName)}\n` +
        `  - ${path.join(rootDir, 'packages', frpcPlatformDir, frpcName)}\n` +
        `错误: ${(err as Error).message}`
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

    console.log(`测试端口配置: frps=${frpsPort}, testServer=${testServerPort}, remote=${remotePort}`);

    // 创建一个简单的测试 HTTP 服务器
    testServer = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Hello from test server!');
    });

    await new Promise<void>((resolve) => {
      testServer.listen(testServerPort, () => resolve());
    });

    console.log(`测试 HTTP 服务器已启动，端口: ${testServerPort}`);

    // 生成 frps 配置（无 token）
    const frpsConfig = `bindPort = ${frpsPort}
`;
    await fs.writeFile(frpsConfigPath, frpsConfig);

    // 生成 frpc 配置（无 token）
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

    console.log(`配置文件已生成:
  - frps: ${frpsConfigPath}
  - frpc: ${frpcConfigPath}`);
  }, 30000);

  afterAll(async () => {
    // 优雅地清理所有进程
    await Promise.all([
      gracefulKill(frpcProcess),
      gracefulKill(frpsProcess),
    ]);

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
    console.log(`启动 frps: ${frpsBinary} -c ${frpsConfigPath}`);

    // 启动 frps，捕获输出以便调试
    frpsProcess = execa(frpsBinary, ['-c', frpsConfigPath], {
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    // 监听输出以进行调试
    frpsProcess.stdout?.on('data', (data: Buffer) => {
      console.log('frps stdout:', data.toString());
    });

    frpsProcess.stderr?.on('data', (data: Buffer) => {
      console.log('frps stderr:', data.toString());
    });

    // 等待 frps 启动
    await waitForPort(frpsPort, 10000);

    expect(frpsProcess.pid).toBeGreaterThan(0);
    console.log(`✓ frps 已启动，PID: ${frpsProcess.pid}，端口: ${frpsPort}`);
  }, 20000);

  it('应该能够启动 frpc 客户端', async () => {
    console.log(`启动 frpc: ${frpcBinary} -c ${frpcConfigPath}`);

    // 启动 frpc
    frpcProcess = execa(frpcBinary, ['-c', frpcConfigPath], {
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    // 监听输出
    frpcProcess.stdout?.on('data', (data: Buffer) => {
      console.log('frpc stdout:', data.toString());
    });

    frpcProcess.stderr?.on('data', (data: Buffer) => {
      console.log('frpc stderr:', data.toString());
    });

    // 等待 frpc 连接
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 检查进程是否还在运行
    if (frpsProcess.exitCode !== null && frpsProcess.exitCode !== 0) {
      throw new Error(`frps 进程已退出，代码: ${frpsProcess.exitCode}`);
    }
    if (frpcProcess.exitCode !== null && frpcProcess.exitCode !== 0) {
      throw new Error(`frpc 进程已退出，代码: ${frpcProcess.exitCode}`);
    }

    expect(frpcProcess.pid).toBeGreaterThan(0);
    console.log(`✓ frpc 已启动，PID: ${frpcProcess.pid}`);
  }, 15000);

  it('应该能够通过转发端口访问本地服务器', async () => {
    // 等待连接建立
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 尝试通过转发端口访问
    console.log(`尝试访问: http://127.0.0.1:${remotePort}`);
    const response = await fetch(`http://127.0.0.1:${remotePort}`);
    const text = await response.text();

    expect(text).toBe('Hello from test server!');
    expect(response.status).toBe(200);
    console.log(`✓ 成功通过转发端口 ${remotePort} 访问本地服务器`);
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
    console.log('✓ 成功处理 10 个并发连接');
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
    console.log('✓ POST 请求转发成功');
  }, 10000);

  it('应该正确转发自定义 HTTP 头', async () => {
    const response = await fetch(`http://127.0.0.1:${remotePort}`, {
      headers: {
        'X-Custom-Header': 'test-value',
        'User-Agent': 'E2E-Test-Agent',
      },
    });

    expect(response.status).toBe(200);
    console.log('✓ 自定义 HTTP 头转发成功');
  }, 10000);
});

describe('frp Token 认证 E2E 测试', () => {
  let frpsProcess: ReturnType<typeof execa>;
  let frpcProcess: ReturnType<typeof execa>;
  let frpsPort: number;

  const tempDir = path.join(process.env.TMP || '/tmp', 'frp-e2e-test-token');
  const frpsConfigPath = path.join(tempDir, 'frps.toml');
  const frpcConfigPath = path.join(tempDir, 'frpc.toml');

  const testToken = 'test-secret-token-12345';

  let frpsBinary: string;
  let frpcBinary: string;

  /**
   * 获取二进制文件路径
   *
   * 开发环境：直接使用 packages/ 目录下平台包中的二进制文件
   * 生产环境：用户通过 npm 安装后，二进制文件在 node_modules/ 中
   */
  async function getBinaryPaths(): Promise<{ frps: string; frpc: string }> {
    const platform = process.platform;
    const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
    const binaryExt = platform === 'win32' ? '.exe' : '';
    const frpsName = `frps${binaryExt}`;
    const frpcName = `frpc${binaryExt}`;

    const { fileURLToPath } = await import('url');
    const { dirname } = await import('path');
    const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));

    // 平台包目录名
    const frpsPlatformDir = `frps-${platform}-${arch}`;
    const frpcPlatformDir = `frpc-${platform}-${arch}`;

    // 优先使用 packages/ 目录中的二进制（开发环境）
    let frpsPath = path.join(rootDir, 'packages', frpsPlatformDir, frpsName);
    let frpcPath = path.join(rootDir, 'packages', frpcPlatformDir, frpcName);

    // 检查 packages/ 是否存在
    try {
      await fs.access(frpsPath);
      await fs.access(frpcPath);
      return { frps: frpsPath, frpc: frpcPath };
    } catch {
      // 尝试 node_modules/
      frpsPath = path.join(rootDir, 'node_modules', `@feng3d`, frpsPlatformDir, frpsName);
      frpcPath = path.join(rootDir, 'node_modules', `@feng3d`, frpcPlatformDir, frpcName);
      return { frps: frpsPath, frpc: frpcPath };
    }
  }

  beforeAll(async () => {
    await fs.mkdir(tempDir, { recursive: true });

    const paths = await getBinaryPaths();
    frpsBinary = paths.frps;
    frpcBinary = paths.frpc;

    frpsPort = await getRandomPort();

    // 生成带 token 的 frps 配置
    const frpsConfig = `bindPort = ${frpsPort}
auth.token = "${testToken}"
`;
    await fs.writeFile(frpsConfigPath, frpsConfig);

    console.log(`Token 认证测试配置: frps=${frpsPort}, token=${testToken}`);
  }, 30000);

  afterAll(async () => {
    // 优雅地清理所有进程
    await Promise.all([
      gracefulKill(frpcProcess),
      gracefulKill(frpsProcess),
    ]);

    // 清理临时文件
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  }, 30000);

  it('应该能够使用正确的 token 连接服务端', async () => {
    // 生成带正确 token 的 frpc 配置
    const frpcConfig = `serverAddr = "127.0.0.1"
serverPort = ${frpsPort}
auth.token = "${testToken}"

[[proxies]]
name = "test-with-token"
type = "tcp"
localIP = "127.0.0.1"
localPort = 80
remotePort = 8080
`;
    await fs.writeFile(frpcConfigPath, frpcConfig);

    // 启动 frps
    frpsProcess = execa(frpsBinary, ['-c', frpsConfigPath], {
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    const stdoutLogs: string[] = [];
    const stderrLogs: string[] = [];

    frpsProcess.stdout?.on('data', (data: Buffer) => {
      const msg = data.toString();
      stdoutLogs.push(msg);
    });

    frpsProcess.stderr?.on('data', (data: Buffer) => {
      const msg = data.toString();
      stderrLogs.push(msg);
    });

    await waitForPort(frpsPort, 10000);

    // 启动 frpc
    frpcProcess = execa(frpcBinary, ['-c', frpcConfigPath], {
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    let clientConnected = false;

    frpcProcess.stdout?.on('data', (data: Buffer) => {
      const msg = data.toString();
      if (msg.includes('login to server success') || msg.includes('start proxy success')) {
        clientConnected = true;
      }
    });

    // 等待连接
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 验证客户端成功连接
    expect(clientConnected).toBe(true);
    expect(frpcProcess.pid).toBeGreaterThan(0);
    expect(frpcProcess.exitCode).toBeNull();

    console.log('✓ 使用正确的 token 成功连接');
  }, 20000);

  it('应该拒绝使用错误 token 的客户端连接', async () => {
    // 重启 frps 确保干净状态
    await gracefulKill(frpsProcess);
    await new Promise(resolve => setTimeout(resolve, 1000));

    frpsProcess = execa(frpsBinary, ['-c', frpsConfigPath], {
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    await waitForPort(frpsPort, 10000);

    // 生成带错误 token 的 frpc 配置
    const wrongTokenConfigPath = path.join(tempDir, 'frpc-wrong.toml');
    const frpcConfig = `serverAddr = "127.0.0.1"
serverPort = ${frpsPort}
auth.token = "wrong-token-99999"

[[proxies]]
name = "test-wrong-token"
type = "tcp"
localIP = "127.0.0.1"
localPort = 80
remotePort = 8081
`;
    await fs.writeFile(wrongTokenConfigPath, frpcConfig);

    // 启动 frpc，预期会失败
    let authError = false;
    const outputChunks: string[] = [];

    try {
      const wrongClient = execa(frpcBinary, ['-c', wrongTokenConfigPath], {
        stdio: ['inherit', 'pipe', 'pipe'],
      });

      wrongClient.stdout?.on('data', (data: Buffer) => {
        const msg = data.toString();
        outputChunks.push(msg);
      });

      // 等待进程结束（预期会失败）
      await wrongClient;
    } catch (err: unknown) {
      // 预期的认证失败
      const error = err as { stdout?: string | Buffer };
      const output = String(error.stdout || '');
      outputChunks.push(output);
    }

    const allOutput = outputChunks.join('');
    // frp 会返回认证错误
    authError = allOutput.includes('token') && (allOutput.includes('failed') || allOutput.includes("doesn't match"));

    // 验证客户端未能连接
    expect(authError).toBe(true);

    console.log('✓ 错误 token 被正确拒绝');
  }, 20000);

  it('应该拒绝没有提供 token 的客户端连接', async () => {
    // 重启 frps
    await gracefulKill(frpsProcess);
    await new Promise(resolve => setTimeout(resolve, 1000));

    frpsProcess = execa(frpsBinary, ['-c', frpsConfigPath], {
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    await waitForPort(frpsPort, 10000);

    // 生成没有 token 的 frpc 配置
    const noTokenConfigPath = path.join(tempDir, 'frpc-no-token.toml');
    const frpcConfig = `serverAddr = "127.0.0.1"
serverPort = ${frpsPort}

[[proxies]]
name = "test-no-token"
type = "tcp"
localIP = "127.0.0.1"
localPort = 80
remotePort = 8082
`;
    await fs.writeFile(noTokenConfigPath, frpcConfig);

    // 启动 frpc，预期会失败
    let authError = false;
    const outputChunks: string[] = [];

    try {
      const noTokenClient = execa(frpcBinary, ['-c', noTokenConfigPath], {
        stdio: ['inherit', 'pipe', 'pipe'],
      });

      noTokenClient.stdout?.on('data', (data: Buffer) => {
        const msg = data.toString();
        outputChunks.push(msg);
      });

      // 等待进程结束（预期会失败）
      await noTokenClient;
    } catch (err: unknown) {
      // 预期的认证失败
      const error = err as { stdout?: string | Buffer };
      const output = String(error.stdout || '');
      outputChunks.push(output);
    }

    const allOutput = outputChunks.join('');
    // frp 会返回认证错误
    authError = allOutput.includes('token') && (allOutput.includes('failed') || allOutput.includes("doesn't match"));

    // 验证客户端未能连接
    expect(authError).toBe(true);

    console.log('✓ 未提供 token 被正确拒绝');
  }, 20000);
});
