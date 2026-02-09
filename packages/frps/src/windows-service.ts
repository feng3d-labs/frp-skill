import path from 'path';
import fs from 'fs/promises';
import { execaCommand } from 'execa';

export interface WindowsServiceOptions {
  name: string;
  binaryPath: string;
  configPath: string;
  description: string;
}

/**
 * 创建 Windows 服务使用 NSSM (Non-Sucking Service Manager)
 * 如果 NSSM 不可用，提供手动启动说明
 */
export async function setupWindowsService(options: WindowsServiceOptions): Promise<boolean> {
  const { name, binaryPath, configPath, description } = options;

  try {
    // 检查是否有管理员权限
    await execaCommand('net session', { stdio: 'pipe' });
  } catch {
    console.log('警告: 需要管理员权限来创建 Windows 服务');
    return false;
  }

  // 尝试使用 NSSM
  try {
    const nssmPath = 'C:\\Program Files\\NSSM\\nssm.exe';
    try {
      await fs.access(nssmPath);
    } catch {
      // NSSM 未安装，提供安装说明
      console.log('提示: 安装 Windows 服务需要 NSSM');
      console.log('下载: https://nssm.cc/download');
      console.log('或使用 Chocolatey: choco install nssm');
      return false;
    }

    // 创建服务
    await execaCommand(`"${nssmPath}" install ${name} "${binaryPath}" -c "${configPath}"`, { stdio: 'pipe' });
    await execaCommand(`"${nssmPath}" set ${name} Description "${description}"`, { stdio: 'pipe' });
    await execaCommand(`"${nssmPath}" set ${name} AppDirectory "${path.dirname(binaryPath)}"`, { stdio: 'pipe' });

    console.log(`Windows 服务 "${name}" 已创建`);
    return true;
  } catch (error) {
    console.log('无法创建 Windows 服务:', error.message);
    return false;
  }
}

/**
 * 启动 Windows 服务
 */
export async function startWindowsService(name: string): Promise<void> {
  try {
    await execaCommand(`net start ${name}`, { stdio: 'pipe' });
  } catch (error) {
    throw new Error(`启动服务失败: ${error.message}`);
  }
}

/**
 * 停止 Windows 服务
 */
export async function stopWindowsService(name: string): Promise<void> {
  try {
    await execaCommand(`net stop ${name}`, { stdio: 'pipe' });
  } catch (error) {
    throw new Error(`停止服务失败: ${error.message}`);
  }
}

/**
 * 配置 Windows 防火墙
 */
export async function configureWindowsFirewall(ports: string[]): Promise<void> {
  for (const port of ports) {
    try {
      await execaCommand(
        `netsh advfirewall firewall add rule name="frps-${port}" dir=in action=allow protocol=TCP localport=${port}`,
        { stdio: 'pipe' }
      );
    } catch {
      console.warn(`警告: 无法添加防火墙规则 ${port}，请手动配置`);
    }
  }
}
