import { Children, isValidElement, useEffect, useRef, type ReactElement, type ReactNode } from 'react';
import { Animated, Platform, RefreshControl, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors, space } from '../theme';
import { GlassBackground } from './Glass';
import { usePullToRefresh } from './PullToRefresh';
import { NATIVE, prefersReducedMotion, spring } from '../utils/motion';
import { PageHeader } from './PageHeader';
import { ScreenHeader } from './ScreenHeader';
import { Text } from './Text';

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
  /**
   * Pin the first child at the top while the rest scrolls. On by default when the page starts with a
   * <ScreenHeader> or a big <Text variant="h1"> title; pass true for other headers (the dashboard bar).
   */
  stickyHeader?: boolean;
}

/** Is this the page's title row (so it should stay put while the page scrolls)? */
function isPageHeader(node: ReactNode) {
  if (!isValidElement(node)) return false;
  if (node.type === ScreenHeader || node.type === PageHeader) return true;
  return node.type === Text && (node as ReactElement<{ variant?: string }>).props.variant === 'h1';
}

const FROST = Platform.OS === 'web' ? ({ backdropFilter: 'saturate(160%) blur(14px)', WebkitBackdropFilter: 'saturate(160%) blur(14px)' } as unknown as ViewStyle) : null;

/**
 * The pinned header. At the top of the page it has no background at all (it is part of the page); once
 * content slides under it, a frosted layer and a hairline fade in so the two stay readable.
 */
function StickyHead({ children, scrollY, top }: { children: ReactNode; scrollY: Animated.Value; top: number }) {
  const show = scrollY.interpolate({ inputRange: [0, 14], outputRange: [0, 1], extrapolate: 'clamp' });
  return (
    // The page's top padding moves inside the header, so a pinned title keeps its breathing room
    <View style={[styles.sticky, { paddingTop: top }]}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.frost, FROST, { opacity: show }]} />
      {children}
    </View>
  );
}

/** Space reserved at the bottom so content clears the floating tab bar. */
export const TAB_BAR_CLEARANCE = 112;

export function Screen({ children, scroll = true, refreshing, onRefresh, edges = ['top'], contentStyle, footer, scrollEnabled = true, glow = true, stickyHeader }: Props) {
  const ptr = usePullToRefresh(onRefresh, refreshing);
  const scrollY = useRef(new Animated.Value(0)).current;
  const items = Children.toArray(children);
  const pinned = scroll && items.length > 1 && (stickyHeader ?? isPageHeader(items[0]));
  const top = Number(StyleSheet.flatten(contentStyle)?.paddingTop ?? space.lg);
  const body = pinned ? [<StickyHead key="sticky-head" scrollY={scrollY} top={top}>{items[0]}</StickyHead>, ...items.slice(1)] : children;
  // Every page arrives the same way: it fades in while rising a few pixels into place
  const enter = useRef(new Animated.Value(prefersReducedMotion() ? 1 : 0)).current;
  useEffect(() => {
    if (prefersReducedMotion()) return;
    Animated.spring(enter, { toValue: 1, ...spring.settle, useNativeDriver: NATIVE }).start();
  }, [enter]);
  return (
    <View style={styles.root}>
      {glow ? <GlassBackground /> : null}
      <Animated.View style={{ flex: 1, opacity: enter.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }), transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>
      <SafeAreaView style={{ flex: 1 }} edges={edges}>
        {scroll ? (
          <View style={{ flex: 1 }}>
            {ptr.indicator}
            <Animated.View style={ptr.style ?? { flex: 1 }}>
              <ScrollView
                ref={ptr.scrollRef}
                contentContainerStyle={[styles.content, footer ? { paddingBottom: space.xxl } : null, contentStyle, pinned ? { paddingTop: 0 } : null]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                scrollEnabled={scrollEnabled}
                stickyHeaderIndices={pinned ? [0] : undefined}
                onScroll={pinned ? Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false }) : undefined}
                scrollEventThrottle={16}
                refreshControl={onRefresh && !ptr.enabled ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} /> : undefined}
              >
                {body}
              </ScrollView>
            </Animated.View>
          </View>
        ) : (
          <View style={[styles.content, { flex: 1 }, contentStyle]}>{children}</View>
        )}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </SafeAreaView>
      </Animated.View>
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
  // Full width (cancels the page's side padding) so the frosted layer reaches both edges; the small
  // vertical padding is given back as negative margin so spacing is unchanged while not scrolled
  sticky: { marginHorizontal: -space.lg, paddingHorizontal: space.lg, paddingBottom: 10, marginBottom: -10, zIndex: 10 },
  frost: { backgroundColor: 'rgba(240,240,240,0.86)', borderBottomWidth: 1, borderBottomColor: 'rgba(28,29,31,0.06)', shadowColor: '#1C1D1F', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  footer: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
  },
});
