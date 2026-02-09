import fs from 'fs/promises';
import path from 'path';
import { execaCommand } from 'execa';

export interface ServiceOptions {
  name: string;
  binaryPath: string;
  configPath: string;
  description?: string;
}

export async function setupSystemdService(options: ServiceOptions): Promise<void> {
  const { name, binaryPath, configPath, description = 'frp service' } = options;

  const serviceContent = `[Unit]
Description=${description}
After=network.target

[Service]
Type=simple
ExecStart=${binaryPath} -c ${configPath}
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
`;

  const servicePath = path.join('/etc/systemd/system', `${name}.service`);

  try {
    // 写入服务文件
    await fs.writeFile(servicePath, serviceContent, { mode: 0o644 });

    // 重载 systemd
    await execaCommand('systemctl daemon-reload', { stdio: 'inherit' });

    // 启用服务（开机自启）
    await execaCommand(`systemctl enable ${name}`, { stdio: 'inherit' });
  } catch (error) {
    throw new Error(`systemd 服务配置失败: ${error.message}`);
  }
}

export async function startService(name: string): Promise<void> {
  try {
    await execaCommand(`systemctl start ${name}`, { stdio: 'inherit' });
  } catch (error) {
    throw new Error(`启动服务失败: ${error.message}`);
  }
}

export async function stopService(name: string): Promise<void> {
  try {
    await execaCommand(`systemctl stop ${name}`, { stdio: 'inherit' });
  } catch (error) {
    throw new Error(`停止服务失败: ${error.message}`);
  }
}

export async function getServiceStatus(name: string): Promise<string> {
  try {
    const { stdout } = await execaCommand(`systemctl is-active ${name}`);
    return stdout.trim();
  } catch (error) {
    return 'unknown';
  }
}
