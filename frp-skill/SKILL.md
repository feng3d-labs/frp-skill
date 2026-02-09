---
name: frp-skill
description: 部署 frp (fatedier/frp) 实现内网穿透，将本地服务暴露到公网。当用户需要配置 frp 反向代理、配置 frpc/frps、通过公网服务器暴露本地 HTTP/TCP 服务、或进行 NAT 穿透/内网穿透时使用此技能。覆盖 Windows 客户端和 Linux 服务端部署。
---

# frp 内网穿透部署

将本地服务（如 `http://127.0.0.1:端口`）通过公网服务器暴露，实现公网访问（如 `http://example.com:端口`）。

本技能使用 npm 包 `@feng3d/frps` 和 `@feng3d/frpc` 实现一键部署。

## 工作流程

1. 收集用户参数
2. 在公网 Linux 服务器上部署 frps（服务端）
3. 在本地 Windows/macOS 机器上部署 frpc（客户端）
4. 验证连通性

## 第一步：收集参数

需要的信息：
- `SERVER_ADDR` — 公网服务器域名或 IP（如 `li.feng3d.com`）
- `LOCAL_PORT` — 本地服务端口（如 `12345`）
- `REMOTE_PORT` — 公网暴露端口（通常与 LOCAL_PORT 相同）
- `TOKEN` — 认证令牌（可选，建议设置）

## 第二步：部署服务端（Linux）

在公网服务器上使用 npx 一键部署：

```bash
# 使用 npx 无需安装
npx @feng3d/frps -p 7000

# 带 token 认证
npx @feng3d/frps -p 7000 -t your-secret-token

# 全局安装后使用
npm install -g @feng3d/frps
frps -p 7000
```

命令会自动完成：
- 下载对应平台的 frps 二进制文件
- 创建配置文件
- 配置防火墙 (firewalld/ufw)
- 配置 systemd 服务（开机自启）

### 手动安装（备选）

如果无法使用 npx，可使用项目脚本：

```bash
bash scripts/setup_frps.sh 0.67.0 7000
```

## 第三步：部署客户端

### Windows/macOS/Linux

使用 npx 一键部署：

```bash
# 交互式配置向导
npx @feng3d/frpc

# 直接指定参数
npx @feng3d/frpc --server li.feng3d.com --local-port 8080 --remote-port 8080

# 带 token 认证
npx @feng3d/frpc -s li.feng3d.com -l 8080 -r 8080 -t your-secret-token

# 全局安装后使用
npm install -g @feng3d/frpc
frpc --server li.feng3d.com --local-port 8080 --remote-port 8080
```

### Windows 杀毒软件处理

Windows Defender 可能拦截 frpc.exe。如果遇到此问题：
1. 以管理员身份运行 PowerShell
2. 添加 Defender 排除：
   ```powershell
   Add-MpPreference -ExclusionPath "$env:USERPROFILE\frp"
   ```

### 手动安装（备选）

如果无法使用 npx，可使用项目脚本：

```powershell
# Windows
powershell -ExecutionPolicy Bypass -File scripts/setup_frpc.ps1 -Version "0.67.0" -Dest "$env:USERPROFILE\frp"
```

使用 `assets/frpc.toml` 作为配置模板：

```toml
serverAddr = "li.feng3d.com"
serverPort = 7000

[[proxies]]
name = "myapp"
type = "tcp"
localIP = "127.0.0.1"
localPort = 8080
remotePort = 8080
```

## 第四步：验证

浏览器访问 `http://SERVER_ADDR:REMOTE_PORT`，成功访问本地服务即表示配置正确。

## 常见问题

| 现象 | 原因 | 解决方法 |
|------|------|----------|
| npx 命令未找到 | 未安装 Node.js | 安装 Node.js 18+ |
| frpc.exe 被删除 | 杀毒软件拦截 | 将目录加入杀毒软件白名单 |
| 连接服务器被拒绝 | 防火墙未开放 | 开放服务器 7000 端口和远程端口 |
| 公网端口无响应 | 云厂商安全组 | 检查云控制台安全组规则 |
| 本地服务连接失败 | 本地服务未运行 | 确认本地服务正在运行 |

## 更多信息

- [@feng3d/frps](https://www.npmjs.com/package/@feng3d/frps) - 服务端包文档
- [@feng3d/frpc](https://www.npmjs.com/package/@feng3d/frpc) - 客户端包文档
- [frp 官方文档](https://github.com/fatedier/frp)
