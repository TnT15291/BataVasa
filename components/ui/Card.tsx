import type { ReactNode } from 'react'
import { StyleSheet, View, type ViewStyle } from 'react-native'
import { useTheme } from '@design/useTheme'
import { radius, spacing } from '@design/tokens'

type Variant = 'default' | 'outlined' | 'elevated'

type Props = {
  children: ReactNode
  variant?: Variant
  style?: ViewStyle | ViewStyle[]
}

export function Card({ children, variant = 'default', style }: Props) {
  const theme = useTheme()
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.bg.elevated,
          borderColor: variant === 'elevated' ? theme.border.card : theme.border.subtle,
        },
        variant === 'elevated' && theme.shadow,
        variant === 'outlined' && { backgroundColor: theme.bg.primary },
        style,
      ]}
    >
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[4],
    gap: spacing[3],
  },
})
