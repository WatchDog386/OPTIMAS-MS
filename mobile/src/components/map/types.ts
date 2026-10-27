import type { StyleProp, ViewStyle } from 'react-native';
import type { LatLng } from '../../api/field';

export type PinKind = 'tech' | 'job' | 'request' | 'me' | 'site';

export interface MapPin {
  id: string;
  lat: number;
  lng: number;
  kind: PinKind;
  /** Initials (technicians) or a short label shown in the pin. */
  label?: string;
  /** Pin colour; each kind has a default. */
  color?: string;
  /** Direction of travel in degrees (0 = north): shows an arrow on technicians and "me". */
  heading?: number | null;
  /** Pulsing ring: the position is live. */
  live?: boolean;
  /** Faded (e.g. offline or filtered out). */
  dim?: boolean;
  /** Highlighted (the selected pin). */
  selected?: boolean;
}

export interface MapCanvasProps {
  pins: MapPin[];
  /** Road route to draw (drawn in with an animation whenever a new route arrives). */
  route?: LatLng[] | null;
  /** Path already driven (dashed). */
  trail?: LatLng[] | null;
  /** Change this to re-frame the map around every pin and the route. */
  fitKey?: string;
  /** Keep this pin centred as it moves (until the person pans the map themselves). */
  follow?: string | null;
  /** Bumped by the caller to snap back to `follow` / re-frame after the person panned away. */
  recenterKey?: number;
  /** Extra room (px) to keep clear at the bottom / top when framing (cards drawn over the map). */
  padBottom?: number;
  padTop?: number;
  onPinPress?: (id: string) => void;
  onMapPress?: () => void;
  /** Called when the person drags the map (e.g. to show a "recentre" button). */
  onUserPan?: () => void;
  style?: StyleProp<ViewStyle>;
}
