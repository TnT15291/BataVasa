import type { ReactNode } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, type TextStyle, type ViewStyle } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useTheme } from '@design/useTheme'
import { radius, spacing } from '@design/tokens'

type IconName = keyof typeof Feather.glyphMap
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

type Props = {
  label: string
  onPress?: () => void
  disabled?: boolean
  loading?: boolean
  variant?: Variant
  icon?: IconName
  color?: string
  style?: ViewStyle | ViewStyle[]
  textStyle?: TextStyle | TextStyle[]
  left?: ReactNode
  accessibilityLabel?: string
}

export function Button({
  label,
  onPress,
  disabled,
  loading,
  variant = 'primary',
  icon,
  color,
  style,
  textStyle,
  left,
  accessibilityLabel,
}: Props) {
  const theme = useTheme()
  const isDisabled = disabled || loading
  const fg =
    color && variant !== 'primary' ? color
    : variant === 'primary' ? theme.brand.onPrimary
    : variant === 'danger' ? theme.semantic.danger
    : variant === 'ghost' ? theme.brand.primary
    : theme.text.primary
  const bg =
    isDisabled ? theme.border.strong
    : variant === 'primary' ? theme.brand.primary
    : variant === 'danger' ? theme.semantic.danger + '12'
    : variant === 'secondary' ? theme.bg.secondary
    : 'transparent'
  const border =
    color && variant !== 'primary' ? color + '66'
    : variant === 'primary' ? theme.brand.primary
    : variant === 'danger' ? theme.semantic.danger
    : variant === 'secondary' ? theme.border.subtle
    : 'transparent'

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && !isDisabled && styles.primaryShadow,
        { backgroundColor: bg, borderColor: border, opacity: pressed ? 0.86 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {left}
          {icon ? <Feather name={icon} size={16} color={fg} /> : null}
          <Text style={[styles.label, { color: fg }, textStyle]} numberOfLines={1}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
  },
  primaryShadow: {
    elevation: 2,
    shadowOpacity: 0.14,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  label: { fontSize: 14, fontWeight: '700' },
})
