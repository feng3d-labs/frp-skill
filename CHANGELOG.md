# Changelog

All notable changes to this project will be documented in this file.

## [0.68.1] - 2026-02-10

### Changed
- 移除 GitHub 下载功能，统一使用 npm 平台包

## [0.68.0] - 2026-02-10

### Changed
- feat: 添加 Windows 环境自动检测，支持 Git Bash/MinGW

## [0.67.9] - 2026-02-10

### Changed
- feat: 添加 GitHub 下载回退机制，支持 npx 环境自动下载二进制文件

## [0.67.8] - 2026-02-10

### Changed
- fix: 修复 npx 环境下平台包路径解析问题

## [0.67.7] - 2026-02-10

### Changed
- fix: 修复平台包二进制文件路径解析问题，同步 optionalDependencies 版本

## [0.67.6] - 2026-02-10

### Changed
- fix: 修复平台包二进制文件路径解析问题

## [0.67.0] - 2026-02-10

### Added
- 初始版本发布
- 支持 @feng3d/frps 服务端一键部署
- 支持 @feng3d/frpc 客户端一键配置
- 自动下载对应平台的 frp 二进制文件
- 完整的单元测试和 E2E 测试
- 基于 frp v0.67.0 构建
