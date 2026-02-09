import { createServer } from 'net';
import { Socket } from 'net';

/**
 * 获取一个可用的随机端口
 */
export async function getRandomPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(() => {
      const port = (server.address() as { port: number }).port;
      server.close(() => resolve(port));
    });
  });
}

/**
 * 等待指定端口可访问
 */
export async function waitForPort(
  port: number,
  timeout = 5000
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      await new Promise<void>((resolve, reject) => {
        const socket = new Socket();
        socket.once('connect', () => {
          socket.destroy();
          resolve();
        });
        socket.once('error', reject);
        socket.connect(port, '127.0.0.1');
      });
      return;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  throw new Error(`Port ${port} did not become available within ${timeout}ms`);
}

/**
 * 等待指定端口不可访问（端口关闭）
 */
export async function waitForPortClose(
  port: number,
  timeout = 5000
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      await new Promise<void>((resolve, reject) => {
        const socket = new Socket();
        socket.once('connect', () => {
          socket.destroy();
          reject(new Error('Port still open'));
        });
        socket.once('error', () => {
          resolve();
        });
        socket.connect(port, '127.0.0.1');
      });
    } catch {
      await new Promise(resolve => setTimeout(resolve, 100));
      continue;
    }
    return;
  }

  throw new Error(`Port ${port} did not close within ${timeout}ms`);
}
