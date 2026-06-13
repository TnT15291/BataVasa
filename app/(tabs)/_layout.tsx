import { Tabs, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Feather } from '@expo/vector-icons'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  ReduceMotion,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { useTheme } from '@design/useTheme'
import { MODULE_COLORS } from '@design/moduleColors'
import { useTranslation } from '@services/i18n'
import { ModulePicker } from '@features/home/components/ModulePicker'

type IconName = keyof typeof Feather.glyphMap

function AnimatedTabIcon({ name, color, focused }: { name: IconName; color: string; focused: boolean }) {
  const scale = useSharedValue(1)
  const prevFocused = useRef(false)

  useEffect(() => {
    if (focused && !prevFocused.current) {
      scale.value = withSequence(
        withSpring(1.2, { damping: 6, stiffness: 320, reduceMotion: ReduceMotion.System }),
        withSpring(1,   { damping: 12, stiffness: 240, reduceMotion: ReduceMotion.System })
      )
    }
    prevFocused.current = focused
  }, [focused, scale])

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return (
    <Animated.View style={animStyle}>
      <Feather name={name} size={22} color={color} />
    </Animated.View>
  )
}

// Center FAB — tap: home screen | long-press: module picker
function LauncherButton({
  onOpenPicker,
  onPress,
  label,
  hint,
}: {
  onOpenPicker: () => void
  onPress: () => void
  label: string
  hint: string
}) {
  const theme       = useTheme()
  const mountScale  = useSharedValue(0.7)
  const pressScale  = useSharedValue(1)
  const rotation    = useSharedValue(0)
  const ringScale   = useSharedValue(1)
  const ringOpacity = useSharedValue(0)
  const longPressed = useRef(false)

  useEffect(() => {
    mountScale.value = withSpring(1, { damping: 10, stiffness: 180, reduceMotion: ReduceMotion.System })
  }, [mountScale])

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: mountScale.value * pressScale.value },
      { rotate: `${rotation.value}deg` },
    ],
  }))

  const chargeRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }))

  const handlePressIn = () => {
    longPressed.current   = false
    pressScale.value      = withSpring(0.88, { damping: 18, stiffness: 480, reduceMotion: ReduceMotion.System })
    ringOpacity.value     = withTiming(0.35, { duration: 90, reduceMotion: ReduceMotion.System })
    ringScale.value       = withTiming(1.18, { duration: 180, reduceMotion: ReduceMotion.System })
  }

  const handlePressOut = () => {
    if (longPressed.current) return
    pressScale.value  = withSpring(1, { damping: 8, stiffness: 280, reduceMotion: ReduceMotion.System })
    ringOpacity.value = withTiming(0, { duration: 160, reduceMotion: ReduceMotion.System })
    ringScale.value   = withTiming(1, { duration: 160, reduceMotion: ReduceMotion.System })
  }

  const handleLongPress = () => {
    longPressed.current = true
    // Burst ring outward — confirms activation
    ringScale.value   = withSpring(1.28, { damping: 16, stiffness: 220, reduceMotion: ReduceMotion.System })
    ringOpacity.value = withTiming(0, { duration: 220, reduceMotion: ReduceMotion.System })
    // Button pops then settles
    pressScale.value  = withSequence(
      withSpring(1.06, { damping: 8,  stiffness: 340, reduceMotion: ReduceMotion.System }),
      withSpring(1.0,  { damping: 12, stiffness: 260, reduceMotion: ReduceMotion.System })
    )
    rotation.value = withSequence(
      withSpring(18, { damping: 8,  stiffness: 260, reduceMotion: ReduceMotion.System }),
      withSpring(0,  { damping: 10, stiffness: 220, reduceMotion: ReduceMotion.System })
    )
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onOpenPicker()
  }

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onLongPress={handleLongPress}
      delayLongPress={400}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
    >
      <View style={styles.launcherOuter}>
        <Animated.View
          style={[styles.chargeRing, { borderColor: theme.brand.primary }, chargeRingStyle]}
        />
        <Animated.View
          style={[
            styles.launcherButton,
            { backgroundColor: theme.brand.primary, borderColor: theme.bg.elevated },
            buttonStyle,
          ]}
        >
          <Feather name="grid" size={24} color="#fff" />
        </Animated.View>
        <Text style={[styles.launcherLabel, { color: theme.text.muted }]}>{label}</Text>
      </View>
    </Pressable>
  )
}

function HeaderRight() {
  const router = useRouter()
  const theme = useTheme()
  return (
    <View style={styles.headerRight}>
      <Pressable onPress={() => router.push('/help')} hitSlop={8} style={styles.headerBtn}>
        <Feather name="help-circle" size={22} color={theme.text.secondary} />
      </Pressable>
      <Pressable onPress={() => router.push('/settings')} hitSlop={8} style={styles.headerBtn}>
        <Feather name="settings" size={22} color={theme.text.secondary} />
      </Pressable>
    </View>
  )
}

export default function TabsLayout() {
  const router = useRouter()
  const theme = useTheme()
  const { t } = useTranslation()
  const [pickerOpen, setPickerOpen] = useState(false)

  return (
    <>
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: theme.bg.elevated },
          headerTitleStyle: { color: theme.text.primary, fontWeight: '600', fontSize: 17 },
          headerShadowVisible: false,
          tabBarStyle: {
            backgroundColor: theme.bg.elevated,
            borderTopColor: theme.border.subtle,
            borderTopWidth: StyleSheet.hairlineWidth,
            minHeight: 62,
            paddingBottom: 6,
          },
          tabBarActiveTintColor: theme.brand.primary,
          tabBarInactiveTintColor: theme.text.muted,
          tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: -2 },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            href: null,
            title: 'BataVasa',
            headerRight: () => <HeaderRight />,
          }}
        />
        <Tabs.Screen
          name="habits"
          options={{
            title: t.habits,
            tabBarLabel: t.nav_habits,
            tabBarActiveTintColor: MODULE_COLORS.habits,
            tabBarIcon: ({ color, focused }) => (
              <AnimatedTabIcon name="check-circle" color={color} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="journals"
          options={{
            title: t.nav_journal,
            tabBarLabel: t.nav_journal,
            tabBarActiveTintColor: MODULE_COLORS.journal,
            tabBarIcon: ({ color, focused }) => (
              <AnimatedTabIcon name="book-open" color={color} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="launcher"
          options={{
            title: 'BataVasa',
            tabBarLabel: '',
            tabBarButton: () => (
              <LauncherButton
                onPress={() => router.navigate('/')}
                onOpenPicker={() => setPickerOpen(true)}
                label={t.nav_home}
                hint={t.module_launcher_subtitle}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="reminders"
          options={{
            title: t.nav_reminders,
            tabBarLabel: t.nav_reminders,
            tabBarActiveTintColor: MODULE_COLORS.tasks,
            tabBarIcon: ({ color, focused }) => (
              <AnimatedTabIcon name="bell" color={color} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="finance"
          options={{
            title: t.nav_finance,
            tabBarLabel: t.nav_finance,
            tabBarActiveTintColor: MODULE_COLORS.finance,
            tabBarIcon: ({ color, focused }) => (
              <AnimatedTabIcon name="dollar-sign" color={color} focused={focused} />
            ),
          }}
        />
      </Tabs>
      <ModulePicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
      />
    </>
  )
}

const styles = StyleSheet.create({
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 14, marginRight: 4 },
  headerBtn: { paddingHorizontal: 4 },
  launcherOuter: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
    gap: 3,
  },
  launcherLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  chargeRing: {
    position: 'absolute',
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 1.5,
  },
  launcherButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.24,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
})
