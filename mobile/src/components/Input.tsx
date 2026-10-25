import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, space } from '../theme';
import { Text } from './Text';

interface Props extends TextInputProps {
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  error?: string;
}

/** Material 3 outlined text field with focus and error states. */
export function Input({ label, icon, error, style, multiline, onFocus, onBlur, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.danger : focused ? 'rgba(28,29,31,0.25)' : colors.glassBorder;
  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <Text variant="label" color={colors.textMuted} style={{ marginLeft: 4 }}>
          {label}
        </Text>
      ) : null}
      <View style={[styles.field, multiline && styles.multi, { borderColor, borderWidth: 1 }]}>
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
          style={[styles.input, multiline && { textAlignVertical: 'top', minHeight: 96 }, style]}
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
  multi: { alignItems: 'flex-start', paddingVertical: space.md, borderRadius: radius.lg },
  input: { flex: 1, color: colors.text, fontFamily: fonts.regular, fontSize: 14.5, paddingVertical: 0 },
});
