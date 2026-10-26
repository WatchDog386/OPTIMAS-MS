import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  LinearGradient as SvgGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";
import { api, ApiError } from "../../src/api/client";
import type { User } from "../../src/api/types";
import { Button, InstallButton, Input, Text } from "../../src/components";
import { afterLogin, useAuth } from "../../src/store/auth";
import { colors, fonts, gradients, radius, space } from "../../src/theme";

/** Editorial onboarding slides, one per audience. */
const SLIDES = [
  {
    tag: "For technicians",
    title: "Check in.\nGet to work.",
    kicker: "Live selfie · GPS · shift timer",
    body: "Start the day with a dress-code photo, then work through your jobs with before-and-after proof.",
    icon: "scan-outline" as const,
    chip: "Camera-only proof",
  },
  {
    tag: "For supervisors",
    title: "Every router\naccounted for",
    kicker: "Jobs · stock · attendance",
    body: "Assign work, verify proof photos and see where every serialised device is right now.",
    icon: "wifi" as const,
    chip: "Serial-level custody",
  },
  {
    tag: "For customers",
    title: "Track your\ntechnician",
    kicker: "Requests · visits · support",
    body: "Report a fault, follow the visit live and see what was installed at your premises.",
    icon: "home-outline" as const,
    chip: "Live visit updates",
  },
];

const ACCENT = "#2DA043";
const MAX_W = 480;
const VERTEX_X = 0.6; // horizontal position of the panel's rounded bottom corner

