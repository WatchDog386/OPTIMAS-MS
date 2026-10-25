import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { colors, space } from '../theme';

/** Swipeable row of hero cards (86% width, snapping) with page dots. */
export function CardCarousel({ children }: { children: ReactNode[] }) {
  const { width } = useWindowDimensions();
  const cardW = Math.min(width, 480) * 0.86;
  const step = cardW + space.md;
  const [index, setIndex] = useState(0);
  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate="fast"
        contentContainerStyle={{ gap: space.md, paddingHorizontal: space.lg }}
        style={{ marginHorizontal: -space.lg }}
        onScroll={(e) => setIndex(Math.min(children.length - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.x / step))))}
        scrollEventThrottle={32}
      >
        {children.map((c, i) => (
          <View key={i} style={{ width: cardW }}>
            {c}
          </View>
        ))}
      </ScrollView>
      <View style={styles.dots}>
        {children.map((_, i) => (
          <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: space.md },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(170,182,176,0.4)' },
  dotActive: { width: 24, backgroundColor: colors.accent },
});
