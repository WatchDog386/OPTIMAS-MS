import { Text as RNText, type TextProps } from 'react-native';
import { colors, type, type TypeVariant } from '../theme';

interface Props extends TextProps {
  variant?: TypeVariant;
  color?: string;
  align?: 'left' | 'center' | 'right';
}

export function Text({ variant = 'body', color = colors.text, align, style, ...rest }: Props) {
  return <RNText {...rest} style={[type[variant], { color, textAlign: align }, style]} />;
}
