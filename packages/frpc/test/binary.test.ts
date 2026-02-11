import { describe, it, expect } from 'vitest';
import { getPlatformInfo } from '../src/binary.js';

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
});
