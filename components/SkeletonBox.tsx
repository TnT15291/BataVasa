import { useEffect, useRef } from 'react'
import { Animated, StyleSheet, View, type ViewStyle } from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'

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

// Mirrors the real DailyDigestScreen above-the-fold layout (AppHeader → story
// card → hero card → focus section) so content doesn't jump when it loads.
export function SkeletonDailyDigest() {
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const cardBg = { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }
  return (
    <View style={{ paddingHorizontal: spacing[4], paddingTop: insets.top + spacing[2], gap: spacing[2] }}>
      {/* AppHeader: brand mark + wordmark + two action buttons */}
      <View style={skStyles.headerRow}>
        <SkeletonBox width={28} height={28} borderRadius={radius.full} />
        <View style={{ flex: 1, gap: 4 }}>
          <SkeletonBox width={96} height={16} />
          <SkeletonBox width={64} height={11} />
        </View>
        <SkeletonBox width={30} height={30} borderRadius={radius.full} />
        <SkeletonBox width={30} height={30} borderRadius={radius.full} />
      </View>

      {/* Story card: AI coach line */}
      <View style={[skStyles.card, cardBg]}>
        <View style={skStyles.cardHeader}>
          <SkeletonBox width={30} height={30} borderRadius={radius.full} />
          <SkeletonBox width={120} height={11} />
        </View>
        <SkeletonBox width="100%" height={16} />
        <SkeletonBox width="80%" height={16} />
      </View>

      {/* Hero card: Safe to spend */}
      <View style={[skStyles.card, cardBg, { gap: spacing[1] }]}>
        <View style={skStyles.cardHeader}>
          <SkeletonBox width={26} height={26} borderRadius={radius.full} />
          <SkeletonBox width={110} height={11} />
        </View>
        <SkeletonBox width="55%" height={30} style={{ marginTop: 2 }} />
        <SkeletonBox width="42%" height={13} />
        <SkeletonBox width="50%" height={13} />
      </View>

      {/* Focus section: header + one card */}
      <View style={{ gap: spacing[1] }}>
        <View style={skStyles.sectionHeaderRow}>
          <SkeletonBox width={130} height={13} />
          <SkeletonBox width={56} height={13} />
        </View>
        <View style={[skStyles.focusCard, cardBg]}>
          <SkeletonBox width={30} height={30} borderRadius={radius.full} />
          <View style={{ flex: 1, gap: 6 }}>
            <SkeletonBox width="50%" height={14} />
            <SkeletonBox width="70%" height={11} />
          </View>
          <SkeletonBox width={36} height={15} />
        </View>
      </View>
    </View>
  )
}

const skStyles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: 4 },
  card: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing[3],
    gap: spacing[2],
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  focusCard: {
    minHeight: 58,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
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
