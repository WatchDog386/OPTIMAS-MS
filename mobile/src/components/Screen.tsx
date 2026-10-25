import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors, gradients, space } from '../theme';

interface Props {
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  edges?: Edge[];
  contentStyle?: ViewStyle;
  footer?: ReactNode;
  scrollEnabled?: boolean;
  /** Soft sky glow behind the header and the bottom bar (Business-SME look). */
  glow?: boolean;
}

/** Space reserved at the bottom so content clears the floating tab bar. */
export const TAB_BAR_CLEARANCE = 112;

export function Screen({ children, scroll = true, refreshing, onRefresh, edges = ['top'], contentStyle, footer, scrollEnabled = true, glow = true }: Props) {
  return (
    <View style={styles.root}>
      {glow ? (
        <>
          <LinearGradient pointerEvents="none" colors={gradients.glowTop} locations={[0, 0.45, 1]} style={styles.glowTop} />
          <LinearGradient pointerEvents="none" colors={gradients.glowBottom} locations={[0, 0.55, 1]} style={styles.glowBottom} />
        </>
      ) : null}
      <SafeAreaView style={{ flex: 1 }} edges={edges}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={[styles.content, footer ? { paddingBottom: space.xxl } : null, contentStyle]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={scrollEnabled}
            refreshControl={
              onRefresh ? (
                <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
              ) : undefined
            }
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.content, { flex: 1 }, contentStyle]}>{children}</View>
        )}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  glowTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 380 },
  glowBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 240 },
  content: { padding: space.lg, paddingBottom: TAB_BAR_CLEARANCE, gap: space.lg },
  footer: { paddingHorizontal: space.lg, paddingVertical: space.md, backgroundColor: 'rgba(255,255,255,0.92)', borderTopWidth: 1, borderTopColor: colors.border },
});
