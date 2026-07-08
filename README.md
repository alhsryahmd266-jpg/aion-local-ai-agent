# AION — Autonomous Local AI Agent

> **"Agentic Local LLM with Native Terminal Execution Capabilities"**

A full Android/iOS app built with Expo React Native that runs an autonomous AI agent with ReAct loop (Reasoning + Acting) directly on your device — **no server required**.

## Features

| Feature | Description |
|---------|-------------|
| 🤖 **ReAct Loop** | Autonomous reasoning + acting cycles |
| 🔧 **Tool Use** | Web search, HTTP requests, file I/O, calculator |
| 📱 **On-Device LLM** | Connects to Ollama / LM Studio locally |
| 💻 **Terminal** | Live tool execution with colored logs |
| 🔌 **Offline Mode** | Full offline with Phi-3 Mini / Qwen2.5 |
| ⚙️ **Settings** | Configure endpoint, model, system prompt |

## Stack

- **Expo React Native** (SDK 53)
- **expo-router** (file-based routing)
- **@tanstack/react-query**
- **Local LLM**: Ollama + Phi-3 Mini (GGUF)

## Quick Start

```bash
# Install dependencies
pnpm install

# Start the app
pnpm expo start
```

Scan QR with **Expo Go** on Android/iOS.

## Connect to Local LLM

1. Install [Ollama](https://ollama.ai) on your PC
2. Pull a model: `ollama pull phi3:mini`
3. Run: `OLLAMA_HOST=0.0.0.0 ollama serve`
4. In the app Settings → enter your PC's IP address
5. Connect to same WiFi

## Architecture

```
User Message
     │
     ▼
ReAct Loop (max 6 steps)
     │
     ├─► Think (LLM generates reasoning)
     │
     ├─► Act (call a tool: search/http/calc/file)
     │
     ├─► Observe (receive tool result)
     │
     └─► Repeat or Final Answer
```

## Built with

Built by AION Engineering Suite — Autonomous APK & AI Tools Platform
