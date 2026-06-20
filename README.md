# Hermes Agent Chat

Chat with **Hermes Agent** directly inside VS Code.

## Features

- **Chat panel** — Sidebar chat interface connected to `hermes acp`
- **Streaming responses** — Real-time text streaming with Markdown rendering
- **Code insertion** — Click to insert code blocks into your editor
- **@file references** — Click file paths to open them
- **Multi-agent** — Switch between Hermes configurations
- **Session management** — Per-session chat history with persistence
- **Tool visibility** — Configurable display of thoughts and tool calls

## Requirements

- [Hermes Agent](https://hermes-agent.nousresearch.com) installed and configured
- VS Code 1.85+

## Getting Started

1. Make sure `hermes` is available on your PATH
2. Open the Hermes sidebar (click the Hermes icon in the activity bar)
3. Wait for the status to show **Ready** (🟢)
4. Start chatting!

## Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| `hermes.path` | Path to Hermes executable | auto-detect |
| `hermes.cwd` | Working directory | workspace root |
| `hermes.profile` | Hermes profile name | default |
| `hermes.showThoughts` | Show agent thinking process | `false` |
| `hermes.showToolCalls` | Show tool call notifications | `false` |
| `hermes.models` | Model presets | `[]` |
| `hermes.agents` | Named agent configurations | `[]` |

## Commands

| Command | Description |
|---------|-------------|
| `Hermes: New Chat` | Start a new conversation |
| `Hermes: Open Chat` | Open the chat sidebar |
| `Send to Hermes Agent` | Send selected code (editor context menu) |

## License

MIT
