import React, { useState, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, FlatList, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAgent } from "@/context/AgentContext";

const QUICK_CMDS = [
  "uname -a", "ls -la", "pwd", "whoami",
  "cat /etc/os-release", "ps aux | head -10",
  "df -h", "free -m", "curl https://httpbin.org/json",
  "python3 --version", "node --version", "java -version",
];

interface LogLine {
  text: string;
  type: "cmd" | "out" | "err" | "info" | "upload";
}

export default function TerminalScreen() {
  const insets = useSafeAreaInsets();
  const { execTerminalCommand, uploadFileToGithub, settings } = useAgent();
  const [cmd, setCmd] = useState("");
  const [logs, setLogs] = useState<LogLine[]>([
    { text: "AION Real Linux Terminal — connected to API server", type: "info" },
    { text: `Server: ${settings.apiServerBase || "same origin"}/api/terminal`, type: "info" },
    { text: 'Type a command or pick from quick commands below', type: "info" },
  ]);
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [ghRepo, setGhRepo] = useState("");
  const [showGh, setShowGh] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const addLog = useCallback((line: LogLine) => {
    setLogs(p => [...p.slice(-500), line]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 50);
  }, []);

  async function runCmd(command?: string) {
    const c = (command ?? cmd).trim();
    if (!c || running) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setHistory(p => [c, ...p.slice(0, 49)]);
    setHistIdx(-1);
    setCmd("");
    addLog({ text: `$ ${c}`, type: "cmd" });
    setRunning(true);
    try {
      const r = await execTerminalCommand(c);
      if (r.stdout) r.stdout.split("\n").filter(Boolean).forEach(l => addLog({ text: l, type: "out" }));
      if (r.stderr) r.stderr.split("\n").filter(Boolean).forEach(l => addLog({ text: l, type: "err" }));
      if (!r.stdout && !r.stderr) addLog({ text: `[exit ${r.exitCode}]`, type: "info" });
    } catch (e: any) {
      addLog({ text: `Error: ${e.message}`, type: "err" });
    } finally {
      setRunning(false);
    }
  }

  async function pickAndUpload() {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      addLog({ text: `Picked: ${asset.name} (${((asset.size || 0) / 1024).toFixed(1)}KB)`, type: "upload" });

      if (!ghRepo) {
        addLog({ text: "Set GitHub repo (user/repo) first — tap GitHub icon", type: "err" });
        setShowGh(true);
        return;
      }
      addLog({ text: `Uploading to GitHub: ${ghRepo}...`, type: "upload" });
      const b64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      const url = await uploadFileToGithub(ghRepo, asset.name, b64, `Upload ${asset.name} via AION Terminal`);
      addLog({ text: `✓ Uploaded: ${url}`, type: "upload" });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      addLog({ text: `Upload error: ${e.message}`, type: "err" });
    }
  }

  const logColor = (type: LogLine["type"]) => {
    switch (type) {
      case "cmd": return "#00d4ff";
      case "out": return "#00ff88";
      case "err": return "#ff4444";
      case "upload": return "#f59e0b";
      default: return "#4a5568";
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.dots}>
          <View style={[styles.dot, { backgroundColor: "#ef4444" }]} />
          <View style={[styles.dot, { backgroundColor: "#f59e0b" }]} />
          <View style={[styles.dot, { backgroundColor: "#10b981" }]} />
        </View>
        <Text style={styles.headerTitle}>Linux Terminal</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => setShowGh(p => !p)} style={styles.iconBtn}>
            <Feather name="github" size={16} color={showGh ? "#00d4ff" : "#4a5568"} />
          </TouchableOpacity>
          <TouchableOpacity onPress={pickAndUpload} style={styles.iconBtn}>
            <Feather name="upload" size={16} color="#f59e0b" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setLogs([{ text: "Terminal cleared", type: "info" }]); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }} style={styles.iconBtn}>
            <Feather name="trash-2" size={16} color="#4a5568" />
          </TouchableOpacity>
        </View>
      </View>

      {/* GitHub repo input */}
      {showGh && (
        <View style={styles.ghBar}>
          <Feather name="github" size={14} color="#4a5568" />
          <TextInput
            style={styles.ghInput}
            value={ghRepo}
            onChangeText={setGhRepo}
            placeholder="user/repo for file upload"
            placeholderTextColor="#2d3748"
            autoCapitalize="none"
          />
        </View>
      )}

      {/* Logs */}
      <ScrollView ref={scrollRef} style={styles.logs} contentContainerStyle={{ paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
        {logs.map((l, i) => (
          <Text key={i} style={[styles.logLine, { color: logColor(l.type) }]} selectable>{l.text}</Text>
        ))}
        {running && <Text style={[styles.logLine, { color: "#00d4ff" }]}>▋</Text>}
      </ScrollView>

      {/* Quick commands */}
      <FlatList
        horizontal
        data={QUICK_CMDS}
        keyExtractor={i => i}
        showsHorizontalScrollIndicator={false}
        style={styles.quickList}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => runCmd(item)} style={styles.quickChip}>
            <Text style={styles.quickText}>{item}</Text>
          </TouchableOpacity>
        )}
      />

      {/* Input */}
      <View style={[styles.inputRow, { paddingBottom: insets.bottom + 8 }]}>
        <Text style={styles.prompt}>$</Text>
        <TextInput
          style={styles.input}
          value={cmd}
          onChangeText={setCmd}
          placeholder="enter command..."
          placeholderTextColor="#2d3748"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="send"
          onSubmitEditing={() => runCmd()}
          onKeyPress={({ nativeEvent }) => {
            if (nativeEvent.key === "ArrowUp" && history.length) {
              const idx = Math.min(histIdx + 1, history.length - 1);
              setHistIdx(idx);
              setCmd(history[idx]);
            }
          }}
        />
        <TouchableOpacity onPress={pickAndUpload} style={styles.uploadBtn}>
          <Feather name="paperclip" size={16} color="#f59e0b" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => runCmd()} disabled={!cmd.trim() || running}
          style={[styles.runBtn, { opacity: !cmd.trim() || running ? 0.4 : 1 }]}>
          <Feather name="play" size={16} color="#00ff88" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#111" },
  dots: { flexDirection: "row", gap: 6 },
  dot: { width: 11, height: 11, borderRadius: 6 },
  headerTitle: { flex: 1, color: "#4a5568", fontSize: 13, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", marginLeft: 12 },
  headerRight: { flexDirection: "row", gap: 12 },
  iconBtn: { padding: 4 },
  ghBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 8, gap: 8, borderBottomWidth: 1, borderBottomColor: "#111", backgroundColor: "#050505" },
  ghInput: { flex: 1, color: "#00d4ff", fontSize: 13, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  logs: { flex: 1, paddingHorizontal: 14, paddingTop: 6 },
  logLine: { fontSize: 12, lineHeight: 19, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  quickList: { maxHeight: 40, borderTopWidth: 1, borderTopColor: "#111", paddingVertical: 6 },
  quickChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: "#0a0a0a", borderWidth: 1, borderColor: "#1a1a2e" },
  quickText: { color: "#a855f7", fontSize: 11, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  inputRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingTop: 8, gap: 8, borderTopWidth: 1, borderTopColor: "#111", backgroundColor: "#050505" },
  prompt: { color: "#00ff88", fontSize: 16, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", fontWeight: "700" },
  input: { flex: 1, color: "#00ff88", fontSize: 13, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", paddingVertical: 8 },
  uploadBtn: { padding: 6 },
  runBtn: { width: 34, height: 34, borderRadius: 8, backgroundColor: "#001a00", borderWidth: 1, borderColor: "#00ff8833", alignItems: "center", justifyContent: "center" },
});
