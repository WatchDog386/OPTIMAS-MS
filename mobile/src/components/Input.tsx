import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, space } from '../theme';
import { Text } from './Text';

interface Props extends TextInputProps {
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  error?: string;
}

export function Input({ label, icon, error, style, multiline, ...rest }: Props) {
  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <Text variant="label" color={colors.textMuted}>
          {label}
        </Text>
      ) : null}
      <View style={[styles.field, multiline && styles.multi, !!error && { borderColor: colors.danger }]}>
        {icon ? <Ionicons name={icon} size={18} color={colors.textDim} /> : null}
        <TextInput
          placeholderTextColor={colors.textDim}
          selectionColor={colors.primary}
          multiline={multiline}
          style={[styles.input, multiline && { textAlignVertical: 'top', minHeight: 90 }, style]}
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
    gap: space.sm,
    minHeight: 52,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  multi: { alignItems: 'flex-start', paddingVertical: space.md },
  input: { flex: 1, color: colors.text, fontFamily: fonts.medium, fontSize: 15, paddingVertical: 0 },
});
