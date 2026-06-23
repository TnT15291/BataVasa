import { StyleSheet, TextInput, type TextInputProps, type TextStyle } from 'react-native'
import { useTheme } from '@design/useTheme'
import { radius, spacing } from '@design/tokens'

type Props = TextInputProps & {
  containerStyle?: TextStyle | TextStyle[]
  inputStyle?: TextStyle | TextStyle[]
}

export function TextField({ containerStyle, inputStyle, placeholderTextColor, ...props }: Props) {
  const theme = useTheme()
  return (
    <TextInput
      placeholderTextColor={placeholderTextColor ?? theme.text.muted}
      style={[
        styles.input,
        {
          color: theme.text.primary,
          borderColor: theme.border.subtle,
          backgroundColor: theme.bg.primary,
        },
        containerStyle,
        inputStyle,
      ]}
      {...props}
    />
  )
}

const styles = StyleSheet.create({
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing[4],
    fontSize: 15,
  },
})
