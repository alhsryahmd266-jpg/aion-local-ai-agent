import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAgent } from "@/context/AgentContext";
import { useColors } from "@/hooks/useColors";

const PRESET_ENDPOINTS = [
  { name: "Ollama (local)", url: "http://localhost:11434/api/generate" },
  { name: "LM Studio", url: "http://localhost:1234/v1/chat/completions" },
  { name: "Groq (online)", url: "https://api.groq.com/openai/v1/chat/completions" },
];

const PRESET_MODELS = [
  "phi3:mini", "phi3:medium", "llama3.2:3b", "qwen2.5:3b", "deepseek-r1:7b", "mistral:7b",
];

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { settings, updateSettings } = useAgent();
  const [localSettings, setLocalSettings] = useState(settings);

  function save() {
    updateSettings(localSettings);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Saved", "Agent settings updated.");
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* LLM Endpoint */}
      <Section title="LLM ENDPOINT" colors={colors}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>Server URL</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
          value={localSettings.endpoint}
          onChangeText={v => setLocalSettings(p => ({ ...p, endpoint: v }))}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="http://localhost:11434/api/generate"
          placeholderTextColor={colors.mutedForeground}
        />
        <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 8 }]}>Presets</Text>
        <View style={styles.presetRow}>
          {PRESET_ENDPOINTS.map(p => (
            <TouchableOpacity key={p.name} onPress={() => { setLocalSettings(s => ({ ...s, endpoint: p.url })); Haptics.selectionAsync(); }}
              style={[styles.presetChip, { backgroundColor: localSettings.endpoint === p.url ? colors.primary : colors.secondary, borderColor: colors.border }]}>
              <Text style={[styles.presetText, { color: localSettings.endpoint === p.url ? colors.primaryForeground : colors.mutedForeground }]}>{p.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Section>

      {/* Model */}
      <Section title="MODEL" colors={colors}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>Model name</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
          value={localSettings.model}
          onChangeText={v => setLocalSettings(p => ({ ...p, model: v }))}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="phi3:mini"
          placeholderTextColor={colors.mutedForeground}
        />
        <View style={[styles.presetRow, { flexWrap: "wrap" }]}>
          {PRESET_MODELS.map(m => (
            <TouchableOpacity key={m} onPress={() => { setLocalSettings(s => ({ ...s, model: m })); Haptics.selectionAsync(); }}
              style={[styles.presetChip, { backgroundColor: localSettings.model === m ? colors.primary : colors.secondary, borderColor: colors.border }]}>
              <Text style={[styles.presetText, { color: localSettings.model === m ? colors.primaryForeground : colors.mutedForeground }]}>{m}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Section>

      {/* System Prompt */}
      <Section title="SYSTEM PROMPT" colors={colors}>
        <TextInput
          style={[styles.textarea, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
          value={localSettings.systemPrompt}
          onChangeText={v => setLocalSettings(p => ({ ...p, systemPrompt: v }))}
          multiline
          numberOfLines={8}
          textAlignVertical="top"
        />
      </Section>

      {/* How to connect Ollama */}
      <View style={[styles.infoBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.infoHeader}>
          <Feather name="info" size={14} color={colors.primary} />
          <Text style={[styles.infoTitle, { color: colors.primary }]}>How to connect Ollama</Text>
        </View>
        <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
          1. Install Ollama on your PC{'\n'}
          2. Run: ollama pull phi3:mini{'\n'}
          3. Run: OLLAMA_HOST=0.0.0.0 ollama serve{'\n'}
          4. Enter your PC's IP as the endpoint{'\n'}
          5. Use same WiFi network as your phone
        </Text>
      </View>

      <TouchableOpacity onPress={save} style={[styles.saveBtn, { backgroundColor: colors.primary }]}>
        <Feather name="save" size={18} color={colors.primaryForeground} />
        <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>Save Settings</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Section({ title, children, colors }: { title: string; children: React.ReactNode; colors: any }) {
  return (
    <View>
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{title}</Text>
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 16 },
  sectionTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 1.5, marginBottom: 8, marginLeft: 4 },
  section: { borderRadius: 16, padding: 14, borderWidth: 1, gap: 6 },
  label: { fontSize: 12, fontWeight: "500", marginBottom: 4 },
  input: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, borderWidth: 1 },
  textarea: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, borderWidth: 1, height: 160 },
  presetRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  presetChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  presetText: { fontSize: 12, fontWeight: "500" },
  infoBox: { borderRadius: 16, padding: 14, borderWidth: 1, gap: 8 },
  infoHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  infoTitle: { fontSize: 13, fontWeight: "700" },
  infoText: { fontSize: 13, lineHeight: 21 },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, paddingVertical: 16 },
  saveBtnText: { fontSize: 16, fontWeight: "700" },
});
