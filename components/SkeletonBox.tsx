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

export function SkeletonDailyDigest() {
  const theme = useTheme()
  return (
    <View style={{ padding: 16, gap: 12 }}>
      {/* Hero card */}
      <View style={[skStyles.card, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
        <View style={skStyles.heroTop}>
          <View style={{ flex: 1, gap: 6 }}>
            <SkeletonBox width="30%" height={11} />
            <SkeletonBox width="50%" height={13} />
            <SkeletonBox width="70%" height={22} />
            <SkeletonBox width="40%" height={22} borderRadius={11} style={{ marginTop: 4 }} />
          </View>
          <SkeletonBox width={64} height={64} borderRadius={32} />
        </View>
        <SkeletonBox width="100%" height={52} borderRadius={10} style={{ marginTop: 4 }} />
        <View style={skStyles.chipRow}>
          <SkeletonBox width="31%" height={52} borderRadius={6} />
          <SkeletonBox width="31%" height={52} borderRadius={6} />
          <SkeletonBox width="31%" height={52} borderRadius={6} />
        </View>
      </View>
      {/* Timeline card */}
      <View style={[skStyles.card, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
        <SkeletonBox width="35%" height={14} />
        {[1, 2, 3].map((i) => (
          <View key={i} style={skStyles.timelineRow}>
            <SkeletonBox width={36} height={11} />
            <SkeletonBox width={30} height={30} borderRadius={15} />
            <View style={{ flex: 1, gap: 5 }}>
              <SkeletonBox width="60%" height={13} />
              <SkeletonBox width="40%" height={11} />
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}

const skStyles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  chipRow: { flexDirection: 'row', gap: 8 },
  timelineRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 46 },
})

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
})
