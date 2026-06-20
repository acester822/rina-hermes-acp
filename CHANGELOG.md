# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.5] - 2026-06-21

### Added

- **聊天内权限审批**：在 WebView 中展示权限请求卡片（替代 `showWarningMessage`），支持批准/拒绝及会话级/永久选项；详情默认折叠，超出三行可展开
- **审批历史持久化**：权限卡片写入会话消息记录，刷新或切换会话后可只读恢复
- **MCP 配置转发**：从 `~/.cursor/mcp.json` 及工作区 `.cursor` / `.vscode` 的 `mcp.json` 读取 MCP 服务器，并在 `session/new` 时传给 Hermes
- **流式推送智能滚动**：默认跟随到底部；用户手动滚动后暂停，5 秒无操作且仍在推送时恢复
- **TOKEN 圆环占比**：圆环中心显示当前 token 使用百分比
- 权限选项 i18n（`permissionOptions.ts`）及 `mcpConfig` / `permissionOptions` 单元测试
- 集成测试脚本 `scripts/test-session-new.mjs`

### Fixed

- 审批或工具调用后，后续助手回复不再错误追加到旧气泡，而是开启新消息段
- `allow_session` 选项不再误显示为「始终允许」（`optionId` 优先于 `kind` 映射）

[0.2.5]: https://github.com/jove-rina/rina-hermes-acp/compare/v0.2.2...v0.2.5
