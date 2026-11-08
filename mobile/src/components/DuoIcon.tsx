import type { ReactNode } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import Ionicons from '@expo/vector-icons/Ionicons';

/**
 * Two-tone line icons as in Optimas-SME's Quick Actions: a green outline with one red detail, drawn on a
 * 24px grid with rounded 1.9px strokes. Keyed by the Ionicons name the screens already use; any other
 * name falls back to that Ionicon in green.
 */
export const DUO_RED = '#E23B41';

type IconName = keyof typeof Ionicons.glyphMap;
type Draw = (red: string) => ReactNode;

const BOX = (
  <>
    <Path d="M3 9l7-3.5L17 9v8l-7 3.5L3 17z" />
    <Path d="M3 9l7 3.5L17 9M10 12.5v8" />
  </>
);

const DRAW: Partial<Record<IconName, Draw>> = {
  // New job: briefcase with a red plus
  'add-circle-outline': (r) => (
    <>
      <Rect x={3} y={7} width={18} height={13} rx={2} />
      <Path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
      <Path d="M12 10.5v6M9 13.5h6" stroke={r} />
    </>
  ),
  // Requests: speech bubbles, the back one red
  'chatbubbles-outline': (r) => (
    <>
      <Path d="M4 4h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8.5L5 17v-3H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
      <Path d="M18.5 8.5H20a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-1v3l-3.5-3H11a2 2 0 0 1-2-2" stroke={r} />
    </>
  ),
  // People: two people, the second red
  'people-outline': (r) => (
    <>
      <Circle cx={9} cy={8} r={3.5} />
      <Path d="M3 20a6 6 0 0 1 12 0" />
      <Path d="M15.5 4.7a3.5 3.5 0 0 1 0 6.6M21 20a6 6 0 0 0-3.6-5.5" stroke={r} />
    </>
  ),
  // Teams: three people, the outer two red
  'people-circle-outline': (r) => (
    <>
      <Circle cx={12} cy={8} r={3} />
      <Path d="M7 20a5 5 0 0 1 10 0" />
      <Path d="M5.5 9.5a2.2 2.2 0 1 0 0-.01M18.5 9.5a2.2 2.2 0 1 0 0-.01M2 18a3.8 3.8 0 0 1 4-3.5M22 18a3.8 3.8 0 0 0-4-3.5" stroke={r} />
    </>
  ),
  // Issue stock: a box with a red arrow going out
  'arrow-up-circle-outline': (r) => (
    <>
      {BOX}
      <Path d="M20.5 11V3.5M18 6l2.5-2.5L23 6" stroke={r} />
    </>
  ),
  // Receive: a box with a red arrow coming in
  'download-outline': (r) => (
    <>
      {BOX}
      <Path d="M20.5 3.5V11M18 8.5l2.5 2.5L23 8.5" stroke={r} />
    </>
  ),
  // Returns: a box with a red arrow coming back
  'arrow-down-circle-outline': (r) => (
    <>
      {BOX}
      <Path d="M23 7h-6M19.5 4.5L17 7l2.5 2.5" stroke={r} />
    </>
  ),
  // Catalogue: a price tag with a red hole
  'pricetags-outline': (r) => (
    <>
      <Path d="M12.6 3H5a2 2 0 0 0-2 2v7.6l9.2 9.2a1.5 1.5 0 0 0 2.1 0l7.5-7.5a1.5 1.5 0 0 0 0-2.1z" />
      <Circle cx={8} cy={8} r={1.7} stroke={r} />
    </>
  ),
  // Reconcile: arrows both ways, the returning one red
  'git-compare-outline': (r) => (
    <>
      <Path d="M4 8h14M15 5l3 3-3 3" />
      <Path d="M20 16H6M9 13l-3 3 3 3" stroke={r} />
    </>
  ),
  'swap-horizontal-outline': (r) => (
    <>
      <Path d="M4 8h14M15 5l3 3-3 3" />
      <Path d="M20 16H6M9 13l-3 3 3 3" stroke={r} />
    </>
  ),
  // Reports: a page with red lines
  'document-text-outline': (r) => (
    <>
      <Path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <Path d="M14 3v5h5" />
      <Path d="M9 13h6M9 17h4" stroke={r} />
    </>
  ),
  // Check in: a scan frame with a red line
  'scan-outline': (r) => (
    <>
      <Path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
      <Path d="M4 12h16" stroke={r} />
    </>
  ),
  // Check out: a door with a red arrow out
  'log-out-outline': (r) => (
    <>
      <Path d="M10 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4" />
      <Path d="M15 8l4 4-4 4M19 12H9" stroke={r} />
    </>
  ),
  // My jobs: a briefcase with a red handle
  'briefcase-outline': (r) => (
    <>
      <Rect x={3} y={7} width={18} height={13} rx={2} />
      <Path d="M3 13h18" />
      <Path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" stroke={r} />
    </>
  ),
  // My stock: a box with a red edge
  'cube-outline': (r) => (
    <>
      <Path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" />
      <Path d="M12 12v9M4 7.5l8 4.5" />
      <Path d="M20 7.5L12 12" stroke={r} />
    </>
  ),
  // Onboard customer: a person with a red plus
  'person-add-outline': (r) => (
    <>
      <Circle cx={9} cy={8} r={3.5} />
      <Path d="M3 20a6 6 0 0 1 12 0" />
      <Path d="M18.5 9v6M15.5 12h6" stroke={r} />
    </>
  ),
  // Messages / chat: a bubble with red dots
  'chatbubble-ellipses-outline': (r) => (
    <>
      <Path d="M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-8l-5 4v-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
      <Path d="M8 10.5h.01M12 10.5h.01M16 10.5h.01" stroke={r} strokeWidth={2.8} />
    </>
  ),
  // Search: a lens with a red handle
  'search-outline': (r) => (
    <>
      <Circle cx={10.5} cy={10.5} r={6.5} />
      <Path d="M20 20l-4.6-4.6" stroke={r} />
    </>
  ),
  // Report a fault: a wrench with a red spark
  'construct-outline': (r) => (
    <>
      <Path d="M14.7 6.3a4 4 0 0 0-5.4 5.4l-5.8 5.8a1.8 1.8 0 0 0 2.5 2.5l5.8-5.8a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z" />
      <Path d="M19.5 2.5v3M18 4h3" stroke={r} />
    </>
  ),
  // Call us: a phone with red waves
  'call-outline': (r) => (
    <>
      <Path d="M5 4h3l1.5 4-2 1.5a11 11 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
      <Path d="M15 3.5a6 6 0 0 1 5.5 5.5M15 7a2.5 2.5 0 0 1 2 2" stroke={r} />
    </>
  ),
  // Approvals: a circle with a red tick
  'checkmark-done-circle-outline': (r) => (
    <>
      <Circle cx={12} cy={12} r={9} />
      <Path d="M8 12.5l2.7 2.7L16 10" stroke={r} />
    </>
  ),
  // Activity: a clock with red hands
  'time-outline': (r) => (
    <>
      <Circle cx={12} cy={12} r={9} />
      <Path d="M12 7v5l3 2" stroke={r} />
    </>
  ),
  // Leaderboard: a cup on a red stand
  'trophy-outline': (r) => (
    <>
      <Path d="M8 4h8v5a4 4 0 0 1-8 0z" />
      <Path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4" />
      <Path d="M8.5 20h7M10 17h4" stroke={r} />
    </>
  ),
  // Live map: a folded map, one fold red
  'map-outline': (r) => (
    <>
      <Path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z" />
      <Path d="M9 4v14" />
      <Path d="M15 6v14" stroke={r} />
    </>
  ),
  // Charts: bars, the last one red
  'bar-chart-outline': (r) => (
    <>
      <Path d="M4 20h16M7 16v-4M12 16V7" />
      <Path d="M17 16v-6" stroke={r} />
    </>
  ),
  // Ratings: a star with a red sparkle
  'star-outline': (r) => (
    <>
      <Path d="M11 4.5l2.4 4.9 5.4.8-3.9 3.8.9 5.4L11 16.9l-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z" />
      <Path d="M20 2.5v3M18.5 4h3" stroke={r} />
    </>
  ),
};

/** True when there is a two-tone drawing for this icon. */
export const hasDuo = (name: IconName) => !!DRAW[name];

export function DuoIcon({ name, size = 28, color }: { name: IconName; size?: number; color: string }) {
  const draw = DRAW[name];
  if (!draw) return <Ionicons name={name} size={size - 4} color={color} />;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      {draw(DUO_RED)}
    </Svg>
  );
}
