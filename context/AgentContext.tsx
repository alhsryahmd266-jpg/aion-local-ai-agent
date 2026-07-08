import React, { createContext, useContext, useState, useCallback } from "react";

export type MessageRole = "user" | "assistant" | "thinking" | "tool_call" | "tool_result" | "system" | "vision" | "tot";

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  toolName?: string;
  toolInput?: string;
  toolOutput?: string;
  imageUri?: string;
  totBranches?: string[];
  timestamp: number;
}

export interface AgentSettings {
  endpoint: string;
  model: string;
  visionModel: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  enabledTools: string[];
  useTreeOfThought: boolean;
  totBranches: number;
  apiServerBase: string;
}

const DEFAULT_SYSTEM_PROMPT = `You are AION, an autonomous AI agent. You use ReAct (Reasoning + Acting) loops.
Use [TOOL:name]input[/TOOL] to call tools. Available tools: web_search, terminal, file_read, file_write, calculate, http_request, analyze_apk, vision.
Think step by step. Be concise but thorough.`;

const DEFAULT_SETTINGS: AgentSettings = {
  endpoint: "http://localhost:11434/api/generate",
  model: "phi3:mini",
  visionModel: "llava:7b",
  temperature: 0.7,
  maxTokens: 2048,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  enabledTools: ["web_search", "terminal", "file_read", "file_write", "calculate", "http_request"],
  useTreeOfThought: true,
  totBranches: 3,
  apiServerBase: "",
};

export const AVAILABLE_TOOLS = [
  { name: "web_search", description: "Search the web for real-time information", icon: "search" },
  { name: "terminal", description: "Execute real Linux shell commands on server", icon: "terminal" },
  { name: "file_read", description: "Read files from filesystem", icon: "file-text" },
  { name: "file_write", description: "Write files to filesystem", icon: "edit-3" },
  { name: "calculate", description: "Mathematical calculations", icon: "cpu" },
  { name: "http_request", description: "Make HTTP requests to any URL", icon: "globe" },
  { name: "analyze_apk", description: "Analyze Android APK files", icon: "package" },
  { name: "vision", description: "Analyze and describe images", icon: "eye" },
];

interface AgentContextType {
  messages: Message[];
  isRunning: boolean;
  settings: AgentSettings;
  terminalLogs: string[];
  sendMessage: (text: string, imageUri?: string) => Promise<void>;
  clearMessages: () => void;
  updateSettings: (s: Partial<AgentSettings>) => void;
  runToolDirectly: (toolName: string, input: string) => Promise<string>;
  execTerminalCommand: (cmd: string) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
  uploadFileToGithub: (repo: string, filePath: string, base64: string, msg?: string) => Promise<string>;
  analyzeImage: (imageBase64: string, prompt?: string) => Promise<string>;
  clearTerminal: () => void;
  addTerminalLog: (l: string) => void;
}

const AgentContext = createContext<AgentContextType | null>(null);

function uid() { return Date.now().toString() + Math.random().toString(36).substr(2, 9); }

// ── Tree of Thought ───────────────────────────────────────────────
async function treeOfThought(
  query: string,
  settings: AgentSettings,
  addLog: (l: string) => void,
): Promise<{ best: string; branches: string[] }> {
  addLog("[ToT] Generating thought branches...");
  const branches: string[] = [];
  const numBranches = settings.totBranches || 3;

  const branchPrompts = [
    `Approach this analytically: ${query}`,
    `Approach this creatively: ${query}`,
    `Approach this practically step by step: ${query}`,
    `Approach this from a critical/skeptical angle: ${query}`,
  ].slice(0, numBranches);

  for (let i = 0; i < branchPrompts.length; i++) {
    try {
      const r = await fetch(settings.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: settings.model,
          prompt: `${settings.systemPrompt}\n\n${branchPrompts[i]}\n\nThink briefly (2-3 sentences):`,
          stream: false,
          options: { temperature: 0.8 + i * 0.1, num_predict: 300 },
        }),
      });
      if (r.ok) {
        const d = await r.json() as { response: string };
        branches.push(d.response?.trim() || "");
        addLog(`[ToT] Branch ${i + 1}: ${d.response?.substring(0, 60)}...`);
      }
    } catch {
      branches.push(`Branch ${i + 1}: ${query} — systematic approach`);
    }
  }

  // Score branches — pick longest coherent one as "best"
  const best = branches.reduce((a, b) => (a.length > b.length ? a : b), branches[0] || query);
  addLog(`[ToT] Best branch selected (${best.length} chars)`);
  return { best, branches };
}

