import { Router } from "express";
import { exec, spawn } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import multer from "multer";

const router = Router();
const execAsync = promisify(exec);

const WORK_DIR = path.resolve(process.cwd(), "../../workdir/terminal");
const UPLOAD_DIR = path.resolve(process.cwd(), "../../uploads/terminal");

// Ensure dirs exist
async function ensureDirs() {
  await fs.mkdir(WORK_DIR, { recursive: true });
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}
ensureDirs().catch(() => {});

// Safe command whitelist / blocklist
const BLOCKED = ["rm -rf /", "mkfs", "dd if=", ":(){ :|:& };:", "fork bomb"];
function isSafe(cmd: string): boolean {
  return !BLOCKED.some(b => cmd.includes(b));
}

// ── POST /exec — execute a shell command ──────────────────────────
router.post("/exec", async (req, res) => {
  const { command, cwd } = req.body as { command: string; cwd?: string };
  if (!command) return res.status(400).json({ error: "command required" });
  if (!isSafe(command)) return res.status(403).json({ error: "Command blocked for safety" });

  const workDir = cwd ? path.resolve(WORK_DIR, cwd.replace(/\.\./g, "")) : WORK_DIR;
  await fs.mkdir(workDir, { recursive: true });

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: workDir,
      timeout: 30000,
      maxBuffer: 1024 * 1024 * 4,
      env: {
        ...process.env,
        HOME: workDir,
        TERM: "xterm-256color",
        PATH: `/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:${process.env.PATH || ""}`,
      },
    });
    res.json({ stdout: stdout || "", stderr: stderr || "", exitCode: 0 });
  } catch (e: any) {
    res.json({
      stdout: e.stdout || "",
      stderr: e.stderr || e.message || "Error",
      exitCode: e.code ?? 1,
    });
  }
});

// ── POST /upload — receive file from mobile ───────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => cb(null, `${Date.now()}_${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 200 * 1024 * 1024 } });

router.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file" });
  res.json({
    filename: req.file.filename,
    originalname: req.file.originalname,
    size: req.file.size,
    path: req.file.path,
    url: `/api/terminal/files/${req.file.filename}`,
  });
});

// ── GET /files/:name — download uploaded file ─────────────────────
router.get("/files/:name", async (req, res) => {
  const fp = path.join(UPLOAD_DIR, path.basename(req.params.name));
  try {
    await fs.access(fp);
    res.download(fp);
  } catch {
    res.status(404).json({ error: "Not found" });
  }
});

// ── GET /ls — list working directory ─────────────────────────────
router.get("/ls", async (req, res) => {
  const dir = req.query.dir ? path.resolve(WORK_DIR, String(req.query.dir).replace(/\.\./g, "")) : WORK_DIR;
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    res.json(entries.map(e => ({ name: e.name, isDir: e.isDirectory(), path: path.join(dir, e.name) })));
  } catch {
    res.json([]);
  }
});

// ── POST /vision — analyze image with AI (describe) ──────────────
router.post("/vision", async (req, res) => {
  const { imageBase64, prompt, endpoint, model } = req.body as {
    imageBase64: string; prompt: string; endpoint?: string; model?: string;
  };
  if (!imageBase64) return res.status(400).json({ error: "imageBase64 required" });

  const ollamaEndpoint = (endpoint || "http://localhost:11434").replace("/api/generate", "").replace(/\/$/, "");
  const visionModel = model || "llava:7b";

  try {
    const r = await fetch(`${ollamaEndpoint}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: visionModel,
        prompt: prompt || "Describe this image in detail. If it contains code or text, transcribe it.",
        images: [imageBase64],
        stream: false,
      }),
    });
    if (!r.ok) throw new Error(`Ollama vision error: ${r.status}`);
    const data = await r.json() as { response: string };
    res.json({ result: data.response, model: visionModel });
  } catch (e: any) {
    // Fallback: basic image info
    const buf = Buffer.from(imageBase64, "base64");
    res.json({
      result: `[Vision Demo Mode] Image received (${(buf.length / 1024).toFixed(1)}KB). To enable real vision: run 'ollama pull llava:7b' and configure endpoint in Settings. The image appears to contain visual content that requires an active vision-capable LLM to analyze.`,
      model: "demo",
    });
  }
});

// ── POST /github-upload — push any file to GitHub ────────────────
router.post("/github-upload", async (req, res) => {
  const { repo, branch = "main", filePath, content, message } = req.body as {
    repo: string; branch?: string; filePath: string; content: string; message?: string;
  };
  const token = process.env.GITHUB_TOKEN;
  if (!token) return res.status(500).json({ error: "GITHUB_TOKEN not set" });
  if (!repo || !filePath || !content) return res.status(400).json({ error: "repo, filePath, content required" });

  try {
    // Check if file exists (to get SHA)
    let sha: string | undefined;
    const checkUrl = `https://api.github.com/repos/${repo}/contents/${filePath}?ref=${branch}`;
    const check = await fetch(checkUrl, { headers: { Authorization: `token ${token}` } });
    if (check.ok) {
      const d = await check.json() as { sha: string };
      sha = d.sha;
    }

    const body: any = {
      message: message || `Upload ${filePath} via AION Agent`,
      content,
      branch,
    };
    if (sha) body.sha = sha;

    const r = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
      method: "PUT",
      headers: { Authorization: `token ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await r.json() as { content?: { html_url: string }; message?: string };
    if (!r.ok) return res.status(400).json({ error: d.message });
    res.json({ url: d.content?.html_url, success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
