import { useState, type ComponentRef, type Ref } from 'react';
import { Platform, StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, space } from '../theme';
import { Text } from './Text';

interface Props extends TextInputProps {
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  error?: string;
  ref?: Ref<ComponentRef<typeof TextInput>>;
  /** Extra style for the pill field (e.g. a solid fill on plain white pages). */
  fieldStyle?: StyleProp<ViewStyle>;
}

/** Material 3 outlined text field with focus and error states. */
export function Input({ label, icon, error, style, fieldStyle, multiline, onFocus, onBlur, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.danger : focused ? 'rgba(28,29,31,0.25)' : colors.glassBorder;
  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <Text variant="label" color={colors.textMuted} style={{ marginLeft: 4 }}>
          {label}
        </Text>
      ) : null}
      <View style={[styles.field, multiline && styles.multi, fieldStyle, { borderColor, borderWidth: 1 }]}>
        {icon ? <Ionicons name={icon} size={20} color={colors.textDim} /> : null}
        <TextInput
          placeholderTextColor={colors.textDim}
          selectionColor={colors.primary}
          cursorColor={colors.text}
          multiline={multiline}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, !multiline && styles.single, multiline && { textAlignVertical: 'top', minHeight: 96 }, style]}
          {...rest}
        />
      </View>
      {error ? (
        <Text variant="label" color={colors.danger}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Chrome draws its own focus ring around a focused <input> (outline-style: auto ignores outline-width),
 * which shows as a hard rectangle inside our rounded field. The pill's border already shows focus.
 * RN's types don't list 'none', hence the cast; it is a no-op on native.
 */
const WEB_NO_OUTLINE = (Platform.OS === 'web' ? { outlineStyle: 'none', outlineWidth: 0 } : {}) as TextStyle;

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 48,
    paddingHorizontal: space.lg + 2,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  single: { alignSelf: 'stretch' },
  multi: { alignItems: 'flex-start', paddingVertical: space.md, borderRadius: radius.lg },
  input: { flex: 1, color: colors.text, fontFamily: fonts.regular, fontSize: 14.5, paddingVertical: 0, ...WEB_NO_OUTLINE },
});
