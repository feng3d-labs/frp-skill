# frp-skill

使用 [frp](https://github.com/fatedier/frp) 实现内网穿透的 Claude Code Skill，将本地服务暴露到公网访问。

## 安装

```bash
npx skills add feng3d-labs/frp-skill
```

## 功能

- 一键部署 frps 服务端（Linux）
- 一键部署 frpc 客户端（Windows），自动处理杀毒软件拦截问题
- 提供 frpc.toml / frps.toml 配置模板

## 使用示例

安装 skill 后，在 Claude Code 中直接描述需求即可：

> 帮我把本地 http://127.0.0.1:8080 通过 my-server.com 暴露到公网

Claude 会自动调用此 skill，引导完成服务端和客户端的部署配置。

## 目录结构

```
frp-skill/
├── SKILL.md                    # 技能描述和工作流程
├── scripts/
│   ├── setup_frpc.ps1          # Windows 客户端部署脚本
│   └── setup_frps.sh           # Linux 服务端部署脚本
└── assets/
    ├── frpc.toml               # 客户端配置模板
    └── frps.toml               # 服务端配置模板
```
