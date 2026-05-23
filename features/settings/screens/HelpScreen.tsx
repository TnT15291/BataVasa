import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { FlowDiagram } from '@components/FlowDiagram'

type IconName = keyof typeof Feather.glyphMap

function TipRow({ index, title, body, color }: { index: number; title: string; body: string; color: string }) {
  const theme = useTheme()
  return (
    <View style={styles.tipRow}>
      <View style={[styles.tipNum, { backgroundColor: color + '1F' }]}>
        <Text style={[styles.tipNumText, { color }]}>{index}</Text>
      </View>
      <View style={styles.tipText}>
        <Text style={[styles.tipTitle, { color: theme.text.primary }]}>{title}</Text>
        <Text style={[styles.tipBody, { color: theme.text.muted }]}>{body}</Text>
      </View>
    </View>
  )
}

function InfoRow({ icon, title, body, color }: { icon: IconName; title: string; body: string; color: string }) {
  const theme = useTheme()
  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoIcon, { backgroundColor: color + '1F' }]}>
        <Feather name={icon} size={18} color={color} />
      </View>
      <View style={styles.tipText}>
        <Text style={[styles.tipTitle, { color: theme.text.primary }]}>{title}</Text>
        <Text style={[styles.tipBody, { color: theme.text.muted }]}>{body}</Text>
      </View>
    </View>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme()
  return (
    <>
      <Text style={[styles.sectionHeader, { color: theme.text.muted }]}>{title.toUpperCase()}</Text>
      <View style={[styles.card, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
        {children}
      </View>
    </>
  )
}

export function HelpScreen() {
  const theme = useTheme()
  const { t } = useTranslation()

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg.primary }} contentContainerStyle={styles.container}>
      <Text style={[styles.intro, { color: theme.text.secondary }]}>{t.help_intro}</Text>

      <Section title={t.help_quickstart_title}>
        <TipRow index={1} title={t.help_tip_account_title} body={t.help_tip_account_body} color={theme.brand.primary} />
        <View style={[styles.divider, { backgroundColor: theme.border.subtle }]} />
        <TipRow index={2} title={t.help_tip_add_title} body={t.help_tip_add_body} color="#FF9800" />
        <View style={[styles.divider, { backgroundColor: theme.border.subtle }]} />
        <TipRow index={3} title={t.help_tip_reports_title} body={t.help_tip_reports_body} color="#9C27B0" />
      </Section>

      <Section title={t.help_data_title}>
        <View style={styles.flowWrap}>
          <FlowDiagram />
        </View>
        <InfoRow icon="hard-drive" title={t.help_data_offline_title} body={t.help_data_offline_body} color={theme.semantic.info} />
        <View style={[styles.divider, { backgroundColor: theme.border.subtle }]} />
        <InfoRow icon="cloud" title={t.help_data_sync_title} body={t.help_data_sync_body} color={theme.semantic.success} />
        <View style={[styles.divider, { backgroundColor: theme.border.subtle }]} />
        <InfoRow icon="lock" title={t.help_data_private_title} body={t.help_data_private_body} color={theme.brand.primary} />
      </Section>

      <Section title={t.help_permissions_title}>
        <InfoRow icon="mic" title={t.mic_permission_title} body={t.mic_permission_hint} color="#FF9800" />
        <View style={[styles.divider, { backgroundColor: theme.border.subtle }]} />
        <InfoRow icon="map-pin" title={t.location_access} body={t.location_access_hint} color="#2196F3" />
        <View style={[styles.divider, { backgroundColor: theme.border.subtle }]} />
        <InfoRow icon="bell" title={t.notification_permission_title} body={t.notification_permission_hint} color="#9C27B0" />
      </Section>

      <Text style={[styles.footer, { color: theme.text.muted }]}>{t.help_footer}</Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { padding: spacing[4], gap: spacing[1], paddingBottom: spacing[10] },
  intro: { fontSize: 14, lineHeight: 20, marginBottom: spacing[2] },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: spacing[4],
    marginBottom: spacing[2],
    marginLeft: spacing[1],
    letterSpacing: 0.5,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing[4],
    gap: spacing[3],
  },
  flowWrap: { marginBottom: spacing[1] },
  tipRow: { flexDirection: 'row', gap: spacing[3], alignItems: 'flex-start' },
  tipNum: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  tipNumText: { fontSize: 14, fontWeight: '800' },
  infoRow: { flexDirection: 'row', gap: spacing[3], alignItems: 'flex-start' },
  infoIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipText: { flex: 1, gap: 2 },
  tipTitle: { fontSize: 15, fontWeight: '700' },
  tipBody: { fontSize: 13, lineHeight: 18 },
  divider: { height: StyleSheet.hairlineWidth },
  footer: { fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: spacing[5] },
})
