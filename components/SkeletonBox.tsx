import { useEffect, useRef } from 'react'
import { Animated, StyleSheet, View, type ViewStyle } from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'
import { useTheme } from '@design/useTheme'

type Props = {
  width?: number | `${number}%`
  height?: number
  borderRadius?: number
  style?: ViewStyle
}

export function SkeletonBox({ width, height = 16, borderRadius = 6, style }: Props) {
  const theme = useTheme()
  const reduceMotion = useReducedMotion()
  const opacity = useRef(new Animated.Value(0.4)).current

  useEffect(() => {
    if (reduceMotion) return
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    )
    anim.start()
    return () => anim.stop()
  }, [opacity, reduceMotion])

  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: theme.border.subtle, opacity },
        style,
      ]}
    />
  )
}

export function SkeletonTransactionList() {
  const theme = useTheme()
  return (
    <View style={{ padding: 16, gap: 12 }}>
      {/* Overview card skeleton */}
      <View style={[styles.card, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
        <SkeletonBox width="40%" height={14} />
        <SkeletonBox width="60%" height={28} style={{ marginTop: 8 }} />
        <View style={styles.row}>
          <SkeletonBox width="45%" height={14} />
          <SkeletonBox width="45%" height={14} />
        </View>
        <SkeletonBox width="100%" height={8} style={{ marginTop: 4 }} borderRadius={4} />
        <SkeletonBox width="100%" height={8} borderRadius={4} />
      </View>
      {/* Segment control skeleton */}
      <SkeletonBox width="100%" height={38} borderRadius={8} />
      {/* Row skeletons */}
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={[styles.txRow, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
          <SkeletonBox width={40} height={40} borderRadius={20} />
          <View style={{ flex: 1, gap: 6 }}>
            <SkeletonBox width="55%" height={14} />
            <SkeletonBox width="35%" height={11} />
          </View>
          <SkeletonBox width={60} height={14} />
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 10,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
  },
})
