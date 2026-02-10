#!/usr/bin/env node

/**
 * 版本同步脚本 - 将根包版本同步到所有子包
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.dirname(__dirname);

const PACKAGES = [
  'packages/frps',
  'packages/frpc',
];

async function main() {
  const newVersion = process.env.npm_package_version || process.argv[2];

  if (!newVersion || !/^\d+\.\d+\.\d+/.test(newVersion)) {
    console.log('用法: npm version [patch|minor|major|x.y.z]');
    process.exit(0);
  }

  console.log(`\n同步版本: ${newVersion}\n`);

  for (const pkg of PACKAGES) {
    const fullPath = path.join(rootDir, pkg, 'package.json');
    const content = JSON.parse(await fs.readFile(fullPath, 'utf-8'));
    content.version = newVersion;
    await fs.writeFile(fullPath, JSON.stringify(content, null, 2) + '\n');
    console.log(`  ${pkg}: ${newVersion}`);
  }

  console.log('\n版本同步完成！');
}

main().catch(console.error);
