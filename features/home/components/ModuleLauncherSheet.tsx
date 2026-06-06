import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { MODULE_COLORS } from '@design/moduleColors'
import { useTranslation } from '@services/i18n'

type IconName = keyof typeof Feather.glyphMap
type Route = '/new' | '/reminder' | '/journal' | '/habit' | '/reminders' | '/analysis' | '/chat' | '/settings' | '/help'

type LauncherItem = {
  label: string
  icon: IconName
  color: string
  route: Route
}

type Props = {
  visible: boolean
  onClose: () => void
}

export function ModuleLauncherSheet({ visible, onClose }: Props) {
  const router = useRouter()
  const theme = useTheme()
  const { t } = useTranslation()

  const quickItems: LauncherItem[] = [
    { label: t.nav_new_transaction, icon: 'dollar-sign', color: theme.finance.expense, route: '/new' },
    { label: t.new_reminder, icon: 'bell', color: MODULE_COLORS.tasks, route: '/reminder' },
    { label: t.new_journal, icon: 'book-open', color: MODULE_COLORS.journal, route: '/journal' },
    { label: t.new_habit, icon: 'check-circle', color: MODULE_COLORS.habits, route: '/habit' },
  ]

  const moduleItems: LauncherItem[] = [
    { label: t.nav_reminders, icon: 'bell', color: MODULE_COLORS.tasks, route: '/reminders' },
    { label: t.analysis_title, icon: 'bar-chart-2', color: MODULE_COLORS.analysis, route: '/analysis' },
    { label: t.nav_chat, icon: 'message-circle', color: theme.brand.primary, route: '/chat' },
    { label: t.nav_settings, icon: 'settings', color: theme.text.secondary, route: '/settings' },
    { label: t.help_title, icon: 'help-circle', color: theme.text.secondary, route: '/help' },
  ]

  const open = (route: Route) => {
    onClose()
    requestAnimationFrame(() => router.push(route as any))
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
          <View style={styles.handleWrap}>
            <View style={[styles.handle, { backgroundColor: theme.border.strong }]} />
          </View>

          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: theme.text.primary }]}>{t.module_launcher_title}</Text>
              <Text style={[styles.subtitle, { color: theme.text.muted }]}>{t.module_launcher_subtitle}</Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t.cancel}
              style={[styles.closeBtn, { backgroundColor: theme.bg.secondary }]}
            >
              <Feather name="x" size={18} color={theme.text.secondary} />
            </Pressable>
          </View>

          <LauncherSection title={t.module_launcher_quick} items={quickItems} onPress={open} />
          <LauncherSection title={t.module_launcher_modules} items={moduleItems} onPress={open} />
        </View>
      </View>
    </Modal>
  )
}

function LauncherSection({ title, items, onPress }: { title: string; items: LauncherItem[]; onPress: (route: Route) => void }) {
  const theme = useTheme()
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.text.muted }]}>{title}</Text>
      <View style={styles.grid}>
        {items.map((item) => (
          <Pressable
            key={item.route}
            onPress={() => onPress(item.route)}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            style={({ pressed }) => [
              styles.item,
              {
                backgroundColor: pressed ? theme.bg.secondary : theme.bg.primary,
                borderColor: theme.border.subtle,
              },
            ]}
          >
            <View style={[styles.itemIcon, { backgroundColor: item.color + '1F' }]}>
              <Feather name={item.icon} size={19} color={item.color} />
            </View>
            <Text style={[styles.itemLabel, { color: theme.text.primary }]} numberOfLines={2}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.38)' },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[6],
    gap: spacing[4],
  },
  handleWrap: { alignItems: 'center', paddingTop: spacing[2] },
  handle: { width: 42, height: 4, borderRadius: radius.full },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[3] },
  title: { fontSize: 18, fontWeight: '800' },
  subtitle: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  closeBtn: { width: 36, height: 36, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  section: { gap: spacing[2] },
  sectionTitle: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  item: {
    width: '31.8%',
    minHeight: 92,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing[2],
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
  },
  itemIcon: { width: 38, height: 38, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  itemLabel: { fontSize: 12, fontWeight: '700', textAlign: 'center', lineHeight: 16 },
})
