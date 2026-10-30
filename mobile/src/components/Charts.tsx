import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { colors, fonts } from '../theme';
import { Text } from './Text';

/*
 * Small SVG charts in the app's own look (rounded bars, one highlighted value, soft grid).
 * They measure their own width so they fit any screen.
 */

function useWidth() {
  const [w, setW] = useState(0);
  return { w, onLayout: (e: { nativeEvent: { layout: { width: number } } }) => setW(Math.round(e.nativeEvent.layout.width)) };
}

const GRID = 'rgba(28,29,31,0.07)';
const AXIS = colors.textDim;
const niceMax = (v: number) => {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / pow) * pow;
};

export interface Bar {
  label: string;
  value: number;
}

/** Rounded bars; the last one (today) is highlighted and its value shown on top. */
export function BarChart({ data, height = 150, color = colors.charcoal, highlight = colors.highlight, format = (n: number) => String(n) }: { data: Bar[]; height?: number; color?: string; highlight?: string; format?: (n: number) => string }) {
  const { w, onLayout } = useWidth();
  const max = niceMax(Math.max(1, ...data.map((d) => d.value)));
  const top = 22;
  const bottom = 22;
  const plotH = height - top - bottom;
  const gap = data.length > 14 ? 3 : 6;
  const barW = w ? Math.max(4, (w - gap * (data.length - 1)) / data.length) : 0;
  const every = Math.ceil(data.length / 7);
  return (
    <View onLayout={onLayout} style={{ height }}>
      {w > 0 ? (
        <Svg width={w} height={height}>
          {[0.5, 1].map((f) => (
            <Line key={f} x1={0} x2={w} y1={top + plotH * (1 - f)} y2={top + plotH * (1 - f)} stroke={GRID} strokeWidth={1} />
          ))}
          {data.map((d, i) => {
            const h = Math.max(d.value ? 4 : 0, (d.value / max) * plotH);
            const x = i * (barW + gap);
            const last = i === data.length - 1;
            return (
              <G key={d.label + i}>
                <Rect x={x} y={top + plotH - h} width={barW} height={h} rx={Math.min(8, barW / 2)} fill={last ? highlight : color} opacity={last ? 1 : 0.88} />
                {last && d.value > 0 ? (
                  <SvgText x={Math.min(w - 14, x + barW / 2)} y={top + plotH - h - 6} fontSize={11} fontFamily={fonts.bold} fill={colors.text} textAnchor="middle">
                    {format(d.value)}
                  </SvgText>
                ) : null}
                {(data.length - 1 - i) % every === 0 ? (
                  <SvgText x={i === data.length - 1 ? w : x + barW / 2} y={height - 6} fontSize={10} fontFamily={fonts.medium} fill={AXIS} textAnchor={i === data.length - 1 ? 'end' : 'middle'}>
                    {d.label}
                  </SvgText>
                ) : null}
              </G>
            );
          })}
        </Svg>
      ) : null}
    </View>
  );
}

/** Two stacked values per day (e.g. on time + late). */
export function StackedBars({ data, height = 150, a = colors.charcoal, b = colors.warning }: { data: { label: string; a: number; b: number }[]; height?: number; a?: string; b?: string }) {
  const { w, onLayout } = useWidth();
  const max = niceMax(Math.max(1, ...data.map((d) => d.a + d.b)));
  const top = 8;
  const bottom = 22;
  const plotH = height - top - bottom;
  const gap = data.length > 14 ? 3 : 6;
  const barW = w ? Math.max(4, (w - gap * (data.length - 1)) / data.length) : 0;
  const every = Math.ceil(data.length / 7);
  return (
    <View onLayout={onLayout} style={{ height }}>
      {w > 0 ? (
        <Svg width={w} height={height}>
          {[0.5, 1].map((f) => (
            <Line key={f} x1={0} x2={w} y1={top + plotH * (1 - f)} y2={top + plotH * (1 - f)} stroke={GRID} strokeWidth={1} />
          ))}
          {data.map((d, i) => {
            const ha = (d.a / max) * plotH;
            const hb = (d.b / max) * plotH;
            const x = i * (barW + gap);
            return (
              <G key={d.label + i}>
                <Rect x={x} y={top + plotH - ha} width={barW} height={ha} rx={Math.min(6, barW / 2)} fill={a} opacity={0.9} />
                {hb > 0 ? <Rect x={x} y={top + plotH - ha - hb - 2} width={barW} height={hb} rx={Math.min(6, barW / 2)} fill={b} /> : null}
                {(data.length - 1 - i) % every === 0 ? (
                  <SvgText x={i === data.length - 1 ? w : x + barW / 2} y={height - 6} fontSize={10} fontFamily={fonts.medium} fill={AXIS} textAnchor={i === data.length - 1 ? 'end' : 'middle'}>
                    {d.label}
                  </SvgText>
                ) : null}
              </G>
            );
          })}
        </Svg>
      ) : null}
    </View>
  );
}

