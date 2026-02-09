import { execaCommand } from 'execa';

export async function configureFirewall(ports: string[]): Promise<void> {
  // 尝试 firewalld
  try {
    await execaCommand('firewall-cmd --version', { stdio: 'pipe' });
    for (const port of ports) {
      await execaCommand(`firewall-cmd --add-port=${port}/tcp --permanent`, {
        stdio: 'pipe',
        reject: false
      });
    }
    await execaCommand('firewall-cmd --reload', { stdio: 'pipe', reject: false });
    return;
  } catch {
    // firewalld 不可用
  }

  // 尝试 ufw
  try {
    await execaCommand('ufw version', { stdio: 'pipe' });
    for (const port of ports) {
      await execaCommand(`ufw allow ${port}/tcp`, {
        stdio: 'pipe',
        reject: false
      });
    }
    return;
  } catch {
    // ufw 不可用
  }

  // 都不可用，发出警告
  console.warn('警告: 未检测到防火墙工具，请手动开放端口: ' + ports.join(', '));
}
