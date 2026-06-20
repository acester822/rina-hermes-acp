# Hermes Agent Chat — VS Code 插件方案

## 概述

在 VS Code 中直接与本地运行的 Hermes Agent 对话，无需切换终端。插件通过 ACP 协议连接 `hermes acp` 服务，在编辑器侧边栏提供完整的聊天体验。

---

## 架构总览

```
┌─────────────────────────────────────────┐
│            VS Code 窗口                  │
│  ┌────────────────────────────────────┐  │
│  │        Hermes Chat 侧边栏          │  │
│  │  ┌──── WebView (聊天 UI) ──────┐   │  │
│  │  │  消息气泡 / 输入框 / 状态    │   │  │
│  │  └─────────────────────────────┘   │  │
│  │              ↕ postMessage           │  │
│  │  ┌── ChatProvider (extension.ts) ─┐  │  │
│  │  │  ACP 客户端层                  │  │  │
│  │  └──────────┬────────────────────┘  │  │
│  └─────────────┼───────────────────────┘  │
│                │ child_process (stdio)    │
│                ↓                           │
│  ┌──────────────────────────┐             │
│  │  hermes acp (子进程)     │             │
│  └──────────────────────────┘             │
└─────────────────────────────────────────┘
```

---

## 核心功能

### Phase 1 — 基础聊天（MVP）

| 功能 | 说明 |
|------|------|
| 侧边栏聊天面板 | VS Code 侧边栏登录，WebView 渲染 |
| 发消息 → Hermes | 用户输入 → ACP → hermes 处理 |
| 收回复 | Hermes 响应以流式/整块方式展示 |
| 消息历史 | 当前会话消息列表（气泡样式） |
| 新建会话 | 清空当前对话，开始新会话 |

### Phase 2 — 增强体验

| 功能 | 说明 |
|------|------|
| 会话管理 | 列出/切换/删除历史会话 |
| Markdown 渲染 | 代码块语法高亮（跟 VS Code 主题一致） |
| 代码插入 | 点击代码块直接插入到当前编辑器 |
| 文件引用 | @file 路径悬浮预览 |
| 中断响应 | 停止正在生成的回复 |
| 状态指示 | Hermes 连接状态、处理中动画 |

### Phase 3 — 深度集成

| 功能 | 说明 |
|------|------|
| 选中代码发送 | 在编辑器中选中代码，右键发送到 Hermes |
| 终端输出集成 | Hermes 执行的 shell 命令结果显示在 VS Code 终端 |
| 多 Agent 切换 | 同时连接多个 Hermes 配置（不同 profile） |
| 设置页面 | VS Code Settings UI 配置 Hermes 路径、模型等 |

---

## 技术方案

### ACP 连接

**协议：** Agent Communication Protocol（stdio 传输）

- 插件启动 `hermes acp` 子进程
- 通过 stdin/stdout 传递 JSON-RPC 消息
- 参考现有 `formulahendry.acp-client` 的实现

**消息流：**

```
插件 → ACP:  {"type":"sendPrompt","text":"你好"}
ACP → 插件:  {"type":"response","text":"你好！..."}
ACP → 插件:  {"type":"toolCall",...}
ACP → 插件:  {"type":"response","text":"已执行..."}
```

### WebView 聊天 UI

- **技术：** 纯 HTML + CSS + JS（无框架，避免构建步骤）
- **通信：** `vscode.postMessage()` / `window.addEventListener('message')`
- **样式：** 跟随 VS Code 主题（`--vscode-*` CSS 变量）
- **编辑器：** 简单的 textarea + Enter 发送 / Shift+Enter 换行

### 文件结构

```
hermes-agent-chat/
├── package.json          # 扩展清单：命令、贡献点、依赖
├── tsconfig.json
├── src/
│   ├── extension.ts      # activate/deactivate，注册侧边栏面板
│   ├── chat/
│   │   └── HermesChatProvider.ts   # WebviewViewProvider
│   └── acp/
│       └── AcpClient.ts           # 子进程管理 + ACP 消息收发
└── media/
    ├── chat.html         # 聊天 UI
    ├── chat.js           # 前端逻辑
    └── chat.css          # 样式
```

---

## 实现步骤

```
Step 1:   package.json + tsconfig 配置
Step 2:   extension.ts — 注册 HermesChatProvider
Step 3:   AcpClient.ts — hermes acp 子进程管理、消息收发
Step 4:   chat.html/js/css — WebView 聊天界面
Step 5:   HermesChatProvider.ts — WebView ↔ ACP 桥接
Step 6:   调试运行（F5）
Step 7:   Phase 2 功能迭代
```

---

## 关键技术决策

| 决策 | 选择 | 原因 |
|------|------|------|
| 面板类型 | WebviewView（侧边栏） | 常驻侧边栏，使用体验好 |
| ACP SDK | `@agentclientprotocol/sdk` | 与官方协议兼容，省去手写 JSON-RPC |
| 前端框架 | 无框架 | 减少依赖和构建步骤，简单够用 |
| 语言 | TypeScript | VS Code 扩展标准选择 |
| 打包 | vsce | 官方打包发布工具 |

---

## 风险 & 注意事项

- **hermes acp 未安装：** 启动时检测，引导用户安装
- **端口/进程冲突：** 每次启动独立的子进程，确保隔离
- **长回复卡 UI：** WebView 用虚拟滚动或截断长消息
- **VS Code 版本兼容：** `engines.vscode` 设到 `^1.85.0` 以上
