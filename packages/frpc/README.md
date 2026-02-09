# @feng3d/frpc

frp 客户端快速部署工具，支持 Linux/Windows/macOS。

## 安装

```bash
# 全局安装
npm install -g @feng3d/frpc

# 或使用 npx 无需安装
npx @feng3d/frpc
```

## 使用

### 快速连接

```bash
# 交互式配置向导
frpc

# 直接指定参数
frpc --server example.com --local-port 8080 --remote-port 8080

# 指定端口范围映射
frpc --server example.com --local-port 3000 --remote-port 3000-3005
```

### 命令选项

| 选项 | 别名 | 默认值 | 说明 |
|------|------|--------|------|
| `--server` | `-s` | | 服务端地址 |
| `--server-port` | | `7000` | 服务端端口 |
| `--local-port` | `-l` | | 本地端口 |
| `--remote-port` | `-r` | | 远程端口 |
| `--proxy-name` | `-n` | | 代理名称 |
| `--token` | `-t` | | 认证令牌 |
| `--frp-version` | | `0.67.0` | frp 二进制版本 |
| `--type` | | `tcp` | 代理类型 (tcp/http/https) |

### 子命令

```bash
# 启动服务
frpc start

# 停止服务
frpc stop

# 重启服务
frpc restart

# 查看状态
frpc status

# 配置向导
frpc config
```

## 功能特性

- 自动下载对应平台的 frp 二进制文件
- 交互式配置向导
- Windows 下自动处理 Defender 拦截
- Linux/macOS 下自动配置系统服务
- 支持多种代理类型 (tcp/http/https)
- 支持端口范围映射

## 平台支持

- Linux x64/arm64
- Windows x64
- macOS x64/arm64

## 示例

### TCP 端口转发

```bash
# 将本地 8080 转发到远程 8080
npx @feng3d/frpc -s example.com -l 8080 -r 8080

# 带认证
npx @feng3d/frpc -s example.com -l 8080 -r 8080 -t my-token
```

### HTTP 虚拟主机

```bash
# HTTP 类型代理
npx @feng3d/frpc -s example.com --type http -l 3000 -n myapp
```

### 端口范围

```bash
# 映射端口范围
npx @feng3d/frpc -s example.com -l 3000 -r 3000-3005
```

## 配置文件

默认配置文件位置：
- Linux/macOS: `~/.frp/frpc.toml`
- Windows: `%USERPROFILE%\frp\frpc.toml`

## 许可证

MIT
