import { useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

/*
 * The "notched" card shape: a rounded card whose top edge has a small centre bite holding a chevron tab.
 * Only the shape — whatever goes inside is up to the screen. Used for the admin dashboard's
 * "Jobs done this week" and "Attendance today".
 */

const RADIUS = 28;
const BITE_HALF = 34;
const BITE_DEPTH = 17;

/** Rounded rectangle with a smooth bite out of the middle of the top edge. */
function notchedTopPath(w: number, h: number) {
  const cx = w / 2;
  const left = cx - BITE_HALF;
  const right = cx + BITE_HALF;
  const a = BITE_HALF * 0.55;
  const b = BITE_HALF * 0.62;
  const r = RADIUS;
  return [
    `M ${r} 0`,
    `H ${left}`,
    `C ${cx - a} 0 ${cx - b} ${BITE_DEPTH} ${cx} ${BITE_DEPTH}`,
    `C ${cx + b} ${BITE_DEPTH} ${cx + a} 0 ${right} 0`,
    `H ${w - r}`,
    `A ${r} ${r} 0 0 1 ${w} ${r}`,
    `V ${h - r}`,
    `A ${r} ${r} 0 0 1 ${w - r} ${h}`,
    `H ${r}`,
    `A ${r} ${r} 0 0 1 0 ${h - r}`,
    `V ${r}`,
    `A ${r} ${r} 0 0 1 ${r} 0`,
    'Z',
  ].join(' ');
}

/** The card shape itself; `onTab` makes the chevron in the bite tappable. */
export function NotchCard({ children, style, onTab, tabLabel = 'Open' }: { children: ReactNode; style?: StyleProp<ViewStyle>; onTab?: () => void; tabLabel?: string }) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  return (
    <View style={[styles.card, style]} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {box.w > 0 ? (
        <Svg width={box.w} height={box.h} style={StyleSheet.absoluteFill}>
          <Path d={notchedTopPath(box.w, box.h)} fill="#FFFFFF" stroke="rgba(28,29,31,0.07)" strokeWidth={1} />
        </Svg>
      ) : null}
      <Pressable onPress={onTab} disabled={!onTab} hitSlop={8} accessibilityRole="button" accessibilityLabel={tabLabel} style={styles.tab}>
        <Ionicons name="chevron-up" size={15} color={colors.textMuted} />
      </Pressable>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    // Web only: a soft shadow that follows the notched outline (box-shadow would stay rectangular)
    ...(Platform.OS === 'web' ? ({ filter: 'drop-shadow(0px 10px 16px rgba(28,29,31,0.09))' } as ViewStyle) : null),
  },
  tab: { position: 'absolute', top: 0, left: '50%', width: 40, height: 22, marginLeft: -20, alignItems: 'center', justifyContent: 'center', zIndex: 3 },
  body: { padding: 20, paddingTop: 30 },
});
