# @feng3d/frp-monorepo

frp 内网穿透工具的 npm 包集合，提供便捷的命令行工具快速部署 frp 服务端和客户端。

## 包列表

- **[@feng3d/frps](./packages/frps/)** - frp 服务端部署工具
- **[@feng3d/frpc](./packages/frpc/)** - frp 客户端部署工具

## 快速开始

### 服务端 (frps)

```bash
# 使用 npx 直接运行，无需安装
npx @feng3d/frps -p 7000

# 或全局安装后使用
npm install -g @feng3d/frps
frps -p 7000
```

### 客户端 (frpc)

```bash
# 使用 npx 直接运行
npx @feng3d/frpc --server example.com --local-port 8080 --remote-port 8080

# 或全局安装后使用
npm install -g @feng3d/frpc
frpc --server example.com --local-port 8080 --remote-port 8080
```

## Claude Code Skill

本仓库同时也是 [Claude Code](https://claude.com/claude-code) 的 Skill，可以通过以下方式安装：

```bash
npx skills add wardenfeng/frp-skill
```

安装后可以在 Claude Code 中直接描述需求，例如：

> 帮我把本地 http://127.0.0.1:8080 通过 my-server.com 暴露到公网

## 开发

```bash
# 安装依赖
npm install

# 构建所有包
npm run build

# 运行测试
npm test

# 运行 E2E 测试
npm run test:e2e
```

## 许可证

MIT
