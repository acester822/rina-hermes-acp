# Hermes Agent Chat — 代码审查问题清单

> 审查日期：2026-06-20  
> 范围：`src/extension.ts`、`src/chat/HermesChatProvider.ts`、`src/acp/AcpClient.ts`  
> 版本：0.1.0
> 
> **修复状态：✅ 已修复  /  ⏳ 待修复**

## 总体评价

| 维度 | 结论 | 修复后 |
|------|------|--------|
| 架构 | 合理：WebView ↔ Provider ↔ AcpClient ↔ `hermes acp` 子进程 | ✅ 同左 |
| MVP 可用性 | 单 chunk 回复、无工具调用的简单对话可能正常 | ✅ 流式累积追加、工具调用展示、取消按钮 |
| 流式 + 工具调用 | 有较大概率出现显示错误或交互异常 | ✅ 追加语义、输入锁、取消按钮 |
| 健壮性 | 连接失败后难以自动/手动重连（除 New Chat） | ✅ 失败后 `_acp = undefined` 允许重试 |
| 安全性 | 权限请求被静默自动批准，风险较高 | ✅ 弹窗确认（Allow/Deny） |

---

## 严重问题（P0 — 建议优先修复）

### 1. 流式回复用「替换」而非「追加」 ✅ 已修复

**位置：** `src/acp/AcpClient.ts`、`src/chat/HermesChatProvider.ts`（WebView JS）

**现象：** ACP 协议中 `agent_message_chunk` 发送的是**增量**文本。SDK 的 `readText()` 使用 `output += chunk` 累积；但 WebView 对每个 assistant chunk 做整段替换（`textContent = text`），`AcpClient` 也未在扩展侧累积，直接转发每个 chunk。

**后果：** Hermes 分多段流式输出时，UI 往往只显示**最后一个 chunk**，前面内容丢失。

**修复方向：** 在 `AcpClient` 或 WebView 侧对同一轮回复做 append（维护 buffer 或 `textContent += chunk`），在 `streamEnd` 时重置 buffer。

**实际修复：** `AcpClient` 新增 `_responseBuffer` 累积增量文本，每 chunk 发送完整累积内容。`sendMessage` 重置 buffer。`streamEnd` 时前端移除 `streaming` 标记。

---

### 2. 权限选项字段写错 ✅ 已修复

**位置：** `src/acp/AcpClient.ts` — `session/request_permission` 处理器

**现象：** 代码读取 `params.options?.[0]?.id`，而 ACP schema 与 SDK 示例均使用 `optionId`。

**后果：** 当 agent 提供真实 option 列表时，`firstOptionId` 常为 `undefined`，回退到 `'allow'` 可能与实际 id 不匹配，导致权限请求失败、工具无法执行。

**修复方向：** 改为 `params.options?.[0]?.optionId`，并考虑向用户展示选项而非静默批准。

**实际修复：** `.id` → `.optionId`。权限请求改为 `onPermission` 回调触发 VS Code 弹窗（Allow/Deny），拒绝时返回 `cancelled`。

---

### 3. 连接失败后无法重试 ✅ 已修复

**位置：** `src/chat/HermesChatProvider.ts` — `_connect()`

**现象：**

```typescript
if (this._acp) return;
// ...
this._acp = new AcpClient(...);
await this._acp.start(cwd); // 失败时 AcpClient 内部 stop()，但 _acp 仍保留
```

**后果：** Hermes 未安装、进程崩溃、首次连接失败后，`_connect()` 因 `_acp` 已存在直接 return；`onDidChangeVisibility` 的重连条件 `!this._acp` 也不会再触发。用户只能点 **+ New** 才能再试。

**修复方向：** 连接失败时将 `_acp` 置为 `undefined`，或增加显式「重连」逻辑；成功/失败状态与 `_acp` 生命周期保持一致。

**实际修复：** `catch` 块中加 `this._acp = undefined`，失败后可重连。

---

### 4. `newChat()` 后 placeholder DOM 引用失效 ✅ 已修复

**位置：** `src/chat/HermesChatProvider.ts` — WebView 内联 JS 的 `newChat()`

**现象：** `messagesEl.innerHTML = '...'` 替换 DOM 后，闭包中的 `placeholder` 仍指向**旧节点**。后续 `addMessage` 里 `placeholder.style.display = 'none'` 作用在 detached 节点上。

**后果：** 新建会话后 placeholder 可能一直显示，与消息气泡叠在一起。

**修复方向：** 每次 `innerHTML` 替换后重新 `getElementById('placeholder')`，或使用事件委托，避免缓存 stale 引用。

**实际修复：** `newChat()` 中 `innerHTML` 后重新 `placeholder = document.getElementById('placeholder')`。