/** Smooth line with a soft area under it. */
export function AreaChart({ data, height = 150, color = colors.navy, format = (n: number) => String(n) }: { data: Bar[]; height?: number; color?: string; format?: (n: number) => string }) {
  const { w, onLayout } = useWidth();
  const max = niceMax(Math.max(1, ...data.map((d) => d.value)));
  const top = 24;
  const bottom = 22;
  const plotH = height - top - bottom;
  const pad = 6;
  const step = data.length > 1 ? (w - pad * 2) / (data.length - 1) : 0;
  const pts = data.map((d, i) => ({ x: pad + i * step, y: top + plotH - (d.value / max) * plotH }));
  const line = pts.reduce((p, pt, i) => {
    if (i === 0) return `M ${pt.x} ${pt.y}`;
    const prev = pts[i - 1];
    const mx = (prev.x + pt.x) / 2;
    return `${p} C ${mx} ${prev.y} ${mx} ${pt.y} ${pt.x} ${pt.y}`;
  }, '');
  const area = pts.length ? `${line} L ${pts[pts.length - 1].x} ${top + plotH} L ${pts[0].x} ${top + plotH} Z` : '';
  const every = Math.ceil(data.length / 7);
  const last = pts[pts.length - 1];
  return (
    <View onLayout={onLayout} style={{ height }}>
      {w > 0 && pts.length ? (
        <Svg width={w} height={height}>
          {[0.5, 1].map((f) => (
            <Line key={f} x1={0} x2={w} y1={top + plotH * (1 - f)} y2={top + plotH * (1 - f)} stroke={GRID} strokeWidth={1} />
          ))}
          <Path d={area} fill={color} opacity={0.1} />
          <Path d={line} stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" />
          <Circle cx={last.x} cy={last.y} r={5} fill={colors.highlight} stroke={color} strokeWidth={2.5} />
          <SvgText x={Math.min(w - 20, Math.max(20, last.x))} y={Math.max(12, last.y - 12)} fontSize={11} fontFamily={fonts.bold} fill={colors.text} textAnchor="middle">
            {format(data[data.length - 1].value)}
          </SvgText>
          {data.map((d, i) =>
            (data.length - 1 - i) % every === 0 ? (
              <SvgText key={d.label + i} x={i === data.length - 1 ? w : pts[i].x} y={height - 6} fontSize={10} fontFamily={fonts.medium} fill={AXIS} textAnchor={i === data.length - 1 ? 'end' : 'middle'}>
                {d.label}
              </SvgText>
            ) : null,
          )}
        </Svg>
      ) : null}
    </View>
  );
}

/** Ring split into slices with the total in the middle. */
export function Donut({ slices, size = 140, total }: { slices: { label: string; value: number; color: string }[]; size?: number; total: string }) {
  const stroke = 22;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const sum = slices.reduce((n, s) => n + s.value, 0) || 1;
  let offset = 0;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={GRID} strokeWidth={stroke} fill="none" />
        {slices.map((s) => {
          const len = (s.value / sum) * c;
          const el = (
            <Circle
              key={s.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={s.color}
              strokeWidth={stroke}
              fill="none"
              strokeDasharray={`${Math.max(0, len - 3)} ${c - Math.max(0, len - 3)}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
          offset += len;
          return el;
        })}
      </Svg>
      <Text variant="h1" style={{ fontFamily: fonts.semibold, fontSize: 22 }}>
        {total}
      </Text>
    </View>
  );
}
