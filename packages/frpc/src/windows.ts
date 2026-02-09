import { execaCommand } from 'execa';

export async function addDefenderExclusion(dir: string): Promise<boolean> {
  try {
    const command = `Add-MpPreference -ExclusionPath '${dir}'`;
    await execaCommand(`powershell -Command "${command}"`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}
