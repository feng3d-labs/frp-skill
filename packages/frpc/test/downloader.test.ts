import { describe, it, expect } from 'vitest';
import { getPlatformInfo, getPlatformPackageName, buildDownloadUrl } from '../src/downloader.js';

describe('frpc/downloader', () => {
  describe('getPlatformInfo', () => {
    it('应该返回正确的平台信息', () => {
      const platformInfo = getPlatformInfo();

      expect(platformInfo).toHaveProperty('platform');
      expect(platformInfo).toHaveProperty('arch');
      expect(platformInfo).toHaveProperty('isWindows');
      expect(platformInfo).toHaveProperty('isLinux');
      expect(platformInfo).toHaveProperty('isMac');

      // 检查互斥性
      const trueValues = [
        platformInfo.isWindows,
        platformInfo.isLinux,
        platformInfo.isMac
      ].filter(Boolean).length;
      expect(trueValues).toBe(1);
    });
  });

  describe('getPlatformPackageName', () => {
    it('应该返回正确的 Linux x64 包名', () => {
      expect(getPlatformPackageName('linux', 'x64')).toBe('@feng3d/frpc-linux-x64');
    });

    it('应该返回正确的 Linux ARM64 包名', () => {
      expect(getPlatformPackageName('linux', 'arm64')).toBe('@feng3d/frpc-linux-arm64');
    });

    it('应该返回正确的 Windows x64 包名', () => {
      expect(getPlatformPackageName('win32', 'x64')).toBe('@feng3d/frpc-win32-x64');
    });

    it('应该返回正确的 macOS x64 包名', () => {
      expect(getPlatformPackageName('darwin', 'x64')).toBe('@feng3d/frpc-darwin-x64');
    });

    it('应该返回正确的 macOS ARM64 包名', () => {
      expect(getPlatformPackageName('darwin', 'arm64')).toBe('@feng3d/frpc-darwin-arm64');
    });
  });

  describe('buildDownloadUrl', () => {
    it('应该为 Linux x64 构建正确的下载 URL', () => {
      const url = buildDownloadUrl('0.67.0', 'linux', 'x64');
      expect(url).toBe('https://github.com/fatedier/frp/releases/download/v0.67.0/frp_0.67.0_linux_amd64.tar.gz');
    });

    it('应该为 Linux ARM64 构建正确的下载 URL', () => {
      const url = buildDownloadUrl('0.67.0', 'linux', 'arm64');
      expect(url).toBe('https://github.com/fatedier/frp/releases/download/v0.67.0/frp_0.67.0_linux_arm64.tar.gz');
    });

    it('应该为 Windows x64 构建正确的下载 URL', () => {
      const url = buildDownloadUrl('0.67.0', 'win32', 'x64');
      expect(url).toBe('https://github.com/fatedier/frp/releases/download/v0.67.0/frp_0.67.0_windows_amd64.zip');
    });

    it('应该为 macOS x64 构建正确的下载 URL', () => {
      const url = buildDownloadUrl('0.67.0', 'darwin', 'x64');
      expect(url).toBe('https://github.com/fatedier/frp/releases/download/v0.67.0/frp_0.67.0_darwin_amd64.tar.gz');
    });

    it('应该为 macOS ARM64 构建正确的下载 URL', () => {
      const url = buildDownloadUrl('0.67.0', 'darwin', 'arm64');
      expect(url).toBe('https://github.com/fatedier/frp/releases/download/v0.67.0/frp_0.67.0_darwin_arm64.tar.gz');
    });

    it('应该支持不同版本号', () => {
      const url = buildDownloadUrl('0.60.0', 'linux', 'x64');
      expect(url).toContain('v0.60.0');
    });
  });
});
