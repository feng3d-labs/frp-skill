import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts', 'packages/*/test/**/*.test.ts'],
    // 设置文件，在所有测试运行前执行
    setupFiles: ['./test/vitest-setup.ts'],
    // 忽略测试清理时的未处理 promise rejection（E2E 测试 kill 进程时的预期行为）
    dangerouslyIgnoreUnhandledErrors: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['packages/*/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/dist/**', '**/node_modules/**'],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './packages'),
    },
  },
});
