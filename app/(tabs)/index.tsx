import React, { useState, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAgent } from "@/context/AgentContext";
import { MessageBubble } from "@/components/MessageBubble";
import { TypingIndicator } from "@/components/TypingIndicator";
import { useColors } from "@/hooks/useColors";
import { Message } from "@/context/AgentContext";

const QUICK_PROMPTS = [
  "Search for latest AI news",
  "Calculate 1024 * 768",
  "Fetch https://httpbin.org/json",
  "What can you do?",
];

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { messages, isRunning, sendMessage, clearMessages } = useAgent();
  const [input, setInput] = useState("");
  const listRef = useRef<FlatList<Message>>(null);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isRunning) return;
    setInput("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await sendMessage(text);
  }, [input, isRunning, sendMessage]);

  const handleQuick = useCallback((prompt: string) => {
    Haptics.selectionAsync();
    sendMessage(prompt);
  }, [sendMessage]);

  const renderItem = useCallback(({ item }: { item: Message }) => (
    <MessageBubble message={item} />
  ), []);

  const keyExtractor = useCallback((item: Message) => item.id, []);

  const isDark = useColorScheme() === "dark";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.statusDot, { backgroundColor: isRunning ? colors.warning : colors.success }]} />
          <View>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>AION Agent</Text>
            <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
              {isRunning ? "Processing..." : "Ready"}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => { clearMessages(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
          style={[styles.clearBtn, { backgroundColor: colors.secondary }]}>
          <Feather name="trash-2" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={[styles.list, { paddingBottom: 8 }]}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListFooterComponent={isRunning ? <View style={{ paddingHorizontal: 16, marginTop: 4 }}><TypingIndicator /></View> : null}
      />

      {/* Quick prompts */}
      {messages.length <= 2 && !isRunning && (
        <View style={styles.quickRow}>
          <FlatList
            horizontal
            data={QUICK_PROMPTS}
            keyExtractor={i => i}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => handleQuick(item)}
                style={[styles.quickChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.quickText, { color: colors.mutedForeground }]}>{item}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* Input */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.inputRow, {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          paddingBottom: insets.bottom + 8,
        }]}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.secondary, color: colors.foreground, borderColor: colors.border }]}
            value={input}
            onChangeText={setInput}
            placeholder="Ask AION anything..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            maxLength={2000}
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!input.trim() || isRunning}
            style={[styles.sendBtn, {
              backgroundColor: (!input.trim() || isRunning) ? colors.secondary : colors.primary,
            }]}
          >
            {isRunning
              ? <Feather name="loader" size={18} color={colors.mutedForeground} />
              : <Feather name="send" size={18} color={(!input.trim()) ? colors.mutedForeground : colors.primaryForeground} />
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  headerTitle: { fontSize: 17, fontWeight: "700", letterSpacing: -0.3 },
  headerSub: { fontSize: 12, marginTop: 1 },
  clearBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  list: { paddingTop: 12 },
  quickRow: { paddingVertical: 10 },
  quickChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  quickText: { fontSize: 13 },
  inputRow: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 12, paddingTop: 10, gap: 8, borderTopWidth: 1 },
  input: { flex: 1, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, maxHeight: 120, borderWidth: 1 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
