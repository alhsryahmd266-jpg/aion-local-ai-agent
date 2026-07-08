import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, FlatList, Platform, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAgent } from "@/context/AgentContext";
import { useColors } from "@/hooks/useColors";

const TEMPLATES: Record<string, string> = {
  "python": `#!/usr/bin/env python3
# AION Agent Script
import sys, os

def main():
    print("AION Agent running...")
    
if __name__ == "__main__":
    main()
`,
  "javascript": `// AION Agent Script
const http = require('http');

async function main() {
  console.log('AION Agent running...');
}

main();
`,
  "bash": `#!/bin/bash
# AION Agent Script
echo "AION Agent running..."
uname -a
`,
  "smali": `.class public Lcom/aion/patch/Hook;
.super Ljava/lang/Object;

.method public static bypass()V
    .locals 1
    const/4 v0, 0x1
    return-void
.end method
`,
};

export default function EditorScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { execTerminalCommand, uploadFileToGithub } = useAgent();

  const [code, setCode] = useState(TEMPLATES["python"]);
  const [filename, setFilename] = useState("script.py");
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);
  const [ghRepo, setGhRepo] = useState("");

  async function runCode() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRunning(true);
    setOutput("");
    try {
      // Write file then run it
      const ext = filename.split(".").pop();
      const writeCmd = `cat > /tmp/${filename} << 'AION_EOF'\n${code}\nAION_EOF`;
      await execTerminalCommand(writeCmd);

      let runCmd = "";
      if (ext === "py") runCmd = `python3 /tmp/${filename}`;
      else if (ext === "js") runCmd = `node /tmp/${filename}`;
      else if (ext === "sh") runCmd = `bash /tmp/${filename}`;
      else if (ext === "rb") runCmd = `ruby /tmp/${filename}`;
      else runCmd = `cat /tmp/${filename}`;

      const r = await execTerminalCommand(runCmd);
      setOutput([r.stdout, r.stderr].filter(Boolean).join("\n") || "[no output]");
    } catch (e: any) {
      setOutput(`Error: ${e.message}`);
    } finally {
      setRunning(false);
    }
  }

  async function openFile() {
    const r = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
    if (r.canceled || !r.assets?.[0]) return;
    const asset = r.assets[0];
    try {
      const content = await FileSystem.readAsStringAsync(asset.uri);
      setCode(content);
      setFilename(asset.name);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setOutput(`Cannot read as text: ${asset.name}`);
    }
  }

  async function pushToGithub() {
    if (!ghRepo) { Alert.alert("Enter GitHub repo", "Format: user/repo"); return; }
    try {
      const b64 = btoa(unescape(encodeURIComponent(code)));
      const url = await uploadFileToGithub(ghRepo, filename, b64, `Add ${filename} via AION Editor`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setOutput(`✓ Pushed to GitHub!\n${url}`);
    } catch (e: any) {
      setOutput(`GitHub error: ${e.message}`);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: "#050508", paddingTop: insets.top }]}>
      {/* Toolbar */}
      <View style={styles.toolbar}>
        <TouchableOpacity onPress={openFile} style={styles.toolBtn}>
          <Feather name="folder-open" size={16} color="#a855f7" />
        </TouchableOpacity>
        <TextInput
          style={styles.filenameInput}
          value={filename}
          onChangeText={setFilename}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity onPress={runCode} disabled={running} style={[styles.runBtn, { opacity: running ? 0.5 : 1 }]}>
          <Feather name={running ? "loader" : "play"} size={15} color="#00ff88" />
          <Text style={styles.runText}>{running ? "RUN" : "RUN"}</Text>
        </TouchableOpacity>
      </View>

      {/* Language templates */}
      <FlatList
        horizontal
        data={Object.keys(TEMPLATES)}
        keyExtractor={i => i}
        showsHorizontalScrollIndicator={false}
        style={styles.langBar}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => { setCode(TEMPLATES[item]); setFilename(`script.${item === "javascript" ? "js" : item === "bash" ? "sh" : item}`); }}
            style={styles.langChip}>
            <Text style={styles.langText}>{item}</Text>
          </TouchableOpacity>
        )}
      />

      {/* Editor */}
      <ScrollView style={styles.editorScroll} showsVerticalScrollIndicator>
        <TextInput
          style={styles.editor}
          value={code}
          onChangeText={setCode}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          textAlignVertical="top"
          scrollEnabled={false}
        />
      </ScrollView>

      {/* Output */}
      {output ? (
        <View style={styles.outputBox}>
          <View style={styles.outputHeader}>
            <Feather name="terminal" size={12} color="#00ff88" />
            <Text style={styles.outputLabel}>OUTPUT</Text>
            <TouchableOpacity onPress={() => setOutput("")} style={{ marginLeft: "auto" }}>
              <Feather name="x" size={12} color="#4a5568" />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 150 }} showsVerticalScrollIndicator={false}>
            <Text style={styles.outputText} selectable>{output}</Text>
          </ScrollView>
        </View>
      ) : null}

      {/* Bottom bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 6 }]}>
        <TextInput
          style={styles.ghInput}
          value={ghRepo}
          onChangeText={setGhRepo}
          placeholder="user/repo"
          placeholderTextColor="#2d3748"
          autoCapitalize="none"
        />
        <TouchableOpacity onPress={pushToGithub} style={styles.ghBtn}>
          <Feather name="github" size={15} color="#fff" />
          <Text style={styles.ghBtnText}>PUSH</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  toolbar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#111", gap: 8 },
  toolBtn: { padding: 6 },
  filenameInput: { flex: 1, color: "#a0aec0", fontSize: 13, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", backgroundColor: "#0d0d1a", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  runBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#001a00", borderWidth: 1, borderColor: "#00ff8833", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  runText: { color: "#00ff88", fontSize: 12, fontWeight: "700" },
  langBar: { maxHeight: 36, borderBottomWidth: 1, borderBottomColor: "#111", paddingVertical: 6 },
  langChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: "#111", borderWidth: 1, borderColor: "#1a1a2e" },
  langText: { color: "#a855f7", fontSize: 11, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  editorScroll: { flex: 1 },
  editor: { flex: 1, color: "#e2e8f0", fontSize: 13, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", lineHeight: 20, padding: 14, backgroundColor: "#050508" },
  outputBox: { backgroundColor: "#000", borderTopWidth: 1, borderTopColor: "#111", padding: 10, gap: 6 },
  outputHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  outputLabel: { color: "#00ff88", fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  outputText: { color: "#00ff88", fontSize: 12, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", lineHeight: 18 },
  bottomBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 8, gap: 8, borderTopWidth: 1, borderTopColor: "#111", backgroundColor: "#050505" },
  ghInput: { flex: 1, color: "#a0aec0", fontSize: 13, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  ghBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#1a1a2e", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  ghBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
});
