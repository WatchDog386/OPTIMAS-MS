import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import L from 'leaflet';
import { colors } from '../../theme';
import { prefersReducedMotion } from '../../utils/motion';
import type { LatLng } from '../../api/field';
import type { MapCanvasProps, MapPin } from './types';

/**
 * Interactive street map for the web app (Leaflet + OpenStreetMap tiles). Pins glide to new positions,
 * technicians show which way they are heading, live ones pulse, and a new route is drawn in.
 *
 * The tile server can be changed at build time with EXPO_PUBLIC_MAP_TILE_URL (and _ATTRIBUTION).
 */

const TILE_URL = process.env.EXPO_PUBLIC_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = process.env.EXPO_PUBLIC_MAP_TILE_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const NAIROBI: LatLng = [-1.2864, 36.8172];
const GLIDE_MS = 1100;

const DEFAULT_COLOR: Record<MapPin['kind'], string> = {
  tech: colors.navy,
  job: colors.primary,
  request: '#B98A00',
  me: '#1A73E8',
  site: colors.navy,
};

/** Stylesheet for Leaflet itself (copied into /public at build) plus our pins, injected once. */
function ensureStyles() {
  if (document.getElementById('om-map-css')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/leaflet.css';
  document.head.appendChild(link);
  const style = document.createElement('style');
  style.id = 'om-map-css';
  style.textContent = `
  .om-map .leaflet-container{font-family:inherit;background:#E9ECEA}
  .om-map .leaflet-tile-pane{filter:saturate(.55) contrast(.96) brightness(1.04)}
  .om-map .leaflet-control-attribution{font-size:9px;background:rgba(255,255,255,.7);border-radius:6px 0 0 0}
  .om-pin{background:none;border:none}
  .om-in{animation:om-drop .55s cubic-bezier(.2,1.4,.4,1) both}
  @keyframes om-drop{from{transform:translateY(-14px) scale(.4);opacity:0}to{transform:none;opacity:1}}
  .om-tech{position:relative;width:40px;height:40px}
  .om-tech .om-dot{position:absolute;inset:4px;border-radius:50%;background:var(--c);color:#fff;font:700 11px/32px Figtree,system-ui,sans-serif;text-align:center;border:2.5px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,.25)}
  .om-tech .om-head{position:absolute;inset:-7px;transition:transform .6s ease}
  .om-tech .om-head:before{content:"";position:absolute;left:50%;top:0;margin-left:-6px;border:6px solid transparent;border-bottom:9px solid var(--c);border-top:0}
  .om-ring{position:absolute;inset:0;border-radius:50%;background:var(--c);opacity:.0}
  .om-live .om-ring{animation:om-pulse 2s ease-out infinite}
  @keyframes om-pulse{0%{transform:scale(.6);opacity:.45}100%{transform:scale(1.9);opacity:0}}
  .om-dim{opacity:.45;filter:grayscale(1)}
  .om-sel .om-dot,.om-sel .om-drop-pin{box-shadow:0 0 0 4px rgba(236,242,58,.95),0 6px 16px rgba(0,0,0,.3)}
  .om-drop-pin{width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:var(--c);border:2.5px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center}
  .om-drop-pin span{transform:rotate(45deg);color:#fff;font:800 12px Figtree,system-ui,sans-serif}
  .om-me{position:relative;width:26px;height:26px}
  .om-me .om-core{position:absolute;inset:6px;border-radius:50%;background:var(--c);border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3)}
  .om-me .om-ring{background:var(--c)}
  .om-me .om-cone{position:absolute;left:50%;top:50%;width:0;height:0;transition:transform .6s ease}
  .om-me .om-cone:before{content:"";position:absolute;left:-14px;top:-34px;border:14px solid transparent;border-bottom:26px solid var(--c);border-top:0;opacity:.28}
  .om-route{transition:stroke-dashoffset 1.3s cubic-bezier(.4,0,.2,1)}
  `;
  document.head.appendChild(style);
}

function pinHtml(p: MapPin) {
  const c = p.color ?? DEFAULT_COLOR[p.kind];
  const cls = `${p.live ? 'om-live ' : ''}${p.dim ? 'om-dim ' : ''}${p.selected ? 'om-sel ' : ''}`;
  const rot = p.heading == null ? '' : `transform:rotate(${Math.round(p.heading)}deg)`;
  const label = (p.label ?? '').replace(/[<>&"]/g, '');
  switch (p.kind) {
    case 'tech':
      return { size: 40, anchor: [20, 20], html: `<div class="om-in"><div class="om-tech ${cls}" style="--c:${c}"><div class="om-ring"></div>${p.heading == null ? '' : `<div class="om-head" style="${rot}"></div>`}<div class="om-dot">${label}</div></div></div>` };
    case 'me':
      return { size: 26, anchor: [13, 13], html: `<div class="om-in"><div class="om-me om-live ${cls}" style="--c:${c}"><div class="om-ring"></div>${p.heading == null ? '' : `<div class="om-cone" style="${rot}"></div>`}<div class="om-core"></div></div></div>` };
    default: {
      const glyph = p.kind === 'request' ? '!' : p.kind === 'site' ? '⌂' : label || '•';
      return { size: 30, anchor: [15, 34], html: `<div class="om-in"><div class="${cls}" style="--c:${c}"><div class="om-drop-pin"><span>${glyph}</span></div></div></div>` };
    }
  }
}

const sig = (p: MapPin) => [p.kind, p.label, p.color, p.live, p.dim, p.selected, p.heading == null].join('|');
const ease = (t: number) => 1 - (1 - t) ** 3;

interface Live {
  marker: L.Marker;
  sig: string;
  anim?: number;
}

export function MapCanvas({ pins, route, trail, fitKey, follow, recenterKey, padBottom = 0, padTop = 0, onPinPress, onMapPress, onUserPan, style }: MapCanvasProps) {
  // On the web a View's ref is its DOM element, which is what Leaflet draws into
  const host = useRef<HTMLElement | null>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef(new Map<string, Live>());
  const routeLayers = useRef<{ casing: L.Polyline; line: L.Polyline; key: string } | null>(null);
  const trailLayer = useRef<L.Polyline | null>(null);
  const userPanned = useRef(false);
  const cb = useRef({ onPinPress, onMapPress, onUserPan });
  cb.current = { onPinPress, onMapPress, onUserPan };
  const [ready, setReady] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;

  // Create the map once
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    ensureStyles();
    el.classList.add('om-map');
    const m = L.map(el, { zoomControl: false, attributionControl: true, center: NAIROBI, zoom: 12, zoomSnap: 0.25, fadeAnimation: true });
    L.tileLayer(TILE_URL, { maxZoom: 19, attribution: TILE_ATTRIBUTION }).addTo(m);
    m.attributionControl.setPrefix(false);
    m.on('click', () => cb.current.onMapPress?.());
    m.on('dragstart', () => {
      userPanned.current = true;
      cb.current.onUserPan?.();
    });
    map.current = m;
    // Leaflet must be told when its box changes size (rotation, panels opening)
    const ro = new ResizeObserver(() => m.invalidateSize({ pan: false }));
    ro.observe(el);
    setReady(true);
    Animated.timing(fade, { toValue: 1, duration: 450, useNativeDriver: false }).start();
    const live = markers.current;
    return () => {
      ro.disconnect();
      live.forEach((x) => x.anim && cancelAnimationFrame(x.anim));
      live.clear();
      m.remove();
      map.current = null;
    };
  }, [fade]);

  // Pins: add new ones, glide moved ones, drop removed ones
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    const live = markers.current;
    const seen = new Set<string>();
    for (const p of pins) {
      seen.add(p.id);
      const to = L.latLng(p.lat, p.lng);
      const existing = live.get(p.id);
      const s = sig(p);
      if (!existing) {
        const icon = pinHtml(p);
        const marker = L.marker(to, {
          icon: L.divIcon({ className: 'om-pin', html: icon.html, iconSize: [icon.size, icon.size], iconAnchor: icon.anchor as L.PointTuple }),
          zIndexOffset: p.kind === 'me' ? 1000 : p.kind === 'tech' ? 500 : 0,
          keyboard: false,
        }).addTo(m);
        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          cb.current.onPinPress?.(p.id);
        });
        live.set(p.id, { marker, sig: s });
        continue;
      }
      if (existing.sig !== s) {
        const icon = pinHtml(p);
        // Same look but a different heading: just turn the arrow (keeps the glide smooth)
        existing.marker.setIcon(L.divIcon({ className: 'om-pin', html: icon.html.replace('om-in', ''), iconSize: [icon.size, icon.size], iconAnchor: icon.anchor as L.PointTuple }));
        existing.sig = s;
      } else if (p.heading != null) {
        const arrow = existing.marker.getElement()?.querySelector<HTMLElement>('.om-head, .om-cone');
        if (arrow) arrow.style.transform = `rotate(${Math.round(p.heading)}deg)`;
      }
      const from = existing.marker.getLatLng();
      if (from.distanceTo(to) < 0.5) continue;
      if (existing.anim) cancelAnimationFrame(existing.anim);
      if (prefersReducedMotion() || from.distanceTo(to) > 20_000) {
        existing.marker.setLatLng(to);
        continue;
      }
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / GLIDE_MS);
        const k = ease(t);
        existing.marker.setLatLng([from.lat + (to.lat - from.lat) * k, from.lng + (to.lng - from.lng) * k]);
        if (t < 1) existing.anim = requestAnimationFrame(step);
        else existing.anim = undefined;
      };
      existing.anim = requestAnimationFrame(step);
    }
    for (const [id, x] of live) {
      if (seen.has(id)) continue;
      if (x.anim) cancelAnimationFrame(x.anim);
      x.marker.remove();
      live.delete(id);
    }
    // Keep the followed pin in view (unless the person is looking elsewhere)
    if (follow && !userPanned.current) {
      const p = pins.find((x) => x.id === follow);
      if (p) m.panTo([p.lat, p.lng], { animate: true, duration: 0.9 });
    }
  }, [pins, ready, follow]);

  // Trail (dashed) and route (drawn in)
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    if (trail && trail.length > 1) {
      if (trailLayer.current) trailLayer.current.setLatLngs(trail);
      else trailLayer.current = L.polyline(trail, { color: colors.navy, weight: 4, opacity: 0.45, dashArray: '2 8', lineCap: 'round' }).addTo(m);
    } else if (trailLayer.current) {
      trailLayer.current.remove();
      trailLayer.current = null;
    }
  }, [trail, ready]);

  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    if (!route || route.length < 2) {
      routeLayers.current?.casing.remove();
      routeLayers.current?.line.remove();
      routeLayers.current = null;
      return;
    }
    // A route to a new place is drawn in; a refreshed route to the same place just updates
    const key = route[route.length - 1].map((n) => n.toFixed(4)).join(',');
    if (routeLayers.current && routeLayers.current.key === key) {
      routeLayers.current.casing.setLatLngs(route);
      routeLayers.current.line.setLatLngs(route);
      return;
    }
    routeLayers.current?.casing.remove();
    routeLayers.current?.line.remove();
    const casing = L.polyline(route, { color: '#FFFFFF', weight: 11, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }).addTo(m);
    const line = L.polyline(route, { color: colors.navy, weight: 6, opacity: 0.95, lineCap: 'round', lineJoin: 'round', className: 'om-route' }).addTo(m);
    routeLayers.current = { casing, line, key };
    const path = line.getElement() as SVGPathElement | undefined;
    if (path && !prefersReducedMotion()) {
      const len = path.getTotalLength();
      path.style.transition = 'none';
      path.style.strokeDasharray = `${len}`;
      path.style.strokeDashoffset = `${len}`;
      path.getBoundingClientRect();
      path.style.transition = '';
      path.style.strokeDashoffset = '0';
      // Leaflet redraws the path on zoom; drop the dash once drawn so it never looks cut off
      setTimeout(() => {
        path.style.strokeDasharray = '';
        path.style.strokeDashoffset = '';
      }, 1400);
    }
  }, [route, ready]);

  // Frame every pin and the route (first data, or whenever the caller changes fitKey)
  const frame = useRef(() => {});
  frame.current = () => {
    const m = map.current;
    if (!m) return;
    const pts: LatLng[] = [...pins.map((p) => [p.lat, p.lng] as LatLng), ...(route ?? [])];
    if (!pts.length) return;
    userPanned.current = false;
    if (pts.length === 1) m.flyTo(pts[0], 15, { duration: 0.8 });
    else m.flyToBounds(L.latLngBounds(pts), { paddingTopLeft: L.point(40, 40 + padTop), paddingBottomRight: L.point(40, 40 + padBottom), maxZoom: 16, duration: 0.8 });
  };
  useEffect(() => {
    if (ready) frame.current();
  }, [fitKey, ready]);

  // The recentre button: back to the followed pin, or the whole picture
  useEffect(() => {
    if (!recenterKey || !map.current) return;
    const p = follow ? pins.find((x) => x.id === follow) : null;
    userPanned.current = false;
    if (p) map.current.flyTo([p.lat, p.lng], Math.max(map.current.getZoom(), 16), { duration: 0.8 });
    else frame.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the button is pressed
  }, [recenterKey]);

  return (
    <Animated.View style={[styles.box, style, { opacity: fade }]}>
      <View ref={host as never} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, overflow: 'hidden', backgroundColor: '#E9ECEA' },
});
