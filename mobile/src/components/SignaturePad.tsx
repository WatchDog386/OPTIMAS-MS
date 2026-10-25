import { useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space } from '../theme';
import { Text } from './Text';

/** Signatures are normalised to this canvas so they render identically on any screen size. */
export const SIGNATURE_VIEWBOX = { width: 300, height: 150 };

interface Props {
  onChange: (path: string | null) => void;
  /** Lets the parent disable scrolling while the customer is drawing. */
  onDrawingChange?: (drawing: boolean) => void;
}

export function SignaturePad({ onChange, onDrawingChange }: Props) {
  const [path, setPath] = useState('');
  const size = useRef({ width: 1, height: 1 });
  const current = useRef('');

  const point = (x: number, y: number) => {
    const nx = (x / size.current.width) * SIGNATURE_VIEWBOX.width;
    const ny = (y / size.current.height) * SIGNATURE_VIEWBOX.height;
    return `${nx.toFixed(1)} ${ny.toFixed(1)}`;
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        onDrawingChange?.(true);
        current.current += `M${point(e.nativeEvent.locationX, e.nativeEvent.locationY)} `;
        setPath(current.current);
      },
      onPanResponderMove: (e) => {
        current.current += `L${point(e.nativeEvent.locationX, e.nativeEvent.locationY)} `;
        setPath(current.current);
      },
      onPanResponderRelease: () => {
        onDrawingChange?.(false);
        const value = current.current.trim();
        onChange(value.length > 20 ? value : null);
      },
    }),
  ).current;

  const clear = () => {
    current.current = '';
    setPath('');
    onChange(null);
  };

  const onLayout = (e: LayoutChangeEvent) => {
    size.current = { width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height };
  };

  return (
    <View style={{ gap: space.sm }}>
      <View style={styles.pad} onLayout={onLayout} {...responder.panHandlers}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${SIGNATURE_VIEWBOX.width} ${SIGNATURE_VIEWBOX.height}`}>
          <Path d={path || 'M0 0'} stroke={colors.onPrimary} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
        {!path ? (
          <View style={styles.placeholder} pointerEvents="none">
            <Ionicons name="create-outline" size={22} color="#8A93A8" />
            <Text variant="bodySm" color="#8A93A8">
              Customer signs here
            </Text>
          </View>
        ) : null}
        <View style={styles.line} pointerEvents="none" />
      </View>
      <Pressable onPress={clear} style={styles.clear} hitSlop={8}>
        <Ionicons name="refresh" size={14} color={colors.textMuted} />
        <Text variant="label" color={colors.textMuted}>
          Clear signature
        </Text>
      </Pressable>
    </View>
  );
}

/** Read-only rendering of a stored signature. */
export function SignatureView({ path }: { path: string }) {
  return (
    <View style={[styles.pad, { height: 130 }]}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${SIGNATURE_VIEWBOX.width} ${SIGNATURE_VIEWBOX.height}`}>
        <Path d={path} stroke={colors.onPrimary} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { height: 180, borderRadius: radius.lg, backgroundColor: '#F4F7FF', overflow: 'hidden' },
  placeholder: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 4 },
  line: { position: 'absolute', left: space.xl, right: space.xl, bottom: 36, height: 1, backgroundColor: '#C5CBDA' },
  clear: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-end' },
});
