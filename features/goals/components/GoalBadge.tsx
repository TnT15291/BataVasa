import { Pressable, Text, StyleSheet, type GestureResponderEvent } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { MODULE_COLORS } from '@design/moduleColors'
import { useTranslation } from '@services/i18n'
import { useGoalLink } from '../hooks/useGoalLink'

type Props = {
  module: 'finance' | 'habits'
  id: string | null | undefined
  // Seed title when creating a goal from here (e.g. a habit's identity line).
  title?: string
  // 'chip' = compact list-row badge (hidden when nothing is linked);
  // 'button' = full-width action that also offers "set as goal" when unlinked.
  variant?: 'chip' | 'button'
}

const GOAL_COLOR = MODULE_COLORS.analysis

export function GoalBadge({ module, id, title, variant = 'chip' }: Props) {
  const theme = useTheme()
  const router = useRouter()
  const { t } = useTranslation()
  const link = useGoalLink(module, id)
  const moduleColor = module === 'finance' ? MODULE_COLORS.finance : MODULE_COLORS.habits

  const openGoal = (e?: GestureResponderEvent) => {
    e?.stopPropagation?.()
    if (link) router.push({ pathname: '/goal-detail', params: { id: link.goalId } })
  }
  const createGoal = (e?: GestureResponderEvent) => {
    e?.stopPropagation?.()
    if (!id) return
    router.push({ pathname: '/goal', params: { measureModule: module, measureId: id, goalTitle: title ?? '' } })
  }

  if (variant === 'chip') {
    if (!link) return null
    return (
      <Pressable
        onPress={openGoal}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={t.goal_linked}
        style={[styles.chip, { backgroundColor: GOAL_COLOR + '14', borderColor: GOAL_COLOR + '40' }]}
      >
        <Feather name="target" size={11} color={GOAL_COLOR} />
        <Text style={[styles.chipText, { color: GOAL_COLOR }]}>{link.reached || link.done ? '✓' : `${link.percent}%`}</Text>
      </Pressable>
    )
  }

  if (link) {
    return (
      <Pressable
        onPress={openGoal}
        accessibilityRole="button"
        style={[styles.button, { backgroundColor: GOAL_COLOR + '10', borderColor: GOAL_COLOR + '66' }]}
      >
        <Feather name="target" size={15} color={GOAL_COLOR} />
        <Text style={[styles.buttonText, { color: GOAL_COLOR }]} numberOfLines={1}>
          {t.goal_linked} · {link.reached || link.done ? t.goal_done : `${link.percent}%`}
        </Text>
        <Feather name="chevron-right" size={16} color={GOAL_COLOR} />
      </Pressable>
    )
  }

  if (!id) return null
  return (
    <Pressable
      onPress={createGoal}
      accessibilityRole="button"
      style={[styles.button, { backgroundColor: moduleColor + '10', borderColor: moduleColor + '66' }]}
    >
      <Feather name="target" size={15} color={moduleColor} />
      <Text style={[styles.buttonText, { color: moduleColor }]} numberOfLines={1}>{t.goal_set_from_here}</Text>
      <Feather name="chevron-right" size={16} color={moduleColor} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1, borderRadius: radius.full, paddingHorizontal: spacing[2], paddingVertical: 2 },
  chipText: { fontSize: 11, fontWeight: '700' },
  button: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], borderWidth: 1, borderRadius: radius.md, minHeight: 46, paddingHorizontal: spacing[3] },
  buttonText: { flex: 1, fontSize: 14, fontWeight: '700' },
})
