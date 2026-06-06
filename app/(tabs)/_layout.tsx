import { Tabs, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { GestureResponderEvent, Pressable, StyleSheet, View } from 'react-native'
import { Feather } from '@expo/vector-icons'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  ReduceMotion,
} from 'react-native-reanimated'
import { useTheme } from '@design/useTheme'
import { MODULE_COLORS } from '@design/moduleColors'
import { useTranslation } from '@services/i18n'
import { ModulePicker } from '@features/home/components/ModulePicker'

type IconName = keyof typeof Feather.glyphMap

// Bounces the icon when its tab becomes active
function AnimatedTabIcon({ name, color, focused }: { name: IconName; color: string; focused: boolean }) {
  const scale = useSharedValue(1)
  const prevFocused = useRef(false)

  useEffect(() => {
    if (focused && !prevFocused.current) {
      scale.value = withSequence(
        withSpring(1.2, { damping: 6, stiffness: 320, reduceMotion: ReduceMotion.System }),
        withSpring(1, { damping: 12, stiffness: 240, reduceMotion: ReduceMotion.System })
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

// Center FAB: tap returns to Home, long press opens the module picker.
function LauncherButton({
  onPress,
  onLongPress,
  onTouchMove,
  onTouchEnd,
  label,
}: {
  onPress: () => void
  onLongPress: () => void
  onTouchMove: (event: GestureResponderEvent) => void
  onTouchEnd: () => void
  label: string
}) {
  const theme = useTheme()
  const scale = useSharedValue(0.7)
  const rotation = useSharedValue(0)

  // Pop-in on mount
  useEffect(() => {
    scale.value = withSpring(1, { damping: 10, stiffness: 180, reduceMotion: ReduceMotion.System })
  }, [scale])

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { rotate: `${rotation.value}deg` },
    ],
  }))

  const handleLongPress = () => {
    // Brief rotation feedback on long press
    rotation.value = withSequence(
      withSpring(45, { damping: 8, stiffness: 300, reduceMotion: ReduceMotion.System }),
      withSpring(0, { damping: 10, stiffness: 200, reduceMotion: ReduceMotion.System })
    )
    onLongPress()
  }

  return (
    <Pressable
      onPress={onPress}
      onLongPress={handleLongPress}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      delayLongPress={250}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
    >
      {({ pressed }) => (
        <Animated.View
          style={[
            styles.launcherButton,
            {
              backgroundColor: pressed ? theme.brand.primary + 'CC' : theme.brand.primary,
              borderColor: theme.bg.elevated,
            },
            animStyle,
          ]}
        >
          <Feather name="grid" size={24} color="#fff" />
        </Animated.View>
      )}
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
  const [touchPoint, setTouchPoint] = useState<{ x: number; y: number } | null>(null)
  const selectedRouteRef = useRef<string | null>(null)

  const closePicker = () => {
    setPickerOpen(false)
    setTouchPoint(null)
    selectedRouteRef.current = null
  }

  const finishPicker = () => {
    const route = selectedRouteRef.current
    closePicker()
    if (route) {
      requestAnimationFrame(() => router.push(route as any))
    }
  }

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
          name="finance"
          options={{
            title: t.nav_finance,
            tabBarLabel: t.nav_finance,
            tabBarActiveTintColor: theme.finance.expense,
            tabBarIcon: ({ color, focused }) => (
              <AnimatedTabIcon name="dollar-sign" color={color} focused={focused} />
            ),
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
          name="launcher"
          options={{
            title: 'BataVasa',
            tabBarLabel: '',
            tabBarButton: () => (
              <LauncherButton
                onPress={() => router.push('/')}
                onLongPress={() => setPickerOpen(true)}
                onTouchMove={(event) => {
                  if (!pickerOpen) return
                  const { pageX, pageY } = event.nativeEvent
                  setTouchPoint({ x: pageX, y: pageY })
                }}
                onTouchEnd={() => {
                  if (!pickerOpen) return
                  finishPicker()
                }}
                label={t.nav_home}
              />
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
      </Tabs>
      <ModulePicker
        visible={pickerOpen}
        touchPoint={touchPoint}
        onActiveRouteChange={(route) => { selectedRouteRef.current = route }}
        onClose={closePicker}
      />
    </>
  )
}

const styles = StyleSheet.create({
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 14, marginRight: 4 },
  headerBtn: { paddingHorizontal: 4 },
  launcherButton: {
    width: 58,
    height: 58,
    borderRadius: 999,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
    shadowOpacity: 0.24,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
})
