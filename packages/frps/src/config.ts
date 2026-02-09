import fs from 'fs/promises';

export interface FrpsConfigOptions {
  bindPort: string;
  vhostHTTPPort?: number;
  vhostHTTPSPort?: number;
  dashboardAddr?: string;
  dashboardPort?: number;
  dashboardUser?: string;
  dashboardPwd?: string;
  token?: string;
}

export async function generateFrpsConfig(
  configPath: string,
  options: FrpsConfigOptions
): Promise<void> {
  const { bindPort } = options;

  // 基础配置
  let content = `bindPort = ${bindPort}\n`;

  // 可选配置
  if (options.vhostHTTPPort) {
    content += `\nvhostHTTPPort = ${options.vhostHTTPPort}\n`;
  }
  if (options.vhostHTTPSPort) {
    content += `vhostHTTPSPort = ${options.vhostHTTPSPort}\n`;
  }

  // Dashboard 配置
  if (options.dashboardAddr !== undefined && options.dashboardPort) {
    content += `\n[webServer]\n`;
    content += `addr = "${options.dashboardAddr}"\n`;
    content += `port = ${options.dashboardPort}\n`;
    if (options.dashboardUser) {
      content += `user = "${options.dashboardUser}"\n`;
    }
    if (options.dashboardPwd) {
      content += `password = "${options.dashboardPwd}"\n`;
    }
  }

  // 认证配置
  if (options.token) {
    content += `\n[auth]\n`;
    content += `token = "${options.token}"\n`;
  }

  // 确保目录存在
  await fs.mkdir(path.dirname(configPath), { recursive: true });

  // 写入配置文件
  await fs.writeFile(configPath, content);
}
