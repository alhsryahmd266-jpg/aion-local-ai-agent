import React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Message } from "@/context/AgentContext";
import { useColors } from "@/hooks/useColors";

interface Props {
  message: Message;
}

export function MessageBubble({ message }: Props) {
  const colors = useColors();

  if (message.role === "system") {
    return (
      <View style={[styles.systemRow]}>
        <Text style={[styles.systemText, { color: colors.mutedForeground }]}>{message.content}</Text>
      </View>
    );
  }

  if (message.role === "thinking") {
    return (
      <View style={[styles.thinkingRow]}>
        <View style={[styles.thinkingBubble, { backgroundColor: colors.card, borderColor: colors.thinking + "44", borderWidth: 1 }]}>
          <View style={styles.thinkingHeader}>
            <Feather name="cpu" size={12} color={colors.thinking} />
            <Text style={[styles.thinkingLabel, { color: colors.thinking }]}>THINKING</Text>
          </View>
          <Text style={[styles.thinkingContent, { color: colors.mutedForeground }]}>{message.content}</Text>
        </View>
      </View>
    );
  }

  if (message.role === "tool_call") {
    return (
      <View style={[styles.toolRow]}>
        <View style={[styles.toolBubble, { backgroundColor: colors.card, borderColor: colors.tool + "44", borderWidth: 1 }]}>
          <View style={styles.toolHeader}>
            <Feather name="zap" size={12} color={colors.tool} />
            <Text style={[styles.toolLabel, { color: colors.tool }]}>TOOL: {message.toolName?.toUpperCase()}</Text>
          </View>
          <Text style={[styles.toolInput, { color: colors.foreground, fontFamily: "monospace" }]} numberOfLines={3}>{message.toolInput}</Text>
        </View>
      </View>
    );
  }

  if (message.role === "tool_result") {
    return (
      <View style={[styles.toolRow]}>
        <View style={[styles.resultBubble, { backgroundColor: colors.terminal, borderColor: colors.success + "44", borderWidth: 1 }]}>
          <View style={styles.toolHeader}>
            <Feather name="check-circle" size={12} color={colors.success} />
            <Text style={[styles.toolLabel, { color: colors.success }]}>RESULT: {message.toolName?.toUpperCase()}</Text>
          </View>
          <Text style={[styles.resultText, { color: colors.terminalText }]} numberOfLines={6}>{message.toolOutput}</Text>
        </View>
      </View>
    );
  }

  const isUser = message.role === "user";

  return (
    <View style={[styles.row, isUser ? styles.userRow : styles.agentRow]}>
      {!isUser && (
        <View style={[styles.avatar, { backgroundColor: colors.primary + "22", borderColor: colors.primary + "55", borderWidth: 1 }]}>
          <Feather name="cpu" size={14} color={colors.primary} />
        </View>
      )}
      <View style={[
        styles.bubble,
        isUser
          ? { backgroundColor: colors.user, maxWidth: "78%" }
          : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, maxWidth: "82%" }
      ]}>
        <Text style={[styles.text, { color: isUser ? "#ffffff" : colors.foreground }]}>{message.content}</Text>
        <Text style={[styles.time, { color: isUser ? "rgba(255,255,255,0.6)" : colors.mutedForeground }]}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", marginVertical: 4, paddingHorizontal: 16, alignItems: "flex-end", gap: 8 },
  userRow: { justifyContent: "flex-end" },
  agentRow: { justifyContent: "flex-start" },
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, gap: 4 },
  text: { fontSize: 15, lineHeight: 22 },
  time: { fontSize: 10, alignSelf: "flex-end" },
  systemRow: { alignItems: "center", marginVertical: 8 },
  systemText: { fontSize: 11, fontStyle: "italic" },
  thinkingRow: { paddingHorizontal: 16, marginVertical: 4 },
  thinkingBubble: { borderRadius: 12, padding: 10, gap: 6 },
  thinkingHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  thinkingLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  thinkingContent: { fontSize: 13, lineHeight: 19, fontStyle: "italic" },
  toolRow: { paddingHorizontal: 16, marginVertical: 3 },
  toolBubble: { borderRadius: 10, padding: 10, gap: 6 },
  resultBubble: { borderRadius: 10, padding: 10, gap: 6 },
  toolHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  toolLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  toolInput: { fontSize: 12, lineHeight: 18 },
  resultText: { fontSize: 12, lineHeight: 18, fontFamily: "monospace" },
});
