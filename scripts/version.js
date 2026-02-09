#!/usr/bin/env node

/**
 * 版本管理脚本
 * 用法: node scripts/version.js [patch|minor|major|version] [--message "变更内容"]
 *
 * 示例:
 *   node scripts/version.js patch                                   # 0.0.1 -> 0.0.2
 *   node scripts/version.js patch --message "修复 bug"              # 带变更内容
 *   node scripts/version.js minor                                   # 0.0.1 -> 0.1.0
 *   node scripts/version.js major                                   # 0.0.1 -> 1.0.0
 *   node scripts/version.js 1.2.3                                   # 设置为 1.2.3
 */

import fs from 'fs/promises';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.dirname(__dirname);

// 获取当前版本
async function getCurrentVersion() {
  const pkgPath = path.join(rootDir, 'package.json');
  const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));
  return pkg.version;
}

// 解析新版本
function getNewVersion(current, input) {
  if (!input) {
    console.error('请指定版本类型 (patch/minor/major) 或具体版本号');
    process.exit(1);
  }

  // 如果是具体的版本号
  if (/^\d+\.\d+\.\d+/.test(input)) {
    return input;
  }

  const parts = current.split('.').map(Number);

  switch (input) {
    case 'patch':
      parts[2] += 1;
      break;
    case 'minor':
      parts[1] += 1;
      parts[2] = 0;
      break;
    case 'major':
      parts[0] += 1;
      parts[1] = 0;
      parts[2] = 0;
      break;
    default:
      console.error(`未知的版本类型: ${input}`);
      process.exit(1);
  }

  return parts.join('.');
}

// 更新 package.json 版本
async function updateVersion(packagePath, newVersion) {
  const content = await fs.readFile(packagePath, 'utf-8');
  const pkg = JSON.parse(content);
  const oldVersion = pkg.version;
  pkg.version = newVersion;
  await fs.writeFile(packagePath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`  ${packagePath}: ${oldVersion} -> ${newVersion}`);
}

// 获取变更内容
async function getChanges(cliMessage) {
  if (cliMessage) {
    return cliMessage;
  }

  // 从命令行交互输入
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('\n请输入本次变更内容 (一行): ', (answer) => {
      rl.close();
      resolve(answer || '版本更新');
    });
  });
}

// 更新 CHANGELOG.md
async function updateChangelog(newVersion, changes) {
  const changelogPath = path.join(rootDir, 'CHANGELOG.md');
  let content = '';

  try {
    content = await fs.readFile(changelogPath, 'utf-8');
  } catch {
    // 文件不存在，创建默认内容
    content = '# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n';
  }

  const today = new Date().toISOString().split('T')[0];
  const newEntry = `## [${newVersion}] - ${today}\n\n### Changed\n- ${changes}\n\n`;

  // 在第一个 ## [ 之前插入新版本
  const firstVersionIndex = content.indexOf('## [');
  if (firstVersionIndex === -1) {
    content = content + '\n' + newEntry;
  } else {
    content = content.slice(0, firstVersionIndex) + newEntry + content.slice(firstVersionIndex);
  }

  await fs.writeFile(changelogPath, content);
  console.log(`  ${changelogPath}: 添加版本 ${newVersion} 变更记录`);
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  const versionType = args[0];

  // 解析 --message 参数
  let message = '';
  const messageIndex = args.indexOf('--message');
  if (messageIndex !== -1 && args[messageIndex + 1]) {
    message = args[messageIndex + 1];
  }

  const currentVersion = await getCurrentVersion();
  const newVersion = getNewVersion(currentVersion, versionType);

  console.log(`\n版本升级: ${currentVersion} -> ${newVersion}\n`);
  console.log('更新文件:');

  // 更新根 package.json
  await updateVersion(path.join(rootDir, 'package.json'), newVersion);

  // 更新 packages/frps/package.json
  await updateVersion(path.join(rootDir, 'packages', 'frps', 'package.json'), newVersion);

  // 更新 packages/frpc/package.json
  await updateVersion(path.join(rootDir, 'packages', 'frpc', 'package.json'), newVersion);

  // 获取并更新 CHANGELOG
  const changes = await getChanges(message);
  await updateChangelog(newVersion, changes);

  console.log('\n版本更新完成！\n');
  console.log('提示: 使用以下命令提交更改:');
  console.log(`  git add -A`);
  console.log(`  git commit -m "chore: bump version to ${newVersion}"`);
  console.log(`  git push origin main`);
  console.log(`\n推送后将自动触发发布流程`);
}

main().catch(console.error);