export default function Login() {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const W = Math.min(winW, MAX_W);
  const heroH = Math.round(Math.max(220, Math.min(winH * 0.34, 340)));
  const heroTotal = heroH + insets.top;
  const vx = W * VERTEX_X; // centre line of the dark panel's V
  const badgeTop = insets.top + Math.max(58, heroH * 0.2);
  const chipTop = badgeTop + 118;
  // The V narrows towards its tip: only show the caption where it fits inside the dark area
  const showChip = chipTop + 30 <= heroTotal - 82;

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;

  // Rotate slides until the person starts typing.
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setSlide((s) => (s + 1) % SLIDES.length), 5000);
    return () => clearInterval(t);
  }, [paused]);

  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [slide, fade]);

  const submit = async () => {
    if (!identifier.trim() || !password) {
      setError("Enter your staff or account number and your password.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { token, user } = await api<{ token: string; user: User }>(
        "/auth/login",
        { body: { identifier: identifier.trim(), password } },
      );
      await useAuth.getState().setSession(token, user);
      router.replace(afterLogin(user) as never);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Unable to sign in");
    } finally {
      setLoading(false);
    }
  };

  const help = () => {
    const msg =
      "Staff: sign in with your staff number (e.g. OPT-TEC-001).\nCustomers: use your Optimas account number.\n\nForgot your password? Ask your supervisor or call Optimas support.";
    if (Platform.OS === "web") window.alert(msg);
    else Alert.alert("Signing in", msg);
  };

  const s = SLIDES[slide];
  const rise = fade.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[colors.bgTop, "#FFFFFF"]}
        locations={[0, 0.6]}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { minHeight: winH }]}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.column, { width: W }]}>
            {/* ── Art panel ── */}
            <View style={{ height: heroTotal }}>
              <HeroArt width={W} height={heroTotal} />

              <View style={[styles.topBar, { top: insets.top + 14 }]}>
                <View style={styles.brand}>
                  <LinearGradient colors={gradients.lime} style={styles.logo}>
                    <Ionicons
                      name="flash"
                      size={18}
                      color={colors.onHighlight}
                    />
                  </LinearGradient>
                  <Text
                    variant="title"
                    color={colors.white}
                    fixedColor
                    style={styles.brandText}
                  >
                    Optimas{" "}
                    <Text
                      variant="title"
                      color={colors.highlight}
                      fixedColor
                      style={styles.brandText}
                    >
                      MS
                    </Text>
                  </Text>
                </View>
                <InstallButton />
              </View>

              <Animated.View
                style={[
                  styles.badge,
                  {
                    left: vx - 62,
                    top: badgeTop,
                    opacity: fade,
                    transform: [{ translateY: rise }],
                  },
                ]}
              >
                <View style={styles.badgeRing}>
                  <Ionicons name={s.icon} size={46} color={colors.white} />
                </View>
              </Animated.View>

              {showChip ? (
                <Animated.View
                  style={[
                    styles.chip,
                    { left: vx - 70, top: chipTop, opacity: fade },
                  ]}
                >
                  <View style={styles.chipDot} />
                  <Text
                    variant="label"
                    color={colors.white}
                    fixedColor
                    style={{ fontFamily: fonts.semibold, fontSize: 12 }}
                  >
                    {s.chip}
                  </Text>
                </Animated.View>
              ) : null}
            </View>

            {/* ── Copy + form, anchored to the bottom ── */}
            <View
              style={[styles.body, { paddingBottom: insets.bottom + space.lg }]}
            >
              <Animated.View
                style={{
                  gap: 10,
                  opacity: fade,
                  transform: [{ translateY: rise }],
                }}
              >
                <View style={styles.tag}>
                  <Text variant="label" style={styles.tagText}>
                    {s.tag}
                  </Text>
                </View>
                <Text style={styles.headline} accessibilityRole="header">
                  {s.title}
                </Text>
                <View style={styles.kicker}>
                  <View style={styles.triangle} />
                  <Text variant="bodySm" style={{ fontFamily: fonts.bold }}>
                    {s.kicker}
                  </Text>
                </View>
                <Text
                  variant="bodySm"
                  color={colors.textMuted}
                  style={{ lineHeight: 19 }}
                >
                  {s.body}
                </Text>
              </Animated.View>

              <View style={styles.dots}>
                {SLIDES.map((_, i) => (
                  <Pressable
                    key={i}
                    onPress={() => {
                      setSlide(i);
                      setPaused(true);
                    }}
                    hitSlop={8}
                    accessibilityLabel={`Slide ${i + 1}`}
                  >
                    <View
                      style={[styles.dot, i === slide && styles.dotActive]}
                    />
                  </Pressable>
                ))}
              </View>

              <Input
                label="Staff number, account number or email"
                icon="id-card-outline"
                placeholder="e.g. OPT-TEC-001"
                autoCapitalize="characters"
                autoCorrect={false}
                value={identifier}
                onFocus={() => setPaused(true)}
                onChangeText={(v) => {
                  setIdentifier(v);
                  if (error) setError(null);
                }}
                returnKeyType="next"
                fieldStyle={styles.field}
              />
              <View>
                <Input
                  label="Password"
                  icon="lock-closed-outline"
                  placeholder="Your password"
                  secureTextEntry={!showPassword}
                  value={password}
                  onFocus={() => setPaused(true)}
                  onChangeText={(v) => {
                    setPassword(v);
                    if (error) setError(null);
                  }}
                  onSubmitEditing={submit}
                  returnKeyType="go"
                  fieldStyle={styles.field}
                />
                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  style={styles.eye}
                  hitSlop={10}
                  accessibilityLabel={
                    showPassword ? "Hide password" : "Show password"
                  }
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={colors.textDim}
                  />
                </Pressable>
              </View>

              {error ? (
                <View style={styles.error} accessibilityLiveRegion="polite">
                  <Ionicons
                    name="alert-circle"
                    size={18}
                    color={colors.danger}
                  />
                  <Text
                    variant="bodySm"
                    color={colors.danger}
                    style={{ flex: 1 }}
                  >
                    {error}
                  </Text>
                </View>
              ) : null}

              <View style={styles.actions}>
                <Button
                  label="Sign in"
                  caps
                  size="lg"
                  trailingIcon="arrow-forward-circle-outline"
                  loading={loading}
                  onPress={submit}
                  style={{ flex: 1.5 }}
                />
                <Button
                  label="Help"
                  caps
                  size="lg"
                  variant="secondary"
                  onPress={help}
                  style={styles.helpBtn}
                />
              </View>

              <View style={styles.secure}>
                <Ionicons name="lock-closed" size={11} color={colors.textDim} />
                <Text
                  variant="label"
                  color={colors.textDim}
                  style={{ fontSize: 11 }}
                >
                  Secure sign-in · Optimas Wi-Fi
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/**
 * The reference's cut "photo": a huge rounded square turned 45°, so its lower corner makes the diagonal
 * edge. Inside, a dark fibre-optic scene drawn in SVG (no image assets to load or go stale).
 */
