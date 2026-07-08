import React, { createContext, useContext, useState, useRef, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type MessageRole = "user" | "assistant" | "thinking" | "tool_call" | "tool_result" | "system";

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  toolName?: string;
  toolInput?: string;
  toolOutput?: string;
  timestamp: number;
}

export interface Tool {
  name: string;
  description: string;
  icon: string;
  enabled: boolean;
}

export interface AgentSettings {
  endpoint: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  enabledTools: string[];
}

const DEFAULT_SYSTEM_PROMPT = `You are AION, an autonomous AI agent running directly on an Android device. You have access to powerful tools and can execute actions in the real world. You think step-by-step using ReAct (Reasoning + Acting) loops.

Available tools:
- web_search: Search the web for real-time information
- terminal: Execute shell commands on the device
- file_read: Read files from the filesystem
- file_write: Write/create files
- calculate: Perform mathematical calculations
- analyze_apk: Analyze Android APK files
- http_request: Make HTTP requests to any URL

Always think before acting. When you need information, use tools. Be concise but thorough.`;

const DEFAULT_SETTINGS: AgentSettings = {
  endpoint: "http://localhost:11434/api/generate",
  model: "phi3:mini",
  temperature: 0.7,
  maxTokens: 2048,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  enabledTools: ["web_search", "terminal", "file_read", "file_write", "calculate", "http_request"],
};

const AVAILABLE_TOOLS: Tool[] = [
  { name: "web_search", description: "Search the web for real-time information", icon: "search", enabled: true },
  { name: "terminal", description: "Execute shell commands", icon: "terminal", enabled: true },
  { name: "file_read", description: "Read files from filesystem", icon: "file-text", enabled: true },
  { name: "file_write", description: "Write files to filesystem", icon: "edit-3", enabled: true },
  { name: "calculate", description: "Mathematical calculations", icon: "cpu", enabled: true },
  { name: "http_request", description: "Make HTTP requests", icon: "globe", enabled: true },
  { name: "analyze_apk", description: "Analyze Android APK files", icon: "package", enabled: false },
];

interface AgentContextType {
  messages: Message[];
  isRunning: boolean;
  settings: AgentSettings;
  availableTools: Tool[];
  terminalLogs: string[];
  sendMessage: (text: string) => Promise<void>;
  clearMessages: () => void;
  updateSettings: (s: Partial<AgentSettings>) => void;
  runToolDirectly: (toolName: string, input: string) => Promise<string>;
  addTerminalLog: (log: string) => void;
  clearTerminal: () => void;
}

const AgentContext = createContext<AgentContextType | null>(null);

function uid() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

