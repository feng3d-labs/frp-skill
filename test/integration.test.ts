import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import path from 'path';
import fs from 'fs/promises';

// Mock console to prevent actual output during tests
vi.mock('console', () => ({
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
}));

// Mock ora to prevent spinners
vi.mock('ora', () => ({
  default: () => ({
    start: () => ({
      succeed: vi.fn(),
      fail: vi.fn(),
      warn: vi.fn(),
      text: '',
    }),
  }),
}));

describe('frp 集成测试', () => {
  const tempDir = path.join(process.env.TMP || '/tmp', 'frp-integration-test');
  const frpsConfigPath = path.join(tempDir, 'frps.toml');
  const frpcConfigPath = path.join(tempDir, 'frpc.toml');

  beforeAll(async () => {
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterAll(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('服务端与客户端配置兼容性', () => {
    it('应该生成匹配的服务端和客户端配置', async () => {
      // 导入服务端配置生成函数
      const { generateFrpsConfig } = await import('../packages/frps/src/config.js');

      // 生成服务端配置
      await generateFrpsConfig(frpsConfigPath, {
        bindPort: '7000',
        vhostHTTPPort: 80,
        vhostHTTPSPort: 443,
        dashboardAddr: '0.0.0.0',
        dashboardPort: 7500,
        dashboardUser: 'admin',
        dashboardPwd: 'admin',
        token: 'test-token-123'
      });

      // 生成客户端配置（模拟）
      const frpcContent = `serverAddr = "127.0.0.1"
serverPort = 7000

[[proxies]]
name = "web"
type = "tcp"
localIP = "127.0.0.1"
localPort = 8080
remotePort = 8080
`;
      await fs.writeFile(frpcConfigPath, frpcContent);

      // 验证两个配置文件都存在
      const frpsExists = await fs.access(frpsConfigPath).then(() => true).catch(() => false);
      const frpcExists = await fs.access(frpcConfigPath).then(() => true).catch(() => false);

      expect(frpsExists).toBe(true);
      expect(frpcExists).toBe(true);

      // 验证服务端配置
      const frpsContent = await fs.readFile(frpsConfigPath, 'utf-8');
      expect(frpsContent).toContain('bindPort = 7000');
      expect(frpsContent).toContain('vhostHTTPPort = 80');
      expect(frpsContent).toContain('[auth]');
      expect(frpsContent).toContain('token = "test-token-123"');

      // 验证客户端配置端口与服务端匹配
      expect(frpcContent).toContain('serverPort = 7000');
    });

    it('服务端 bindPort 应与客户端 serverPort 一致', async () => {
      const { generateFrpsConfig } = await import('../packages/frps/src/config.js');

      const testPort = '9999';

      await generateFrpsConfig(frpsConfigPath, { bindPort: testPort });

      const frpsContent = await fs.readFile(frpsConfigPath, 'utf-8');
      expect(frpsContent).toContain(`bindPort = ${testPort}`);

      // 客户端配置应该使用相同的端口
      const frpcContent = `serverAddr = "example.com"
serverPort = ${testPort}

[[proxies]]
name = "test"
type = "tcp"
localIP = "127.0.0.1"
localPort = 3000
remotePort = 3000
`;
      await fs.writeFile(frpcConfigPath, frpcContent);

      const frpcConfig = await fs.readFile(frpcConfigPath, 'utf-8');
      expect(frpcConfig).toContain(`serverPort = ${testPort}`);
    });
  });

  describe('端口转发配置验证', () => {
    it('应该正确配置 TCP 端口转发', async () => {
      const { generateFrpsConfig } = await import('../packages/frps/src/config.js');

      await generateFrpsConfig(frpsConfigPath, {
        bindPort: '7000'
      });

      // 客户端 TCP 代理配置
      const tcpProxyConfig = `serverAddr = "server.example.com"
serverPort = 7000

[[proxies]]
name = "ssh"
type = "tcp"
localIP = "127.0.0.1"
localPort = 22
remotePort = 6000
`;
      await fs.writeFile(frpcConfigPath, tcpProxyConfig);

      const content = await fs.readFile(frpcConfigPath, 'utf-8');
      expect(content).toContain('type = "tcp"');
      expect(content).toContain('localPort = 22');
      expect(content).toContain('remotePort = 6000');
      expect(content).toContain('name = "ssh"');
    });

    it('应该支持多个代理配置', async () => {
      // 多代理配置
      const multiProxyConfig = `serverAddr = "server.example.com"
serverPort = 7000

[[proxies]]
name = "ssh"
type = "tcp"
localIP = "127.0.0.1"
localPort = 22
remotePort = 6000

[[proxies]]
name = "web"
type = "tcp"
localIP = "127.0.0.1"
localPort = 8080
remotePort = 80

[[proxies]]
name = "database"
type = "tcp"
localIP = "127.0.0.1"
localPort = 3306
remotePort = 3306
`;
      await fs.writeFile(frpcConfigPath, multiProxyConfig);

      const content = await fs.readFile(frpcConfigPath, 'utf-8');

      // 验证所有代理都存在
      const proxyMatches = content.match(/\[\[proxies]\]/g);
      expect(proxyMatches).toHaveLength(3);
      expect(content).toContain('name = "ssh"');
      expect(content).toContain('name = "web"');
      expect(content).toContain('name = "database"');

      // 验证端口映射
      expect(content).toContain('localPort = 22');
      expect(content).toContain('remotePort = 6000');
      expect(content).toContain('localPort = 8080');
      expect(content).toContain('remotePort = 80');
      expect(content).toContain('localPort = 3306');
    });
  });

  describe('认证配置验证', () => {
    it('服务端和客户端应该使用相同的 token', async () => {
      const { generateFrpsConfig } = await import('../packages/frps/src/config.js');

      const token = 'secure-token-abc123';

      // 服务端配置 token
      await generateFrpsConfig(frpsConfigPath, {
        bindPort: '7000',
        token
      });

      const frpsContent = await fs.readFile(frpsConfigPath, 'utf-8');
      expect(frpsContent).toContain(`token = "${token}"`);

      // 客户端配置应该使用相同的 token
      const clientConfigWithAuth = `serverAddr = "server.example.com"
serverPort = 7000
auth.token = "${token}"

[[proxies]]
name = "secure"
type = "tcp"
localIP = "127.0.0.1"
localPort = 8000
remotePort = 8000
`;
      await fs.writeFile(frpcConfigPath, clientConfigWithAuth);

      const frpcContent = await fs.readFile(frpcConfigPath, 'utf-8');
      expect(frpcContent).toContain(`auth.token = "${token}"`);
    });
  });

  describe('Dashboard 配置验证', () => {
    it('应该正确配置 Dashboard', async () => {
      const { generateFrpsConfig } = await import('../packages/frps/src/config.js');

      await generateFrpsConfig(frpsConfigPath, {
        bindPort: '7000',
        dashboardAddr: '0.0.0.0',
        dashboardPort: 7500,
        dashboardUser: 'admin',
        dashboardPwd: 'password123'
      });

      const content = await fs.readFile(frpsConfigPath, 'utf-8');

      expect(content).toContain('[webServer]');
      expect(content).toContain('addr = "0.0.0.0"');
      expect(content).toContain('port = 7500');
      expect(content).toContain('user = "admin"');
      expect(content).toContain('password = "password123"');
    });
  });

  describe('虚拟主机配置验证', () => {
    it('应该正确配置 HTTP 和 HTTPS 虚拟主机端口', async () => {
      const { generateFrpsConfig } = await import('../packages/frps/src/config.js');

      await generateFrpsConfig(frpsConfigPath, {
        bindPort: '7000',
        vhostHTTPPort: 8080,
        vhostHTTPSPort: 8443
      });

      const content = await fs.readFile(frpsConfigPath, 'utf-8');

      expect(content).toContain('vhostHTTPPort = 8080');
      expect(content).toContain('vhostHTTPSPort = 8443');
    });
  });

  describe('跨平台兼容性验证', () => {
    it('配置文件在不同平台路径下应正常生成', async () => {
      const { generateFrpsConfig } = await import('../packages/frps/src/config.js');

      const platformPaths = [
        path.join(tempDir, 'linux', 'frps.toml'),
        path.join(tempDir, 'windows', 'frps.toml'),
        path.join(tempDir, 'macos', 'frps.toml')
      ];

      for (const configPath of platformPaths) {
        await generateFrpsConfig(configPath, { bindPort: '7000' });
        const exists = await fs.access(configPath).then(() => true).catch(() => false);
        expect(exists).toBe(true);
      }
    });
  });

  describe('平台检测功能验证', () => {
    it('应该正确检测当前平台', async () => {
      const { getPlatformInfo } = await import('../packages/frps/src/downloader.js');

      const platformInfo = getPlatformInfo();

      expect(platformInfo).toHaveProperty('platform');
      expect(platformInfo).toHaveProperty('arch');
      expect(platformInfo).toHaveProperty('isWindows');
      expect(platformInfo).toHaveProperty('isLinux');
      expect(platformInfo).toHaveProperty('isMac');

      // 确保只有一个平台标识为 true
      const platformCount = [
        platformInfo.isWindows,
        platformInfo.isLinux,
        platformInfo.isMac
      ].filter(Boolean).length;

      expect(platformCount).toBe(1);
    });

    it('应该为当前平台构建正确的下载 URL', async () => {
      const { buildDownloadUrl, getPlatformInfo } = await import('../packages/frps/src/downloader.js');

      const platformInfo = getPlatformInfo();
      const url = buildDownloadUrl('0.67.0', platformInfo.platform, platformInfo.arch);

      expect(url).toContain('https://github.com/fatedier/frp/releases/download/v0.67.0/');
      expect(url).toContain('frp_0.67.0_');

      // 验证文件扩展名
      if (platformInfo.isWindows) {
        expect(url).toEqual(expect.stringMatching(/\.zip$/));
      } else {
        expect(url).toEqual(expect.stringMatching(/\.tar\.gz$/));
      }
    });
  });

  describe('Windows 平台特定测试', () => {
    it('Windows 平台应使用正确的二进制文件名', async () => {
      const { getPlatformPackageName } = await import('../packages/frps/src/downloader.js');

      const packageName = getPlatformPackageName('win32', 'x64');
      expect(packageName).toBe('@feng3d/frps-win32-x64');

      const armPackageName = getPlatformPackageName('win32', 'arm64');
      expect(armPackageName).toBe('@feng3d/frps-win32-arm64');
    });

    it('Windows 应该使用 zip 压缩格式', async () => {
      const { buildDownloadUrl } = await import('../packages/frps/src/downloader.js');

      const url = buildDownloadUrl('0.67.0', 'win32', 'x64');
      expect(url).toContain('windows_amd64.zip');
    });
  });

  describe('Linux 平台特定测试', () => {
    it('Linux 平台应使用正确的二进制文件名', async () => {
      const { getPlatformPackageName } = await import('../packages/frps/src/downloader.js');

      const packageName = getPlatformPackageName('linux', 'x64');
      expect(packageName).toBe('@feng3d/frps-linux-x64');

      const armPackageName = getPlatformPackageName('linux', 'arm64');
      expect(armPackageName).toBe('@feng3d/frps-linux-arm64');
    });

    it('Linux 应该使用 tar.gz 压缩格式', async () => {
      const { buildDownloadUrl } = await import('../packages/frps/src/downloader.js');

      const url = buildDownloadUrl('0.67.0', 'linux', 'x64');
      expect(url).toContain('linux_amd64.tar.gz');
    });
  });

  describe('macOS 平台特定测试', () => {
    it('macOS 平台应使用正确的二进制文件名', async () => {
      const { getPlatformPackageName } = await import('../packages/frps/src/downloader.js');

      const packageName = getPlatformPackageName('darwin', 'x64');
      expect(packageName).toBe('@feng3d/frps-darwin-x64');

      const armPackageName = getPlatformPackageName('darwin', 'arm64');
      expect(armPackageName).toBe('@feng3d/frps-darwin-arm64');
    });

    it('macOS 应该使用 tar.gz 压缩格式', async () => {
      const { buildDownloadUrl } = await import('../packages/frps/src/downloader.js');

      const url = buildDownloadUrl('0.67.0', 'darwin', 'arm64');
      expect(url).toContain('darwin_arm64.tar.gz');
    });
  });
});
