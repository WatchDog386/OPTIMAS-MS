import { Children, isValidElement, useCallback, useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { Animated, Platform, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { BAR_SCROLLED_COLOR, STATUS_BAR_COLOR, setThemeColor } from '../utils/install';
import { colors, isDark, space } from '../theme';
import { GlassBackground } from './Glass';
import { NATIVE, prefersReducedMotion, spring } from '../utils/motion';
import { PageHeader } from './PageHeader';
import { ScreenHeader } from './ScreenHeader';
import { Text } from './Text';
import { useDesktop } from '../theme/desktop';
import { desk } from './desktop/DesktopShell';
import { usePageLoad } from '../store/pageLoad';

interface Props {
  children: ReactNode;
  scroll?: boolean;
  /** Ignored: there is no pull to refresh (pages keep themselves up to date). Kept so screens need no change. */
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
  // Co-op look: the dark band is always there (as on the Co-op home); light mode: it fades in on scroll
  const show = isDark ? 1 : scrollY.interpolate({ inputRange: [0, 14], outputRange: [0, 1], extrapolate: 'clamp' });
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

export function Screen({ children, scroll = true, edges = ['top'], contentStyle, footer, scrollEnabled = true, glow = true, stickyHeader }: Props) {
  const desktop = useDesktop();
  const insets = useSafeAreaInsets();
  // The page is on screen: the page-change loader can go once its data (if any) is in
  useEffect(() => usePageLoad.getState().shown(), []);
  const scrollY = useRef(new Animated.Value(0)).current;
  const items = Children.toArray(children);
  const pinned = scroll && items.length > 1 && (stickyHeader ?? isPageHeader(items[0]));
  const top = Number(StyleSheet.flatten(contentStyle)?.paddingTop ?? space.lg);
  // Phones: the page's top bar sits above the scrolling part, so it never moves (and there is no pull to
  // refresh: pages keep themselves up to date). Desktop keeps it pinned inside the page column.
  const fixedHead = pinned && !desktop;
  const body = fixedHead ? items.slice(1) : pinned ? [<StickyHead key="sticky-head" scrollY={scrollY} top={top}>{items[0]}</StickyHead>, ...items.slice(1)] : children;
  const safeTop = edges.includes('top');
  // At rest the top bar is see-through and the status bar is the page colour; scrolled, both take the
  // band colour together. Re-applied when the page comes back into view, undone when it leaves.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    if (!fixedHead) return;
    const id = scrollY.addListener(({ value }) => setScrolled((was) => (value > 14) !== was ? value > 14 : was));
    return () => scrollY.removeListener(id);
  }, [fixedHead, scrollY]);
  useFocusEffect(
    useCallback(() => {
      if (!fixedHead) return;
      setThemeColor(scrolled ? BAR_SCROLLED_COLOR : STATUS_BAR_COLOR);
      return () => setThemeColor(STATUS_BAR_COLOR);
    }, [fixedHead, scrolled]),
  );
  // Every page arrives the same way: it fades in while rising a few pixels into place
  const enter = useRef(new Animated.Value(prefersReducedMotion() ? 1 : 0)).current;
  useEffect(() => {
    if (prefersReducedMotion()) return;
    Animated.spring(enter, { toValue: 1, ...spring.settle, useNativeDriver: NATIVE }).start();
  }, [enter]);
  return (
    <View style={[styles.root, desktop && { backgroundColor: desk.page }]}>
      {glow && !desktop ? <GlassBackground /> : null}
      <Animated.View style={{ flex: 1, opacity: enter.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' }), transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>
      <SafeAreaView style={{ flex: 1 }} edges={fixedHead ? edges.filter((e) => e !== 'top') : edges}>
        {fixedHead ? (
          // The bar's background reaches up under the status bar, in the status bar's own colour
          <View style={[styles.fixedHead, { paddingTop: (safeTop ? insets.top : 0) + top }]}>
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.frost, { opacity: scrollY.interpolate({ inputRange: [0, 14], outputRange: [0, 1], extrapolate: 'clamp' }) }]} />
            {items[0]}
          </View>
        ) : null}
        {scroll ? (
          <View style={{ flex: 1 }}>
            <View style={{ flex: 1 }}>
              <ScrollView
                contentContainerStyle={[styles.content, footer ? { paddingBottom: space.xxl } : null, contentStyle, pinned ? { paddingTop: fixedHead ? space.md : 0 } : null, desktop && styles.desktop]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                scrollEnabled={scrollEnabled}
                stickyHeaderIndices={pinned && !fixedHead ? [0] : undefined}
                onScroll={pinned ? Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false }) : undefined}
                scrollEventThrottle={16}
              >
                {body}
              </ScrollView>
            </View>
          </View>
        ) : (
          <View style={[styles.content, { flex: 1 }, contentStyle]}>{children}</View>
        )}
        {footer ? (
          <View style={[styles.footer, desktop && styles.desktopFooter]}>
            {desktop ? <View style={{ width: '100%', maxWidth: 460, alignSelf: 'flex-end' }}>{footer}</View> : footer}
          </View>
        ) : null}
      </SafeAreaView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgBottom },
  // Desktop: the Business-SME page — light grey, roomier margins, nothing hidden behind a tab bar
  desktop: { paddingHorizontal: 32, paddingTop: 28, paddingBottom: 48, width: '100%', maxWidth: 1320, alignSelf: 'center' },
  desktopFooter: { paddingHorizontal: 32, backgroundColor: desk.bar, borderTopColor: desk.border },
  content: {
    padding: space.lg,
    paddingBottom: TAB_BAR_CLEARANCE,
    gap: space.lg,
  },
  // Full width (cancels the page's side padding) so the frosted layer reaches both edges; the small
  // vertical padding is given back as negative margin so spacing is unchanged while not scrolled
  fixedHead: { paddingHorizontal: space.lg, paddingBottom: 10, zIndex: 10 },
  sticky: { marginHorizontal: -space.lg, paddingHorizontal: space.lg, paddingBottom: 10, marginBottom: -10, zIndex: 10 },
  // Co-op look: solid, exactly the status bar's colour, so the two read as one band
  // One solid band with the phone's status bar, at rest and while scrolling
  frost: { backgroundColor: BAR_SCROLLED_COLOR, borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(28,29,31,0.06)', shadowColor: '#1C1D1F', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  footer: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    backgroundColor: isDark ? 'rgba(26,27,30,0.92)' : 'rgba(255,255,255,0.72)',
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
  },
});