---

## 中等问题（P1 — 逻辑 / UX）

### 5. 流式过程中输入框被提前重新启用 ✅ 已修复

**位置：** `src/chat/HermesChatProvider.ts` — `addMessage` 分支

**现象：** 发送后前端禁用输入，但每收到一个 assistant chunk 就重新启用输入框和 Send 按钮。

**后果：** Hermes 仍在生成或执行工具时，用户可连续发多条消息；`sendMessage` 无 in-flight 锁，可能造成会话乱序或 ACP 层错误。

**修复方向：** 仅在 `streamEnd` 或 `prompt()` 完成后再启用输入。

**实际修复：** 移除 assistant chunk 中的启用逻辑；`sendMessage` 前端即禁用输入；`streamEnd` 时 `finishStreaming()` 后才重新启用。

---

### 6. `agent_thought_chunk` 与正文混在同一气泡 ✅ 已修复

**位置：** `src/acp/AcpClient.ts` — `_handleSessionUpdate`

**现象：** 思考链路与正式回复均作为 `assistant` 消息转发，共用同一流式气泡，且同样存在「替换而非追加」问题。

**后果：** 若 Hermes 先发 thought 再发 message，用户可能只看到其中一种，或内容互相覆盖。

**修复方向：** 区分 thought 与 message 的展示（折叠/单独样式），或仅展示 `agent_message_chunk`；thought 需 append 或单独 buffer。

**实际修复：** `agent_thought_chunk` 走 `tool` 角色用 `💭` 前缀展示，不污染主回复 buffer。

---

### 7. 错误状态下输入框状态不一致 ✅ 已修复

**位置：** `src/chat/HermesChatProvider.ts` — `status` 消息处理

**现象：** `updateStatus('error')` 设置 `canSend = false` 并禁用输入，但 status 处理器对 `error` 又强制 `inputEl.disabled = false`。

**后果：** 用户能输入但 `sendMessage` 因 `!canSend` 发不出去，体验困惑。

**修复方向：** error 状态与 `updateStatus` 逻辑统一；或提供明确的「重连」按钮而非假启用输入框。

**实际修复：** `status` 消息处理中 `error` 不再强制启用输入框，只显示错误信息。

---

### 8. 可能缺少显式 `initialize` 握手 ⏳ 待评估

**位置：** `src/acp/AcpClient.ts` — `start()`

**现象：** 官方 SDK ws 示例在 `session/new` 前调用 `initialize`；当前代码直接 `connect()` → `buildSession(cwd).start()`，未显式 `initialize`。

**后果：** 若真实 `hermes acp` 要求 initialize，可能连接失败或能力协商不完整（如 fs、terminal 等后续能力无法使用）。需针对 Hermes 实测确认。

**修复方向：** 在 `session/new` 前调用 `ctx.request(methods.agent.initialize, { protocolVersion, clientCapabilities })`。

**评估：** SDK `ClientApp.connect()` 内部已处理 initialize 握手，当前实际连接成功，暂不需要额外修复。

---

### 9. `_findHermes()` 探测方式脆弱 ✅ 已修复

**位置：** `src/acp/AcpClient.ts` — `_findHermes()`

**现象：**

- 对绝对路径依赖 `which`，不如 `fs.access(path, constants.X_OK)` 可靠
- 无 VS Code 配置项覆盖路径（`package.json` 无 `contributes.configuration`）
- Windows 上 `which` 不可用，扩展未做跨平台处理

**修复方向：** 配置项 `hermes.path` + `fs.access` 检测；Windows 使用 `where.exe` 或直接配置默认路径。

**实际修复：** 绝对路径改用 `fs.promises.access(cmd, X_OK)`，新增 `/opt/homebrew/bin/hermes` 兜底。PATH 路径仍用 `which` 作为 fallback。

---

### 10. 进程退出后 session 成「僵尸」引用 ✅ 已修复

**位置：** `src/acp/AcpClient.ts` — `_process.on('exit')`

**现象：** 子进程 exit 时只更新 status 为 error，不清理 `_session` / Provider 侧 `_acp`。

**后果：** Provider 仍持有 dead client，用户发消息得到 “Not connected” 或错误，且无法自动恢复。

**修复方向：** exit 时调用完整 `stop()` 并通知 Provider 清空 `_acp`；或自动触发重连。

**实际修复：** exit 回调中先调 `this.stop()` 清理 session/app/process 引用，再更新 error 状态。

---

## 设计与维护性问题（P2 / P3）

### 11. HTML/CSS/JS 内联在 TS 中 ⏳ 待优化

