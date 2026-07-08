import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";

export function TypingIndicator() {
  const colors = useColors();
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay(600 - delay),
        ])
      );
    const a1 = anim(dot1, 0);
    const a2 = anim(dot2, 150);
    const a3 = anim(dot3, 300);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, []);

  const dotStyle = (dot: Animated.Value) => ({
    transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
    opacity: dot.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
      <Animated.View style={[styles.dot, { backgroundColor: colors.primary }, dotStyle(dot1)]} />
      <Animated.View style={[styles.dot, { backgroundColor: colors.primary }, dotStyle(dot2)]} />
      <Animated.View style={[styles.dot, { backgroundColor: colors.primary }, dotStyle(dot3)]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 18, marginLeft: 36, marginRight: 80, marginVertical: 4, alignSelf: "flex-start" },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
