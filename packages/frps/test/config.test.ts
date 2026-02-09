import { describe, it, expect } from 'vitest';
import { generateFrpsConfig } from '../src/config.js';

describe('frps/config', () => {
  describe('generateFrpsConfig', () => {
    it('应该生成基本的 frps 配置', async () => {
      const configPath = '/tmp/test-frps.toml';
      await generateFrpsConfig(configPath, { bindPort: '7000' });

      const content = await import('fs/promises').then(fs => fs.readFile(configPath, 'utf-8'));
      expect(content).toContain('bindPort = 7000');
    });

    it('应该支持自定义端口', async () => {
      const configPath = '/tmp/test-frps-custom.toml';
      await generateFrpsConfig(configPath, { bindPort: '8080' });

      const content = await import('fs/promises').then(fs => fs.readFile(configPath, 'utf-8'));
      expect(content).toContain('bindPort = 8080');
    });
  });
});
