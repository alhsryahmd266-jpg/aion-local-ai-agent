import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, TextInput, ActivityIndicator, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAgent } from "@/context/AgentContext";
import { useColors } from "@/hooks/useColors";

export default function VisionScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { analyzeImage, sendMessage } = useAgent();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("Describe this image in detail. If it contains code, UI, or text — transcribe it fully.");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  async function pickFromGallery() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setResult("Permission denied"); return; }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      base64: true,
    });
    if (!r.canceled && r.assets[0]) {
      setImageUri(r.assets[0].uri);
      setImageBase64(r.assets[0].base64 || null);
      setResult("");
    }
  }

  async function pickFromCamera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { setResult("Camera permission denied"); return; }
    const r = await ImagePicker.launchCameraAsync({ quality: 0.8, base64: true });
    if (!r.canceled && r.assets[0]) {
      setImageUri(r.assets[0].uri);
      setImageBase64(r.assets[0].base64 || null);
      setResult("");
    }
  }

  async function pickAnyFile() {
    const r = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
    if (r.canceled || !r.assets?.[0]) return;
    const asset = r.assets[0];
    const isImage = asset.mimeType?.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(asset.name);
    if (isImage) {
      const b64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      setImageUri(asset.uri);
      setImageBase64(b64);
      setResult("");
    } else {
      // For APK / other files: show file info
      setImageUri(null);
      setImageBase64(null);
      setResult(`File selected: ${asset.name}\nSize: ${((asset.size || 0) / 1024).toFixed(1)} KB\nType: ${asset.mimeType || "unknown"}\n\nSend to chat to analyze with AI.`);
    }
  }

  async function analyze() {
    if (!imageBase64) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoading(true);
    setResult("");
    try {
      const r = await analyzeImage(imageBase64, prompt);
      setResult(r);
    } catch (e: any) {
      setResult(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function sendToChat() {
    if (!imageUri) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await sendMessage(prompt || "Analyze this image", imageUri);
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 20 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Pick buttons */}
      <View style={styles.pickRow}>
        <PickBtn icon="camera" label="Camera" color={colors.primary} onPress={pickFromCamera} />
        <PickBtn icon="image" label="Gallery" color={colors.accent} onPress={pickFromGallery} />
        <PickBtn icon="file" label="Any File" color={colors.warning} onPress={pickAnyFile} />
      </View>

      {/* Image preview */}
      {imageUri ? (
        <View style={[styles.previewBox, { borderColor: colors.border }]}>
          <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" />
        </View>
      ) : (
        <View style={[styles.placeholder, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="eye" size={40} color={colors.mutedForeground} />
          <Text style={[styles.placeholderText, { color: colors.mutedForeground }]}>
            Pick an image or any file{"\n"}(APK, PDF, code, screenshots...)
          </Text>
        </View>
      )}

      {/* Prompt */}
      <View style={[styles.promptBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>VISION PROMPT</Text>
        <TextInput
          style={[styles.promptInput, { color: colors.foreground, borderColor: colors.border }]}
          value={prompt}
          onChangeText={setPrompt}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>

      {/* Action buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          onPress={analyze}
          disabled={!imageBase64 || loading}
          style={[styles.actionBtn, { backgroundColor: colors.primary, opacity: !imageBase64 ? 0.5 : 1, flex: 1 }]}
        >
          {loading
            ? <ActivityIndicator size="small" color="#fff" />
            : <><Feather name="zap" size={16} color="#fff" /><Text style={styles.actionBtnText}>ANALYZE</Text></>
          }
        </TouchableOpacity>
        <TouchableOpacity
          onPress={sendToChat}
          disabled={!imageUri}
          style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, flex: 1, opacity: !imageUri ? 0.5 : 1 }]}
        >
          <Feather name="message-circle" size={16} color={colors.primary} />
          <Text style={[styles.actionBtnText, { color: colors.primary }]}>SEND TO CHAT</Text>
        </TouchableOpacity>
      </View>

      {/* Result */}
      {result ? (
        <View style={[styles.resultBox, { backgroundColor: colors.terminal || "#000", borderColor: colors.success + "44" }]}>
          <View style={styles.resultHeader}>
            <Feather name="eye" size={13} color={colors.success} />
            <Text style={[styles.resultLabel, { color: colors.success }]}>VISION RESULT</Text>
          </View>
          <Text style={[styles.resultText, { color: colors.terminalText || "#00ff88" }]} selectable>{result}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

function PickBtn({ icon, label, color, onPress }: { icon: any; label: string; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.pickBtn, { backgroundColor: color + "18", borderColor: color + "44" }]}>
      <Feather name={icon} size={22} color={color} />
      <Text style={[styles.pickLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 14 },
  pickRow: { flexDirection: "row", gap: 10 },
  pickBtn: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 16, alignItems: "center", gap: 8 },
  pickLabel: { fontSize: 12, fontWeight: "600" },
  previewBox: { borderRadius: 16, borderWidth: 1, overflow: "hidden", height: 220 },
  preview: { width: "100%", height: "100%" },
  placeholder: { borderRadius: 16, borderWidth: 1, borderStyle: "dashed", height: 180, alignItems: "center", justifyContent: "center", gap: 12 },
  placeholderText: { fontSize: 14, textAlign: "center", lineHeight: 22 },
  promptBox: { borderRadius: 14, borderWidth: 1, padding: 12, gap: 6 },
  label: { fontSize: 10, fontWeight: "700", letterSpacing: 1.2 },
  promptInput: { fontSize: 13, lineHeight: 20, borderRadius: 8, borderWidth: 1, padding: 8, height: 80 },
  actionRow: { flexDirection: "row", gap: 10 },
  actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 12, paddingVertical: 13 },
  actionBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  resultBox: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 8 },
  resultHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  resultLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 1.2 },
  resultText: { fontSize: 13, lineHeight: 20, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
});
