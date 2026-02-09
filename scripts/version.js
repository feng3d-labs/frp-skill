#!/usr/bin/env node

/**
 * 版本管理脚本
 * 用法: npm version [patch|minor|major|x.y.z]
 *
 * 此脚本作为 npm version 的钩子，在 npm version 升级版本后：
 * 1. 同步更新子包版本
 * 2. 更新 CHANGELOG.md
 *
 * 完成后需要手动提交并推送，GitHub Actions 会在发布成功后创建 tag
 *
 * 示例:
 *   npm version patch       # 0.0.1 -> 0.0.2
 *   npm version minor       # 0.0.1 -> 0.1.0
 *   npm version major       # 0.0.1 -> 1.0.0
 *   npm version 1.2.3       # 设置为 1.2.3
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

// 更新 package.json 版本
async function updateVersion(packagePath, newVersion) {
  const content = await fs.readFile(packagePath, 'utf-8');
  const pkg = JSON.parse(content);
  const oldVersion = pkg.version;
  pkg.version = newVersion;
  await fs.writeFile(packagePath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`  ${path.relative(rootDir, packagePath)}: ${oldVersion} -> ${newVersion}`);
}

// 获取变更内容
async function getChanges() {
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
  console.log(`  CHANGELOG.md: 添加版本 ${newVersion} 变更记录`);
}

// 主函数
async function main() {
  // npm version 会将新版本作为第一个参数传入
  const newVersion = process.env.npm_package_version || process.argv[2];

  if (!newVersion || !/^\d+\.\d+\.\d+/.test(newVersion)) {
    console.log('用法: npm version [patch|minor|major|x.y.z]');
    console.log('或者直接使用 npm version 命令，此脚本会自动同步子包版本');
    process.exit(0);
  }

  const currentVersion = await getCurrentVersion();

  console.log(`\n同步版本: ${currentVersion} -> ${newVersion}\n`);
  console.log('更新文件:');

  // 更新 packages/frps/package.json
  await updateVersion(path.join(rootDir, 'packages', 'frps', 'package.json'), newVersion);

  // 更新 packages/frpc/package.json
  await updateVersion(path.join(rootDir, 'packages', 'frpc', 'package.json'), newVersion);

  // 获取并更新 CHANGELOG
  const changes = await getChanges();
  await updateChangelog(newVersion, changes);

  console.log('\n版本同步完成！');
  console.log('\n请执行以下命令提交并推送：');
  console.log(`  git add -A`);
  console.log(`  git commit -m "chore: bump version to ${newVersion}"`);
  console.log(`  git push origin main`);
  console.log('\n推送后 GitHub Actions 将自动发布并创建 tag');
}

main().catch(console.error);
