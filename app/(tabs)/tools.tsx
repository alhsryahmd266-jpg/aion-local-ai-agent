import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, TextInput, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAgent } from "@/context/AgentContext";
import { useColors } from "@/hooks/useColors";

const TOOL_ICONS: Record<string, any> = {
  web_search: "search",
  terminal: "terminal",
  file_read: "file-text",
  file_write: "edit-3",
  calculate: "cpu",
  http_request: "globe",
  analyze_apk: "package",
};

export default function ToolsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { availableTools, settings, updateSettings, runToolDirectly } = useAgent();
  const [testInput, setTestInput] = useState<Record<string, string>>({});
  const [testResult, setTestResult] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState<string | null>(null);

  async function testTool(toolName: string) {
    const input = testInput[toolName] || "";
    if (!input.trim()) { Alert.alert("Enter input first"); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTesting(toolName);
    try {
      const result = await runToolDirectly(toolName, input);
      setTestResult(p => ({ ...p, [toolName]: result }));
    } finally {
      setTesting(null);
    }
  }

  function toggleTool(toolName: string, enabled: boolean) {
    Haptics.selectionAsync();
    const current = settings.enabledTools;
    const next = enabled ? [...current, toolName] : current.filter(t => t !== toolName);
    updateSettings({ enabledTools: next });
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 20 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>AVAILABLE TOOLS</Text>

      {availableTools.map(tool => {
        const isEnabled = settings.enabledTools.includes(tool.name);
        return (
          <View key={tool.name} style={[styles.toolCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.toolHeader}>
              <View style={[styles.toolIcon, { backgroundColor: isEnabled ? colors.primary + "22" : colors.secondary }]}>
                <Feather name={TOOL_ICONS[tool.name] || "tool"} size={18} color={isEnabled ? colors.primary : colors.mutedForeground} />
              </View>
              <View style={styles.toolInfo}>
                <Text style={[styles.toolName, { color: colors.foreground }]}>{tool.name}</Text>
                <Text style={[styles.toolDesc, { color: colors.mutedForeground }]}>{tool.description}</Text>
              </View>
              <Switch
                value={isEnabled}
                onValueChange={v => toggleTool(tool.name, v)}
                trackColor={{ false: colors.border, true: colors.primary + "66" }}
                thumbColor={isEnabled ? colors.primary : colors.mutedForeground}
              />
            </View>

            {isEnabled && (
              <View style={[styles.testSection, { borderTopColor: colors.border }]}>
                <TextInput
                  style={[styles.testInput, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
                  value={testInput[tool.name] || ""}
                  onChangeText={v => setTestInput(p => ({ ...p, [tool.name]: v }))}
                  placeholder={`Test ${tool.name}...`}
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => testTool(tool.name)}
                  disabled={testing === tool.name}
                  style={[styles.testBtn, { backgroundColor: colors.primary, opacity: testing === tool.name ? 0.6 : 1 }]}
                >
                  <Feather name={testing === tool.name ? "loader" : "play"} size={14} color="#fff" />
                  <Text style={styles.testBtnText}>{testing === tool.name ? "..." : "TEST"}</Text>
                </TouchableOpacity>
                {testResult[tool.name] && (
                  <View style={[styles.resultBox, { backgroundColor: colors.terminal, borderColor: colors.success + "33" }]}>
                    <Text style={[styles.resultText, { color: colors.terminalText }]} numberOfLines={4}>
                      {testResult[tool.name]}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 12 },
  sectionTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 1.5, marginBottom: 4, marginLeft: 4 },
  toolCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  toolHeader: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  toolIcon: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  toolInfo: { flex: 1 },
  toolName: { fontSize: 15, fontWeight: "600" },
  toolDesc: { fontSize: 12, marginTop: 2 },
  testSection: { borderTopWidth: 1, padding: 12, gap: 8 },
  testInput: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, borderWidth: 1 },
  testBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 8, paddingVertical: 9, paddingHorizontal: 14 },
  testBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  resultBox: { borderRadius: 10, padding: 10, borderWidth: 1 },
  resultText: { fontSize: 12, fontFamily: "monospace", lineHeight: 18 },
});
