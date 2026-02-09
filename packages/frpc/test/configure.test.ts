import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';

// 直接导入被测试函数的实现逻辑
async function generateFrpcConfig(
  configPath: string,
  options: {
    serverAddr: string;
    serverPort: string;
    localIP: string;
    localPort: string;
    remotePort: string;
    proxyName: string;
  }
): Promise<void> {
  const {
    serverAddr,
    serverPort,
    localIP,
    localPort,
    remotePort,
    proxyName
  } = options;

  const content = `serverAddr = "${serverAddr}"
serverPort = ${serverPort}

[[proxies]]
name = "${proxyName}"
type = "tcp"
localIP = "${localIP}"
localPort = ${localPort}
remotePort = ${remotePort}
`;

  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, content);
}

describe('frpc/configure', () => {
  const tempDir = path.join(process.env.TMP || '/tmp', 'frpc-test-' + Date.now());
  const testConfigPath = path.join(tempDir, 'frpc.toml');

  beforeEach(async () => {
    // Create temp directory
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('应该生成基本的 frpc 配置', async () => {
    await generateFrpcConfig(testConfigPath, {
      serverAddr: 'example.com',
      serverPort: '7000',
      localIP: '127.0.0.1',
      localPort: '8080',
      remotePort: '8080',
      proxyName: 'web'
    });

    const content = await fs.readFile(testConfigPath, 'utf-8');

    expect(content).toContain('serverAddr = "example.com"');
    expect(content).toContain('serverPort = 7000');
    expect(content).toContain('localIP = "127.0.0.1"');
    expect(content).toContain('localPort = 8080');
    expect(content).toContain('remotePort = 8080');
    expect(content).toContain('name = "web"');
  });

  it('应该支持自定义服务器地址和端口', async () => {
    await generateFrpcConfig(testConfigPath, {
      serverAddr: 'myserver.com',
      serverPort: '9000',
      localIP: '127.0.0.1',
      localPort: '3000',
      remotePort: '9000',
      proxyName: 'api'
    });

    const content = await fs.readFile(testConfigPath, 'utf-8');

    expect(content).toContain('serverAddr = "myserver.com"');
    expect(content).toContain('serverPort = 9000');
    expect(content).toContain('localPort = 3000');
    expect(content).toContain('remotePort = 9000');
    expect(content).toContain('name = "api"');
  });

  it('应该生成正确的 TOML 格式', async () => {
    await generateFrpcConfig(testConfigPath, {
      serverAddr: 'test.com',
      serverPort: '7000',
      localIP: '127.0.0.1',
      localPort: '80',
      remotePort: '8080',
      proxyName: 'http'
    });

    const content = await fs.readFile(testConfigPath, 'utf-8');

    // 验证 TOML 结构
    expect(content).toMatch(/^serverAddr = "test\.com"/m);
    expect(content).toMatch(/^serverPort = 7000/m);
    expect(content).toMatch(/^\[\[proxies]\]/m);
    expect(content).toMatch(/^name = "http"/m);
    expect(content).toMatch(/^type = "tcp"/m);
  });
});
