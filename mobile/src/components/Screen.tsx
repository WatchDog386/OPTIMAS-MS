import type { ReactNode } from "react";
import {
  Animated,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { colors, space } from "../theme";
import { GlassBackground } from "./Glass";
import { usePullToRefresh } from "./PullToRefresh";

interface Props {
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  edges?: Edge[];
  contentStyle?: ViewStyle;
  footer?: ReactNode;
  scrollEnabled?: boolean;
  /** Frosted grey glass backdrop. */
  glow?: boolean;
}

/** Space reserved at the bottom so content clears the floating tab bar. */
export const TAB_BAR_CLEARANCE = 112;

export function Screen({
  children,
  scroll = true,
  refreshing,
  onRefresh,
  edges = ["top"],
  contentStyle,
  footer,
  scrollEnabled = true,
  glow = true,
}: Props) {
  const ptr = usePullToRefresh(onRefresh, refreshing);
  return (
    <View style={styles.root}>
      {glow ? <GlassBackground /> : null}
      <SafeAreaView style={{ flex: 1 }} edges={edges}>
        {scroll ? (
          <View style={{ flex: 1 }}>
            {ptr.indicator}
            <Animated.View style={ptr.style ?? { flex: 1 }}>
              <ScrollView
                ref={ptr.scrollRef}
                contentContainerStyle={[
                  styles.content,
                  footer ? { paddingBottom: space.xxl } : null,
                  contentStyle,
                ]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                scrollEnabled={scrollEnabled}
                refreshControl={
                  onRefresh && !ptr.enabled ? (
                    <RefreshControl
                      refreshing={!!refreshing}
                      onRefresh={onRefresh}
                      tintColor={colors.primary}
                      colors={[colors.primary]}
                    />
                  ) : undefined
                }
              >
                {children}
              </ScrollView>
            </Animated.View>
          </View>
        ) : (
          <View style={[styles.content, { flex: 1 }, contentStyle]}>
            {children}
          </View>
        )}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgBottom },
  content: {
    padding: space.lg,
    paddingBottom: TAB_BAR_CLEARANCE,
    gap: space.lg,
  },
  footer: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    backgroundColor: "rgba(255,255,255,0.72)",
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
  },
});
