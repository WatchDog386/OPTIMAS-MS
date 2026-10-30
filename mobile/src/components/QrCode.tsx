import { useMemo } from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
import qrcode from 'qrcode-generator';

/** A QR code drawn as one SVG path (crisp at any size, prints sharply). */
export function QrCode({ value, size = 96, color = '#000000' }: { value: string; size?: number; color?: string }) {
  const { d, n } = useMemo(() => {
    const q = qrcode(0, 'M');
    q.addData(value);
    q.make();
    const count = q.getModuleCount();
    let path = '';
    for (let r = 0; r < count; r += 1) for (let c = 0; c < count; c += 1) if (q.isDark(r, c)) path += `M${c + 2} ${r + 2}h1v1h-1z`;
    return { d: path, n: count + 4 };
  }, [value]);
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${n} ${n}`} accessibilityLabel="QR code">
      <Rect width={n} height={n} fill="#FFFFFF" />
      <Path d={d} fill={color} />
    </Svg>
  );
}