// ── Tool Executors ────────────────────────────────────────────────
async function executeTool(name: string, input: string, addLog: (l: string) => void): Promise<string> {
  addLog(`[TOOL] ${name}: ${input.substring(0, 80)}`);
  try {
    switch (name) {
      case "calculate": {
        const expr = input.replace(/[^0-9+\-*/().%, ]/g, "");
        try {
          const result = Function(`"use strict"; return (${expr})`)();
          return `Result: ${result}`;
        } catch {
          return "Error: invalid expression";
        }
      }
      case "web_search": {
        const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(input)}&format=json&no_html=1&skip_disambig=1`;
        const r = await fetch(url);
        const d = await r.json();
        const abstract = d.AbstractText || d.Abstract || "";
        const related = (d.RelatedTopics || []).slice(0, 3).map((t: any) => t.Text || "").filter(Boolean).join(" | ");
        return abstract ? `${abstract}\n\nRelated: ${related}` : `No results for: ${input}`;
      }
      case "http_request": {
        let url = input, method = "GET", body: string | undefined;
        try {
          const parsed = JSON.parse(input);
          url = parsed.url || input;
          method = parsed.method || "GET";
          body = parsed.body;
        } catch {}
        const r = await fetch(url, { method, body, headers: { "User-Agent": "AION-Agent/1.0" } });
        const text = await r.text();
        return `HTTP ${r.status}\n${text.substring(0, 500)}`;
      }
      case "file_read":
        return `[Simulated] Content of ${input}:\nLine 1: Hello from AION\nLine 2: This is simulated file content`;
      case "file_write":
        return `[Simulated] File written: ${input}`;
      case "terminal":
        return `[Simulated] $ ${input}\nOutput: command executed (device terminal requires native permissions)`;
      case "analyze_apk":
        return `[Simulated] APK analysis for: ${input}\nPackage: com.example.app\nVersion: 1.0\nSDK: 21+`;
      default:
        return `Unknown tool: ${name}`;
    }
  } catch (e: any) {
    return `Tool error: ${e.message}`;
  }
}

// ── ReAct Loop ───────────────────────────────────────────────────
async function runReActLoop(
  userMessage: string,
  settings: AgentSettings,
  addMessage: (m: Omit<Message, "id" | "timestamp">) => void,
  addLog: (l: string) => void,
): Promise<void> {
  const maxSteps = 6;
  let step = 0;
  let context = `User: ${userMessage}\n\n`;

  const TOOL_PATTERN = /\[TOOL:(\w+)\]([\s\S]*?)\[\/TOOL\]/;

  while (step < maxSteps) {
    step++;
    addLog(`[REACT] Step ${step}/${maxSteps}`);

    const prompt = `${settings.systemPrompt}\n\nConversation:\n${context}\nAssistant (think step by step, use [TOOL:name]input[/TOOL] to call tools, or give final answer):`;

    let responseText = "";
    try {
      const r = await fetch(settings.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: settings.model,
          prompt,
          stream: false,
          options: { temperature: settings.temperature, num_predict: settings.maxTokens },
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      responseText = data.response || data.content || JSON.stringify(data);
    } catch (e: any) {
      // Fallback: simulate a response for demo purposes
      addLog(`[WARN] LLM error: ${e.message} — using demo mode`);
      responseText = simulateAgentResponse(userMessage, step, context);
    }

    const toolMatch = TOOL_PATTERN.exec(responseText);

    if (toolMatch) {
      const thinking = responseText.substring(0, toolMatch.index).trim();
      if (thinking) {
        addMessage({ role: "thinking", content: thinking });
        context += `Thinking: ${thinking}\n`;
      }

      const toolName = toolMatch[1];
      const toolInput = toolMatch[2].trim();

      addMessage({ role: "tool_call", content: `Calling ${toolName}`, toolName, toolInput });
      const output = await executeTool(toolName, toolInput, addLog);
      addMessage({ role: "tool_result", content: output, toolName, toolOutput: output });

      context += `[TOOL:${toolName}]${toolInput}[/TOOL]\nTool Result: ${output}\n\n`;
    } else {
      // Final answer
      const finalAnswer = responseText.trim();
      addMessage({ role: "assistant", content: finalAnswer });
      return;
    }
  }

  addMessage({ role: "assistant", content: "I've completed my analysis. Let me know if you need more details." });
}

function simulateAgentResponse(userMsg: string, step: number, context: string): string {
  const lower = userMsg.toLowerCase();
  if (step === 1) {
    if (lower.includes("search") || lower.includes("find") || lower.includes("what")) {
      return `I'll search for information about this.\n[TOOL:web_search]${userMsg}[/TOOL]`;
    }
    if (lower.includes("calculate") || lower.includes("compute") || /\d+.*[\+\-\*\/]/.test(lower)) {
      const expr = lower.match(/[\d\s\+\-\*\/\.]+/)?.[0]?.trim() || "42 * 2";
      return `Let me calculate that.\n[TOOL:calculate]${expr}[/TOOL]`;
    }
    if (lower.includes("http") || lower.includes("url") || lower.includes("fetch")) {
      return `I'll fetch that URL.\n[TOOL:http_request]${userMsg}[/TOOL]`;
    }
  }
  return `Based on my analysis: ${userMsg}\n\nI am AION, your autonomous AI agent. I can search the web, execute commands, read/write files, make HTTP requests, and more. I'm currently running in demo mode — connect a local Ollama instance with Phi-3 Mini for full offline AI capabilities. Ask me anything!`;
}

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: uid(),
      role: "system",
      content: "AION Agent initialized. Ready for commands.",
      timestamp: Date.now(),
    }
  ]);
  const [isRunning, setIsRunning] = useState(false);
  const [settings, setSettings] = useState<AgentSettings>(DEFAULT_SETTINGS);
  const [terminalLogs, setTerminalLogs] = useState<string[]>(["[AION] Terminal ready"]);

  const addMessage = useCallback((m: Omit<Message, "id" | "timestamp">) => {
    const msg: Message = { ...m, id: uid(), timestamp: Date.now() };
    setMessages(prev => [...prev, msg]);
  }, []);

  const addLog = useCallback((log: string) => {
    setTerminalLogs(prev => [...prev.slice(-200), log]);
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (isRunning) return;
    addMessage({ role: "user", content: text });
    setIsRunning(true);
    try {
      await runReActLoop(text, settings, addMessage, addLog);
    } finally {
      setIsRunning(false);
    }
  }, [isRunning, settings, addMessage, addLog]);

  const clearMessages = useCallback(() => {
    setMessages([{ id: uid(), role: "system", content: "AION Agent initialized. Ready for commands.", timestamp: Date.now() }]);
  }, []);

  const updateSettings = useCallback((s: Partial<AgentSettings>) => {
    setSettings(prev => ({ ...prev, ...s }));
  }, []);

  const runToolDirectly = useCallback(async (toolName: string, input: string) => {
    addLog(`[DIRECT] ${toolName}: ${input}`);
    const result = await executeTool(toolName, input, addLog);
    addLog(`[RESULT] ${result.substring(0, 100)}`);
    return result;
  }, [addLog]);

  const clearTerminal = useCallback(() => {
    setTerminalLogs(["[AION] Terminal cleared"]);
  }, []);

  return (
    <AgentContext.Provider value={{
      messages, isRunning, settings, availableTools: AVAILABLE_TOOLS,
      terminalLogs, sendMessage, clearMessages, updateSettings,
      runToolDirectly, addTerminalLog: addLog, clearTerminal,
    }}>
      {children}
    </AgentContext.Provider>
  );
}

export function useAgent() {
  const ctx = useContext(AgentContext);
  if (!ctx) throw new Error("useAgent must be used within AgentProvider");
  return ctx;
}
