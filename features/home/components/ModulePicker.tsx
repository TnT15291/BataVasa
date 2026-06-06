import { useEffect } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Feather } from '@expo/vector-icons'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  Easing,
  ReduceMotion,
} from 'react-native-reanimated'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '@design/useTheme'
import { MODULE_COLORS } from '@design/moduleColors'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'

type IconName = keyof typeof Feather.glyphMap

type Module = {
  icon: IconName
  label: string
  color: string
  route: string
}

type ItemProps = {
  mod: Module
  visible: boolean
  delay: number
  onPress: () => void
}

// Each item manages its own animation so hooks-in-loop is avoided
function PickerItem({ mod, visible, delay, onPress }: ItemProps) {
  const theme = useTheme()
  const scale = useSharedValue(0)

  useEffect(() => {
    const cfg = { reduceMotion: ReduceMotion.System }
    if (visible) {
      scale.value = withDelay(delay, withSpring(1, { damping: 10, stiffness: 260, ...cfg }))
    } else {
      scale.value = withTiming(0, { duration: 100, easing: Easing.in(Easing.quad), ...cfg })
    }
  }, [visible, delay, scale])

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: scale.value,
  }))

  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={mod.label}
        style={({ pressed }) => [
          styles.item,
          { opacity: pressed ? 0.75 : 1 },
        ]}
      >
        <View style={[styles.itemCircle, {
          backgroundColor: mod.color + '20',
          borderColor: mod.color + '40',
        }]}>
          <Feather name={mod.icon} size={22} color={mod.color} />
        </View>
        <Text style={[styles.itemLabel, { color: theme.text.secondary }]} numberOfLines={1}>
          {mod.label}
        </Text>
      </Pressable>
    </Animated.View>
  )
}

type Props = {
  visible: boolean
  onClose: () => void
}

export function ModulePicker({ visible, onClose }: Props) {
  const theme = useTheme()
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const TAB_BAR_H = 62 + insets.bottom
  const BAR_BOTTOM = TAB_BAR_H + 16

  const modules: Module[] = [
    { icon: 'dollar-sign', label: t.nav_finance, color: theme.finance.expense, route: '/finance' },
    { icon: 'check-circle', label: t.habits, color: MODULE_COLORS.habits, route: '/habits' },
    { icon: 'book-open', label: t.nav_journal, color: MODULE_COLORS.journal, route: '/journals' },
    { icon: 'bell', label: t.nav_reminders, color: MODULE_COLORS.tasks, route: '/reminders' },
  ]

  // Bar animation
  const barScale = useSharedValue(0.7)
  const barOpacity = useSharedValue(0)
  const barTranslateY = useSharedValue(24)

  // Backdrop
  const backdropOpacity = useSharedValue(0)

  useEffect(() => {
    const cfg = { reduceMotion: ReduceMotion.System }
    if (visible) {
      backdropOpacity.value = withTiming(1, { duration: 200, ...cfg })
      barOpacity.value = withTiming(1, { duration: 180, ...cfg })
      barScale.value = withSpring(1, { damping: 16, stiffness: 240, ...cfg })
      barTranslateY.value = withSpring(0, { damping: 18, stiffness: 260, ...cfg })
    } else {
      backdropOpacity.value = withTiming(0, { duration: 180, ...cfg })
      barOpacity.value = withTiming(0, { duration: 150, easing: Easing.in(Easing.quad), ...cfg })
      barScale.value = withTiming(0.8, { duration: 160, easing: Easing.in(Easing.quad), ...cfg })
      barTranslateY.value = withTiming(20, { duration: 150, ...cfg })
    }
  }, [visible, backdropOpacity, barOpacity, barScale, barTranslateY])

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }))

  // Scale from bottom-center: compensate translateY so it grows upward
  const barStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: barTranslateY.value },
      { scale: barScale.value },
    ],
    opacity: barOpacity.value,
  }))

  const navigate = (route: string) => {
    onClose()
    setTimeout(() => router.push(route as any), 120)
  }

  return (
    <>
      {/* Backdrop — tap to dismiss */}
      <Animated.View
        style={[StyleSheet.absoluteFill, backdropStyle]}
        pointerEvents={visible ? 'box-none' : 'none'}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessible={false}
        />
      </Animated.View>

      {/* Pill picker bar */}
      <Animated.View
        pointerEvents={visible ? 'box-none' : 'none'}
        style={[
          styles.barWrap,
          { bottom: BAR_BOTTOM },
          barStyle,
        ]}
      >
        <View style={[styles.bar, {
          backgroundColor: theme.bg.elevated,
          borderColor: theme.border.strong,
          shadowColor: '#000',
        }]}>
          {modules.map((mod, i) => (
            <PickerItem
              key={mod.route}
              mod={mod}
              visible={visible}
              delay={i * 55}
              onPress={() => navigate(mod.route)}
            />
          ))}
        </View>

        {/* Arrow pointing down toward launcher button */}
        <View style={[styles.arrow, { borderTopColor: theme.border.strong }]} />
        <View style={[styles.arrowInner, { borderTopColor: theme.bg.elevated }]} />
      </Animated.View>
    </>
  )
}

const ITEM_W = 64
const GAP = 4

const styles = StyleSheet.create({
  barWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GAP,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  item: {
    width: ITEM_W,
    alignItems: 'center',
    gap: spacing[1] + 2,
  },
  itemCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemLabel: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  // Downward-pointing triangle connecting bar to launcher button
  arrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },
  arrowInner: {
    position: 'absolute',
    bottom: 1,
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
})