// ── Tool Executors ────────────────────────────────────────────────
async function executeTool(
  name: string,
  input: string,
  settings: AgentSettings,
  addLog: (l: string) => void,
): Promise<string> {
  const api = settings.apiServerBase || "";
  addLog(`[TOOL] ${name}: ${input.substring(0, 80)}`);

  try {
    switch (name) {
      case "calculate": {
        const expr = input.replace(/[^0-9+\-*/().%, ^]/g, "").trim();
        try { return `= ${Function(`"use strict"; return (${expr.replace(/\^/g, "**")})`)()}`; }
        catch { return `Error: invalid expression "${input}"`; }
      }

      case "web_search": {
        const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(input)}&format=json&no_html=1&skip_disambig=1`;
        const r = await fetch(url);
        const d = await r.json() as { AbstractText?: string; RelatedTopics?: { Text?: string }[] };
        const abstract = d.AbstractText || "";
        const related = (d.RelatedTopics || []).slice(0, 3).map(t => t.Text || "").filter(Boolean).join("\n");
        return abstract ? `${abstract}\n\n${related}` : `Search results for "${input}":\n${related || "No results found."}`;
      }

      case "terminal": {
        try {
          const r = await fetch(`${api}/api/terminal/exec`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ command: input }),
          });
          const d = await r.json() as { stdout: string; stderr: string; exitCode: number };
          return `$ ${input}\n${d.stdout || ""}${d.stderr ? `\nSTDERR: ${d.stderr}` : ""}\n[exit: ${d.exitCode}]`;
        } catch {
          return `[Demo] $ ${input}\n(Connect to API server for real terminal execution)`;
        }
      }

      case "http_request": {
        let url = input, method = "GET", body: string | undefined;
        try { const p = JSON.parse(input); url = p.url; method = p.method || "GET"; body = p.body; } catch {}
        const r = await fetch(url, { method, body, headers: { "User-Agent": "AION/1.0" } });
        const text = await r.text();
        return `HTTP ${r.status} ${r.statusText}\n${text.substring(0, 800)}`;
      }

      case "vision": {
        try {
          const r = await fetch(`${api}/api/terminal/vision`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: input, endpoint: settings.endpoint, model: settings.visionModel }),
          });
          const d = await r.json() as { result: string };
          return d.result || "No vision result";
        } catch {
          return `[Vision] Cannot analyze without image. Use the Vision tab to capture/select an image.`;
        }
      }

      case "file_read":
        return `[Simulated] Content of ${input}:\nLine 1: AION Agent data\nLine 2: Local AI processing\nLine 3: EOF`;
      case "file_write":
        return `[Simulated] Written: ${input}`;
      case "analyze_apk":
        return `[Simulated APK] Package: com.target.app\nVersion: 2.1.0\nSDK: 21-34\nPermissions: INTERNET, CAMERA, STORAGE\nAd Networks: AdMob detected`;

      default:
        return `Unknown tool: ${name}`;
    }
  } catch (e: any) {
    return `Tool error: ${e.message}`;
  }
}

// ── ReAct + ToT Loop ──────────────────────────────────────────────
async function runAgentLoop(
  userMessage: string,
  settings: AgentSettings,
  addMsg: (m: Omit<Message, "id" | "timestamp">) => void,
  addLog: (l: string) => void,
  imageUri?: string,
): Promise<void> {
  const maxSteps = 8;
  let context = `User: ${userMessage}${imageUri ? " [IMAGE ATTACHED]" : ""}\n\n`;
  const TOOL_PATTERN = /\[TOOL:(\w+)\]([\s\S]*?)\[\/TOOL\]/;

  // Tree of Thought pre-processing
  if (settings.useTreeOfThought) {
    const { best, branches } = await treeOfThought(userMessage, settings, addLog);
    addMsg({ role: "tot", content: `Tree of Thought: ${branches.length} branches explored`, totBranches: branches });
    context += `Pre-analysis (Tree of Thought):\n${best}\n\n`;
  }

  for (let step = 0; step < maxSteps; step++) {
    addLog(`[REACT] Step ${step + 1}/${maxSteps}`);

    const prompt = `${settings.systemPrompt}\n\n${context}Assistant (use [TOOL:name]input[/TOOL] or give final answer):`;
    let responseText = "";

    try {
      const body: any = {
        model: settings.model,
        prompt,
        stream: false,
        options: { temperature: settings.temperature, num_predict: settings.maxTokens },
      };
      if (imageUri) {
        const base64 = imageUri.split(",")[1] || imageUri;
        if (base64.length > 100) body.images = [base64];
      }
      const r = await fetch(settings.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json() as { response: string };
      responseText = d.response || "";
    } catch (e: any) {
      addLog(`[WARN] LLM offline: ${e.message}`);
      responseText = demoResponse(userMessage, step);
    }

    const toolMatch = TOOL_PATTERN.exec(responseText);

    if (toolMatch) {
      const thinking = responseText.substring(0, toolMatch.index).trim();
      if (thinking) {
        addMsg({ role: "thinking", content: thinking });
        context += `Thinking: ${thinking}\n`;
      }
      const toolName = toolMatch[1];
      const toolInput = toolMatch[2].trim();
      addMsg({ role: "tool_call", content: `Calling ${toolName}`, toolName, toolInput });
      const output = await executeTool(toolName, toolInput, settings, addLog);
      addMsg({ role: "tool_result", content: output, toolName, toolOutput: output });
      context += `[TOOL:${toolName}]${toolInput}[/TOOL]\nResult: ${output}\n\n`;
    } else {
      addMsg({ role: "assistant", content: responseText.trim() || "Done." });
      return;
    }
  }
  addMsg({ role: "assistant", content: "Analysis complete. Ask me anything else!" });
}

function demoResponse(msg: string, step: number): string {
  if (step === 0) {
    const lower = msg.toLowerCase();
    if (lower.includes("search") || lower.includes("find") || lower.includes("what") || lower.includes("who"))
      return `Let me search for that.\n[TOOL:web_search]${msg}[/TOOL]`;
    if (/\d.*[\+\-\*\/]/.test(msg) || lower.includes("calc") || lower.includes("compute"))
      return `Calculating...\n[TOOL:calculate]${msg.match(/[\d\s\+\-\*\/\.\^]+/)?.[0]?.trim() || msg}[/TOOL]`;
    if (lower.includes("http") || lower.includes("fetch") || lower.includes("url") || lower.includes("api"))
      return `Fetching...\n[TOOL:http_request]{"url":"https://httpbin.org/json","method":"GET"}[/TOOL]`;
    if (lower.includes("terminal") || lower.includes("command") || lower.includes("run") || lower.includes("bash"))
      return `Running command...\n[TOOL:terminal]${lower.includes("list") || lower.includes("ls") ? "ls -la" : lower.includes("whoami") ? "whoami" : "uname -a"}[/TOOL]`;
  }
  return `I am AION — Autonomous Local AI Agent. I use Tree of Thought reasoning + ReAct loops to solve complex problems.\n\n**Capabilities:**\n• 🧠 Tree of Thought (parallel reasoning branches)\n• 🔧 Real tool execution (web search, terminal, HTTP, files)\n• 👁️ Vision & image analysis\n• 📁 File upload to GitHub\n• 💻 Integrated code editor & real Linux terminal\n\nConnect Ollama with phi3:mini for full offline AI. Ask me anything!`;
}

// ── Provider ──────────────────────────────────────────────────────
export function AgentProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([
    { id: uid(), role: "system", content: "AION v2 — Tree of Thought + Vision + Real Terminal. Ready.", timestamp: Date.now() }
  ]);
  const [isRunning, setIsRunning] = useState(false);
  const [settings, setSettings] = useState<AgentSettings>(DEFAULT_SETTINGS);
  const [terminalLogs, setTerminalLogs] = useState<string[]>(["[AION] Terminal v2 — Real Linux execution"]);

  const addLog = useCallback((l: string) => setTerminalLogs(p => [...p.slice(-300), l]), []);

  const addMsg = useCallback((m: Omit<Message, "id" | "timestamp">) => {
    setMessages(p => [...p, { ...m, id: uid(), timestamp: Date.now() }]);
  }, []);

  const sendMessage = useCallback(async (text: string, imageUri?: string) => {
    if (isRunning) return;
    addMsg({ role: "user", content: text, imageUri });
    setIsRunning(true);
    try { await runAgentLoop(text, settings, addMsg, addLog, imageUri); }
    finally { setIsRunning(false); }
  }, [isRunning, settings, addMsg, addLog]);

  const clearMessages = useCallback(() => {
    setMessages([{ id: uid(), role: "system", content: "AION v2 ready.", timestamp: Date.now() }]);
  }, []);

  const updateSettings = useCallback((s: Partial<AgentSettings>) => setSettings(p => ({ ...p, ...s })), []);

  const runToolDirectly = useCallback(async (toolName: string, input: string) => {
    addLog(`[DIRECT] ${toolName}: ${input}`);
    const r = await executeTool(toolName, input, settings, addLog);
    addLog(`[OUT] ${r.substring(0, 120)}`);
    return r;
  }, [settings, addLog]);

  const execTerminalCommand = useCallback(async (cmd: string) => {
    const api = settings.apiServerBase || "";
    try {
      const r = await fetch(`${api}/api/terminal/exec`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: cmd }),
      });
      return await r.json() as { stdout: string; stderr: string; exitCode: number };
    } catch (e: any) {
      return { stdout: "", stderr: `Connection error: ${e.message}`, exitCode: 1 };
    }
  }, [settings.apiServerBase]);

  const analyzeImage = useCallback(async (imageBase64: string, prompt?: string) => {
    const api = settings.apiServerBase || "";
    try {
      const r = await fetch(`${api}/api/terminal/vision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, prompt: prompt || "Describe this image in detail.", endpoint: settings.endpoint, model: settings.visionModel }),
      });
      const d = await r.json() as { result: string };
      return d.result || "No result";
    } catch (e: any) {
      return `Vision error: ${e.message}`;
    }
  }, [settings]);

  const uploadFileToGithub = useCallback(async (repo: string, filePath: string, base64: string, msg?: string) => {
    const api = settings.apiServerBase || "";
    const r = await fetch(`${api}/api/terminal/github-upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repo, filePath, content: base64, message: msg }),
    });
    const d = await r.json() as { url?: string; error?: string };
    if (d.error) throw new Error(d.error);
    return d.url || "uploaded";
  }, [settings.apiServerBase]);

  const clearTerminal = useCallback(() => setTerminalLogs(["[AION] Terminal cleared"]), []);

  return (
    <AgentContext.Provider value={{
      messages, isRunning, settings, terminalLogs,
      sendMessage, clearMessages, updateSettings,
      runToolDirectly, execTerminalCommand, analyzeImage, uploadFileToGithub,
      clearTerminal, addTerminalLog: addLog,
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