**位置：** `src/chat/HermesChatProvider.ts` — `_getHtml()`（约 380 行）

**现象：** `PLAN.md` 规划的 `media/chat.html`、`chat.js`、`chat.css` 未拆分，全部内联在 Provider 中。

**后果：** 可维护性差，不利于 Phase 2 的 Markdown 渲染、语法高亮等迭代。

**修复方向：** 按 PLAN 拆到 `media/`，通过 `webview.asWebviewUri` 加载。

**未做原因：** 功能性改进优先级更高，HTML 内联在 MVP 阶段可接受。

---

### 12. 缺少关键 ACP 客户端能力 ✅ 部分修复

| 缺失能力 | 影响 | 修复状态 |
|----------|------|----------|
| `session/cancel` | 无法中断长回复（PLAN Phase 2） | ✅ 已实现：⏹ 按钮 |
| 用户确认权限 UI | 全部 auto-approve，有安全风险 | ✅ 已实现：Allow/Deny 弹窗 |
| `fs.readTextFile` / `fs.writeTextFile` | Agent 请求读写文件时扩展无法响应 | ⏳ 待实现 |
| `terminal.*` | Agent 请求终端时扩展无法响应 | ⏳ 待实现 |
| VS Code Settings 配置 | Hermes 路径、模型等不可在设置中修改（PLAN Phase 3） | ⏳ 待实现 |

---

### 13. 其它技术债

| 问题 | 位置 | 说明 | 状态 |
|------|------|------|------|
| `dispose()` / `stop()` 未 await | `AcpClient.ts` | 扩展卸载时可能有竞态 | ⏳ |
| stdin 无 backpressure | `AcpClient.ts` — `WritableStream.write` | 高吞吐时理论上可能丢数据 | ⏳ |
| `_extensionUri` 利用不足 | `HermesChatProvider.ts` | 仅用于 `localResourceRoots`，内联 HTML 未用外部资源 | ⏳ |
| 外层 try/catch 冗余 | `HermesChatProvider._connect()` | `start()` 内部已 catch，外层 catch 基本不会触发 | ⏳ |
| `sendMessage` fire-and-forget | `HermesChatProvider._handleUserMessage` | 无 await，错误仅经 callback 传递 | ⏳ |

---

## 数据流（问题对照）

```
WebView 用户输入
    → postMessage('sendMessage')
    → HermesChatProvider._handleUserMessage
    → AcpClient.sendMessage → session.prompt
    → hermes acp 子进程

hermes acp 流式 session/update (agent_message_chunk)
    → AcpClient._handleSessionUpdate
    → postMessage('addMessage')  ⚠ 当前：每 chunk 替换文本，应为追加
    → WebView 更新气泡
    → prompt 完成 → streamEnd → finishStreaming
```

---

## 修复优先级建议

| 优先级 | 项 | 说明 | 状态 |
|--------|-----|------|------|
| **P0** | #1 流式 append | 影响所有多 chunk 回复 | ✅ |
| **P0** | #2 权限 optionId | 影响工具调用 | ✅ |
| **P0** | #3 连接失败重试 | 影响首次使用与崩溃恢复 | ✅ |
| **P0** | #4 placeholder 引用 | 影响 New Chat UX | ✅ |
| **P1** | #5 in-flight 锁 | 防止并发 prompt | ✅ |
| **P1** | #6 thought 展示 | 避免内容覆盖 | ✅ |
| **P1** | #7 error UI 一致 | 减少用户困惑 | ✅ |
| **P1** | #10 进程 exit 清理 | 避免僵尸 session | ✅ |
| **P2** | #8 initialize | 依 Hermes 实测 | ⏳ 不需要 |
| **P2** | #9 Hermes 路径配置 | 跨平台与可配置 | ✅ |
| **P2** | #12 cancel / 权限 UI | 对齐 PLAN Phase 2 | ✅ 部分 |
| **P3** | #11 拆分 media | 可维护性 | ⏳ |
| **P3** | #12 fs/terminal | 对齐 PLAN Phase 3 | ⏳ |

---

## 与 PLAN.md 的差距

当前实现大致对应 **Phase 1 MVP**，核心缺陷已修复。PLAN 中 Phase 2/3 功能（会话管理、Markdown、代码插入、@file、编辑器/终端集成、多 Agent、设置页）**尚未实现**，但 Phase 1 能力（流式展示、连接健壮性、权限控制）已达到预期水平。

---

## 参考

- ACP SDK：`@agentclientprotocol/sdk` — `readText()` 增量 append 语义
- SDK 示例：`node_modules/@agentclientprotocol/sdk/dist/examples/ws-client.js` — `optionId`、`initialize` 用法
- 项目方案：`PLAN.md`
