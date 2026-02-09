# @feng3d/frps

frp 服务端快速部署工具，支持 Linux/Windows/macOS。

## 安装

```bash
# 全局安装
npm install -g @feng3d/frps

# 或使用 npx 无需安装
npx @feng3d/frps
```

## 使用

### 快速启动

```bash
# 使用默认端口 7000 启动
frps

# 指定端口启动
frps -p 8080

# 指定 frp 版本
frps --frp-version 0.67.0
```

### 命令选项

| 选项 | 别名 | 默认值 | 说明 |
|------|------|--------|------|
| `--port` | `-p` | `7000` | 绑定端口 |
| `--frp-version` | | `0.67.0` | frp 二进制版本 |
| `--no-service` | | `false` | 不注册为系统服务 |
| `--token` | `-t` | | 认证令牌 |

### 子命令

```bash
# 启动服务
frps start

# 停止服务
frps stop

# 重启服务
frps restart

# 查看状态
frps status
```

## 功能特性

- 自动下载对应平台的 frp 二进制文件
- Linux 下自动配置 systemd 服务
- Linux 下自动配置防火墙 (firewalld/ufw)
- 支持 token 认证
- 支持自定义配置文件

## 平台支持

- Linux x64/arm64
- Windows x64
- macOS x64/arm64

## 示例

```bash
# 启动带 token 认证的服务端
npx @feng3d/frps -p 7000 -t my-secret-token

# 临时测试不注册服务
npx @feng3d/frps -p 7000 --no-service
```

## 配置文件

默认配置文件位置：
- Linux: `/etc/frp/frps.toml`
- Windows: `C:\ProgramData\frp\frps.toml`
- macOS: `/usr/local/etc/frp/frps.toml`

## 许可证

MIT
