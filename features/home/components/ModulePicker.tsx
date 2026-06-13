import { useEffect, useMemo } from 'react'
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { Feather } from '@expo/vector-icons'
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { useTheme } from '@design/useTheme'
import { MODULE_COLORS } from '@design/moduleColors'
import { radius, spacing } from '@design/tokens'
import { useTranslation } from '@services/i18n'

type IconName = keyof typeof Feather.glyphMap
type Module = { icon: IconName; label: string; color: string; route: string }

type ItemProps = {
  mod: Module
  visible: boolean
  delay: number
  onPress: () => void
}

function PickerItem({ mod, visible, delay, onPress }: ItemProps) {
  const theme = useTheme()
  const progress = useSharedValue(0)

  useEffect(() => {
    progress.value = visible
      ? withDelay(delay, withTiming(1, { duration: 170, reduceMotion: ReduceMotion.System }))
      : withTiming(0, { duration: 120, reduceMotion: ReduceMotion.System })
  }, [visible, delay, progress])

  const animStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 6 }],
  }))

  return (
    <Animated.View style={[styles.itemWrap, animStyle]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={mod.label}
        style={({ pressed }) => [
          styles.item,
          {
            backgroundColor: pressed ? theme.bg.primary : theme.bg.secondary,
            borderColor: pressed ? mod.color + '66' : theme.border.subtle,
          },
        ]}
      >
        <View style={[styles.itemIcon, { backgroundColor: mod.color + '18' }]}>
          <Feather name={mod.icon} size={19} color={mod.color} />
        </View>
        <Text style={[styles.itemLabel, { color: theme.text.primary }]} numberOfLines={1}>
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
  const { width } = useWindowDimensions()

  const modules: Module[] = useMemo(
    () => [
      { icon: 'dollar-sign',  label: t.nav_finance,   color: MODULE_COLORS.finance, route: '/finance'   },
      { icon: 'check-circle', label: t.habits,        color: MODULE_COLORS.habits,  route: '/habits'    },
      { icon: 'book-open',    label: t.nav_journal,   color: MODULE_COLORS.journal, route: '/journals'  },
      { icon: 'bell',         label: t.nav_reminders, color: MODULE_COLORS.tasks,   route: '/reminders' },
    ],
    [t.nav_finance, t.habits, t.nav_journal, t.nav_reminders],
  )

  const panelProgress = useSharedValue(0)

  useEffect(() => {
    panelProgress.value = withTiming(visible ? 1 : 0, {
      duration: visible ? 180 : 140,
      reduceMotion: ReduceMotion.System,
    })
  }, [visible, panelProgress])

  const backdropStyle = useAnimatedStyle(() => ({ opacity: panelProgress.value }))
  const panelStyle = useAnimatedStyle(() => ({
    opacity: panelProgress.value,
    transform: [{ translateY: (1 - panelProgress.value) * 18 }],
  }))

  const navigate = (route: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onClose()
    setTimeout(() => router.navigate(route as any), 90)
  }

  const panelWidth = Math.min(width - spacing[8], 420)

  return (
    <>
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.32)' }, backdropStyle]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessible={false} />
      </Animated.View>

      <Animated.View
        pointerEvents={visible ? 'auto' : 'none'}
        style={[
          styles.panel,
          {
            width: panelWidth,
            bottom: 76 + insets.bottom,
            backgroundColor: theme.bg.elevated,
            borderColor: theme.border.card,
            shadowColor: theme.shadow.color,
            shadowOffset: theme.shadow.offset,
            shadowOpacity: theme.shadow.opacity,
            shadowRadius: theme.shadow.radius,
            elevation: theme.shadow.elevation,
          },
          panelStyle,
        ]}
      >
        <View style={styles.panelHeader}>
          <Text style={[styles.panelTitle, { color: theme.text.primary }]}>{t.home_command_center}</Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t.ai_confirm_cancel}
            hitSlop={8}
            style={({ pressed }) => [
              styles.closeBtn,
              { backgroundColor: pressed ? theme.bg.secondary : 'transparent' },
            ]}
          >
            <Feather name="x" size={17} color={theme.text.secondary} />
          </Pressable>
        </View>
        <View style={styles.grid}>
          {modules.map((mod, i) => (
            <PickerItem
              key={mod.route}
              mod={mod}
              visible={visible}
              delay={visible ? i * 25 : 0}
              onPress={() => navigate(mod.route)}
            />
          ))}
        </View>
      </Animated.View>
    </>
  )
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing[3],
    gap: spacing[3],
  },
  panelHeader: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  panelTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  itemWrap: {
    width: '48%',
    minWidth: 0,
    flexGrow: 1,
  },
  item: {
    minHeight: 56,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  itemIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
})
