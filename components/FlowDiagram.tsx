import { View, Text, StyleSheet } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'

type IconName = keyof typeof Feather.glyphMap

/**
 * "Create → Save offline → Auto-sync" — the one-glance explanation of how the
 * app handles data. Shown in onboarding and the Help screen so new users
 * understand offline-first + cloud sync without any technical wording.
 */
export function FlowDiagram() {
  const theme = useTheme()
  const { t } = useTranslation()

  const steps: { icon: IconName; label: string; color: string }[] = [
    { icon: 'plus-circle', label: t.flow_create, color: theme.brand.primary },
    { icon: 'smartphone', label: t.flow_save_offline, color: theme.semantic.info },
    { icon: 'refresh-cw', label: t.flow_autosync, color: theme.semantic.success },
  ]

  return (
    <View style={[styles.wrap, { backgroundColor: theme.bg.secondary, borderColor: theme.border.subtle }]}>
      {steps.map((step, i) => (
        <View key={step.label} style={styles.stepRow}>
          <View style={styles.step}>
            <View style={[styles.iconWrap, { backgroundColor: step.color + '1F' }]}>
              <Feather name={step.icon} size={20} color={step.color} />
            </View>
            <Text style={[styles.label, { color: theme.text.secondary }]} numberOfLines={2}>{step.label}</Text>
          </View>
          {i < steps.length - 1 ? (
            <Feather name="chevron-right" size={18} color={theme.text.muted} style={styles.arrow} />
          ) : null}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[3],
  },
  stepRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  step: { flex: 1, alignItems: 'center', gap: spacing[1] },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  arrow: { marginHorizontal: spacing[1] },
})
