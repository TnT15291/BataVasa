import type { ReactNode } from 'react'
import { StyleSheet, Text, View, type ViewStyle } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { radius } from '@design/tokens'

type IconName = keyof typeof Feather.glyphMap
type Size = 'sm' | 'md' | 'lg'

type Props = {
  color: string
  icon?: IconName
  emoji?: string
  size?: Size
  children?: ReactNode
  style?: ViewStyle | ViewStyle[]
}

const SIZES: Record<Size, { box: number; icon: number; emoji: number }> = {
  sm: { box: 24, icon: 12, emoji: 14 },
  md: { box: 32, icon: 14, emoji: 16 },
  lg: { box: 40, icon: 17, emoji: 18 },
}

export function IconBadge({ color, icon, emoji, size = 'md', children, style }: Props) {
  const dims = SIZES[size]
  return (
    <View style={[styles.wrap, { width: dims.box, height: dims.box, backgroundColor: color }, style]}>
      {children ?? (
        emoji ? (
          <Text style={{ fontSize: dims.emoji }}>{emoji}</Text>
        ) : (
          <Feather name={icon ?? 'circle'} size={dims.icon} color="#fff" />
        )
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
