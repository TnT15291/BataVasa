import { Tabs, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
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
import { ModuleLauncherSheet } from '@features/home/components/ModuleLauncherSheet'
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

// Launcher FAB in center of tab bar
// Short press → LauncherSheet, Long press → ModulePicker radial
function LauncherButton({
  onPress,
  onLongPress,
  label,
}: {
  onPress: () => void
  onLongPress: () => void
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
  const theme = useTheme()
  const { t } = useTranslation()
  const [launcherOpen, setLauncherOpen] = useState(false)
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
            title: 'BataVasa',
            headerRight: () => <HeaderRight />,
            tabBarLabel: t.nav_home,
            tabBarIcon: ({ color, focused }) => (
              <AnimatedTabIcon name="home" color={color} focused={focused} />
            ),
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
          name="launcher"
          options={{
            title: '',
            tabBarLabel: '',
            tabBarButton: () => (
              <LauncherButton
                onPress={() => setLauncherOpen(true)}
                onLongPress={() => setPickerOpen(true)}
                label={t.module_launcher_title ?? 'Add'}
              />
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
            href: null,
            title: t.nav_reminders,
          }}
        />
      </Tabs>
      <ModuleLauncherSheet visible={launcherOpen} onClose={() => setLauncherOpen(false)} />
      <ModulePicker visible={pickerOpen} onClose={() => setPickerOpen(false)} />
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
