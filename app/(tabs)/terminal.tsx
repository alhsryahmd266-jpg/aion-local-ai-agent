import React, { useState, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, FlatList,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAgent } from "@/context/AgentContext";
import { useColors } from "@/hooks/useColors";

const QUICK_COMMANDS = [
  { label: "web_search", cmd: 'web_search: "latest AI models 2025"' },
  { label: "calculate", cmd: "calculate: 2^32" },
  { label: "http", cmd: 'http_request: {"url":"https://httpbin.org/json","method":"GET"}' },
  { label: "file_read", cmd: "file_read: /etc/hosts" },
];

export default function TerminalScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { terminalLogs, runToolDirectly, clearTerminal } = useAgent();
  const [cmd, setCmd] = useState("");
  const [running, setRunning] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  async function runCmd() {
    if (!cmd.trim() || running) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRunning(true);
    const [toolName, ...rest] = cmd.split(":");
    const input = rest.join(":").trim();
    await runToolDirectly(toolName.trim(), input || cmd);
    setCmd("");
    setRunning(false);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }

  return (
    <View style={[styles.container, { backgroundColor: "#000000" }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.dot, { backgroundColor: "#ef4444" }]} />
          <View style={[styles.dot, { backgroundColor: "#f59e0b" }]} />
          <View style={[styles.dot, { backgroundColor: "#10b981" }]} />
          <Text style={styles.headerTitle}>AION Terminal</Text>
        </View>
        <TouchableOpacity onPress={() => { clearTerminal(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}>
          <Feather name="trash-2" size={16} color="#4a5568" />
        </TouchableOpacity>
      </View>

      {/* Logs */}
      <ScrollView
        ref={scrollRef}
        style={styles.logs}
        contentContainerStyle={{ paddingBottom: 8 }}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        {terminalLogs.map((log, i) => {
          const color = log.startsWith("[TOOL]") ? "#f59e0b"
            : log.startsWith("[RESULT]") ? "#10b981"
            : log.startsWith("[ERROR]") ? "#ef4444"
            : log.startsWith("[WARN]") ? "#fbbf24"
            : log.startsWith("[DIRECT]") ? "#a855f7"
            : "#00ff88";
          return (
            <Text key={i} style={[styles.logLine, { color }]}>
              {log}
            </Text>
          );
        })}
        {running && <Text style={[styles.logLine, { color: "#00d4ff" }]}>{'> processing...'}</Text>}
      </ScrollView>

      {/* Quick cmds */}
      <View style={styles.quickRow}>
        <FlatList
          horizontal
          data={QUICK_COMMANDS}
          keyExtractor={i => i.label}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => setCmd(item.cmd)}
              style={styles.quickChip}>
              <Text style={styles.quickText}>{item.label}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Input */}
      <View style={[styles.inputRow, { paddingBottom: insets.bottom + 8 }]}>
        <Text style={styles.prompt}>{'>'}</Text>
        <TextInput
          style={styles.input}
          value={cmd}
          onChangeText={setCmd}
          placeholder="tool_name: input..."
          placeholderTextColor="#2d3748"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="send"
          onSubmitEditing={runCmd}
        />
        <TouchableOpacity onPress={runCmd} disabled={!cmd.trim() || running}
          style={[styles.runBtn, { opacity: !cmd.trim() || running ? 0.4 : 1 }]}>
          <Feather name="play" size={16} color="#00ff88" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: "#111" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  headerTitle: { color: "#4a5568", fontSize: 13, fontFamily: "monospace", marginLeft: 8 },
  logs: { flex: 1, paddingHorizontal: 14, paddingTop: 8 },
  logLine: { fontSize: 12, lineHeight: 19, fontFamily: "monospace" },
  quickRow: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: "#111" },
  quickChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: "#111", borderWidth: 1, borderColor: "#222" },
  quickText: { color: "#a855f7", fontSize: 12, fontFamily: "monospace" },
  inputRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingTop: 8, gap: 8, borderTopWidth: 1, borderTopColor: "#111", backgroundColor: "#050505" },
  prompt: { color: "#00ff88", fontSize: 16, fontFamily: "monospace", fontWeight: "700" },
  input: { flex: 1, color: "#00ff88", fontSize: 13, fontFamily: "monospace", paddingVertical: 8 },
  runBtn: { width: 36, height: 36, borderRadius: 8, backgroundColor: "#001a00", borderWidth: 1, borderColor: "#00ff8833", alignItems: "center", justifyContent: "center" },
});
