import { describe, it, expect } from 'vitest';
import { getPlatformInfo, getPlatformPackageName } from '../src/binary.js';

describe('frpc/binary', () => {
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
});
