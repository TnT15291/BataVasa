import { useEffect, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
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
  active: boolean
  position: { x: number; y: number }
  onPress: () => void
}

// Each item manages its own animation so hooks-in-loop is avoided
function PickerItem({ mod, visible, delay, active, position, onPress }: ItemProps) {
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

  const activeScale = active ? 1.18 : 1
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: position.x }, { translateY: position.y }, { scale: scale.value * activeScale }],
    opacity: scale.value,
  }))

  return (
    <Animated.View style={[styles.itemWrap, animStyle]}>
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
          backgroundColor: active ? mod.color : mod.color + '20',
          borderColor: active ? mod.color : mod.color + '40',
        }]}>
          <Feather name={mod.icon} size={22} color={active ? '#fff' : mod.color} />
        </View>
        <Text style={[styles.itemLabel, { color: active ? theme.text.primary : theme.text.secondary }]} numberOfLines={1}>
          {mod.label}
        </Text>
      </Pressable>
    </Animated.View>
  )
}

type Props = {
  visible: boolean
  touchPoint?: { x: number; y: number } | null
  onActiveRouteChange?: (route: string | null) => void
  onClose: () => void
}

export function ModulePicker({ visible, touchPoint, onActiveRouteChange, onClose }: Props) {
  const theme = useTheme()
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()
  const [activeRoute, setActiveRoute] = useState<string | null>(null)

  const TAB_BAR_H = 62 + insets.bottom
  const origin = useMemo(() => ({
    x: width / 2,
    y: height - TAB_BAR_H + 10,
  }), [width, height, TAB_BAR_H])

  const modules: Module[] = [
    { icon: 'dollar-sign', label: t.nav_finance, color: theme.finance.expense, route: '/finance' },
    { icon: 'check-circle', label: t.habits, color: MODULE_COLORS.habits, route: '/habits' },
    { icon: 'book-open', label: t.nav_journal, color: MODULE_COLORS.journal, route: '/journals' },
    { icon: 'bell', label: t.nav_reminders, color: MODULE_COLORS.tasks, route: '/reminders' },
  ]

  const positions = useMemo(() => {
    const radius = Math.min(154, Math.max(126, width * 0.36))
    const angles = [-152, -116, -64, -28]
    return angles.map((deg) => {
      const rad = (deg * Math.PI) / 180
      return {
        x: Math.cos(rad) * radius,
        y: Math.sin(rad) * radius,
      }
    })
  }, [width])

  const centers = useMemo(() => positions.map((pos, index) => ({
    route: modules[index].route,
    x: origin.x + pos.x,
    y: origin.y + pos.y,
  })), [modules, origin, positions])

  // Arc animation
  const arcScale = useSharedValue(0.7)
  const arcOpacity = useSharedValue(0)
  const arcTranslateY = useSharedValue(24)

  // Backdrop
  const backdropOpacity = useSharedValue(0)

  useEffect(() => {
    const cfg = { reduceMotion: ReduceMotion.System }
    if (visible) {
      backdropOpacity.value = withTiming(1, { duration: 200, ...cfg })
      arcOpacity.value = withTiming(1, { duration: 180, ...cfg })
      arcScale.value = withSpring(1, { damping: 16, stiffness: 240, ...cfg })
      arcTranslateY.value = withSpring(0, { damping: 18, stiffness: 260, ...cfg })
    } else {
      backdropOpacity.value = withTiming(0, { duration: 180, ...cfg })
      arcOpacity.value = withTiming(0, { duration: 150, easing: Easing.in(Easing.quad), ...cfg })
      arcScale.value = withTiming(0.8, { duration: 160, easing: Easing.in(Easing.quad), ...cfg })
      arcTranslateY.value = withTiming(20, { duration: 150, ...cfg })
      setActiveRoute(null)
    }
  }, [visible, backdropOpacity, arcOpacity, arcScale, arcTranslateY])

  useEffect(() => {
    if (!visible || !touchPoint) {
      if (!visible) onActiveRouteChange?.(null)
      return
    }

    let nearest: string | null = null
    let best = Number.POSITIVE_INFINITY
    for (const center of centers) {
      const dx = touchPoint.x - center.x
      const dy = touchPoint.y - center.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      if (distance < best) {
        best = distance
        nearest = center.route
      }
    }

    const next = best <= 76 ? nearest : null
    setActiveRoute(next)
    onActiveRouteChange?.(next)
  }, [centers, onActiveRouteChange, touchPoint, visible])

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }))

  // Scale from bottom-center so modules grow out of the Home button.
  const arcStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: arcTranslateY.value },
      { scale: arcScale.value },
    ],
    opacity: arcOpacity.value,
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

      <Animated.View
        pointerEvents={visible ? 'box-none' : 'none'}
        style={[
          styles.arcWrap,
          { left: origin.x, top: origin.y },
          arcStyle,
        ]}
      >
        <View style={[styles.originHint, { backgroundColor: theme.brand.primary + '22', borderColor: theme.brand.primary + '55' }]}>
          <Feather name="home" size={17} color={theme.brand.primary} />
        </View>
        {modules.map((mod, i) => (
          <PickerItem
            key={mod.route}
            mod={mod}
            visible={visible}
            delay={i * 45}
            active={activeRoute === mod.route}
            position={positions[i]}
            onPress={() => navigate(mod.route)}
          />
        ))}
      </Animated.View>
    </>
  )
}

const styles = StyleSheet.create({
  arcWrap: {
    position: 'absolute',
    width: 1,
    height: 1,
  },
  originHint: {
    position: 'absolute',
    width: 42,
    height: 42,
    left: -21,
    top: -21,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemWrap: {
    position: 'absolute',
    left: -38,
    top: -38,
  },
  item: {
    width: 76,
    alignItems: 'center',
    gap: spacing[1] + 2,
  },
  itemCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 10,
  },
  itemLabel: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
})