function HeroArt({ width: W, height: H }: { width: number; height: number }) {
  const bx = W * VERTEX_X;
  const d = W * 0.6 + 160; // half-diagonal: keeps the other three corners off-screen
  const cy = H - d;
  const side = d * Math.SQRT2;
  const square = {
    x: bx - side / 2,
    y: cy - side / 2,
    width: side,
    height: side,
    rx: 46,
    transform: `rotate(45 ${bx} ${cy})`,
  };
  const outline = {
    x: bx - side / 2 - 14,
    y: cy - side / 2 - 14,
    width: side + 28,
    height: side + 28,
    rx: 56,
    transform: `rotate(45 ${bx} ${cy + 18})`,
  };

  // Fibre strands fanning from the lower left of the panel up to the top right
  const strands = Array.from({ length: 8 }, (_, i) => {
    const x0 = -40 + i * 26;
    const y0 = H + 20;
    return `M ${x0} ${y0} C ${W * 0.3 + i * 18} ${H * 0.75 - i * 10}, ${W * 0.45 + i * 14} ${H * 0.3 + i * 6}, ${W + 30} ${-20 + i * 26}`;
  });
  // Light pulses kept clear of the centre line, where the badge and caption sit
  const pulses = [
    [W * 0.86, H * 0.42],
    [W * 0.8, H * 0.16],
    [W * 0.95, H * 0.66],
  ];

  return (
    <Svg
      width={W}
      height={H}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      <Defs>
        <ClipPath id="panel">
          <Rect {...square} />
        </ClipPath>
        <SvgGradient id="ink" x1="0" y1="0" x2="0.6" y2="1">
          <Stop offset="0" stopColor="#2D3033" />
          <Stop offset="1" stopColor="#0B0C0D" />
        </SvgGradient>
        <RadialGradient
          id="glow"
          cx={W * 0.55}
          cy={H * 0.55}
          r={W * 0.7}
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0" stopColor="#D8F04A" stopOpacity={0.16} />
          <Stop offset="1" stopColor="#D8F04A" stopOpacity={0} />
        </RadialGradient>
        <SvgGradient id="fibre" x1="0" y1="1" x2="1" y2="0">
          <Stop offset="0" stopColor="#ECF23A" stopOpacity={0} />
          <Stop offset="0.5" stopColor="#ECF23A" stopOpacity={0.45} />
          <Stop offset="1" stopColor="#F7FAB8" stopOpacity={0.95} />
        </SvgGradient>
      </Defs>

      {/* Thin offset outline behind the panel, like the reference's frame */}
      <Rect
        {...outline}
        fill="none"
        stroke="rgba(28,29,31,0.09)"
        strokeWidth={1.5}
      />

      <G clipPath="url(#panel)">
        <Rect x={0} y={0} width={W} height={H} fill="url(#ink)" />
        <Rect x={0} y={0} width={W} height={H} fill="url(#glow)" />
        {strands.map((p, i) => (
          <Path
            key={`g${i}`}
            d={p}
            stroke="url(#fibre)"
            strokeWidth={7}
            strokeOpacity={0.12}
            fill="none"
          />
        ))}
        {strands.map((p, i) => (
          <Path
            key={`s${i}`}
            d={p}
            stroke="url(#fibre)"
            strokeWidth={1.3}
            fill="none"
          />
        ))}
        {pulses.map(([x, y], i) => (
          <G key={`p${i}`}>
            <Circle cx={x} cy={y} r={7} fill="#ECF23A" fillOpacity={0.18} />
            <Circle cx={x} cy={y} r={2.4} fill="#F7FAB8" />
          </G>
        ))}
      </G>
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFFFFF" },
  scroll: { flexGrow: 1, alignItems: "center" },
  column: { flex: 1 },
  topBar: {
    position: "absolute",
    left: space.lg,
    right: space.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  brandText: { fontFamily: fonts.bold, fontSize: 17 },
  badge: {
    position: "absolute",
    width: 124,
    height: 124,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeRing: {
    width: 108,
    height: 108,
    borderRadius: 54,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
  },
  chip: {
    position: "absolute",
    width: 140,
    height: 30,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  chipDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.highlight,
  },
  body: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    gap: 14,
  },
  tag: {
    alignSelf: "flex-start",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: "#EFEFEF",
    borderWidth: 1,
    borderColor: "#D9D9D9",
  },
  tagText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.text,
  },
  headline: {
    fontFamily: fonts.display,
    fontSize: 46,
    lineHeight: 44,
    color: colors.text,
    textTransform: "uppercase",
    paddingTop: 4,
  },
  kicker: { flexDirection: "row", alignItems: "center", gap: 8 },
  triangle: {
    width: 0,
    height: 0,
    borderTopWidth: 5,
    borderBottomWidth: 5,
    borderLeftWidth: 8,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    borderLeftColor: ACCENT,
  },
  dots: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "rgba(28,29,31,0.18)",
  },
  dotActive: { width: 24, backgroundColor: colors.charcoal },
  field: { backgroundColor: "#F2F2F2", minHeight: 54 },
  helpBtn: { flex: 1, backgroundColor: "#EBEBEB", borderColor: "#EBEBEB" },
  eye: { position: "absolute", right: space.lg, bottom: 14 },
  error: {
    flexDirection: "row",
    gap: space.sm,
    alignItems: "center",
    backgroundColor: colors.dangerSoft,
    padding: space.md,
    borderRadius: radius.md,
  },
  actions: { flexDirection: "row", gap: space.sm, marginTop: 2 },
  secure: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    marginTop: 2,
  },
});
