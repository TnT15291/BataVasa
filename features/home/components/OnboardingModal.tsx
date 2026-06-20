import { useState, useEffect } from 'react'
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native'
import { usePathname } from 'expo-router'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { useSettingsStore, type Language } from '@store/settingsStore'
import { FlowDiagram } from '@components/FlowDiagram'

const LANGUAGE_OPTIONS: Language[] = ['vi', 'en', 'zh', 'ja', 'ko', 'fr']

export function OnboardingModal({ visible }: { visible: boolean }) {
  const theme = useTheme()
  const { t } = useTranslation()
  const pathname = usePathname()
  const language = useSettingsStore((s) => s.language)
  const setLanguage = useSettingsStore((s) => s.setLanguage)
  const setHasSeenOnboarding = useSettingsStore((s) => s.setHasSeenOnboarding)
  const [step, setStep] = useState(0)
  const isIndexRoute = pathname === '/'

  useEffect(() => {
    if (!visible) return
    setStep(0)
  }, [visible])

  // AI is fully backend-managed (provider + key set by the publisher), so there
  // is no AI setup step — onboarding is just language → feature intro.
  const stepLabel = t.onboarding_step
    .replace('{{step}}', String(step + 1))
    .replace('{{total}}', '2')

  const handleContinue = async () => {
    if (step === 0) {
      setStep(1)
      return
    }
    await setHasSeenOnboarding(true)
  }

  const handleBack = () => {
    if (step > 0) setStep(step - 1)
  }

  return (
    <Modal visible={visible && isIndexRoute} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: theme.bg.primary, borderColor: theme.border.subtle }]}> 
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={[styles.heading, { color: theme.text.primary }]}>{t.onboarding_title}</Text>
            <Text style={[styles.step, { color: theme.text.muted }]}>{stepLabel}</Text>

            {step === 0 ? (
              <View style={styles.section}>
                <Text style={[styles.title, { color: theme.text.primary }]}>{t.onboarding_language_title}</Text>
                <Text style={[styles.description, { color: theme.text.muted }]}>{t.onboarding_language_desc}</Text>

                <View style={styles.optionGrid}>
                  {LANGUAGE_OPTIONS.map((lang) => (
                    <Pressable
                      key={lang}
                      onPress={() => setLanguage(lang)}
                      style={[
                        styles.languageOption,
                        {
                          borderColor: language === lang ? theme.brand.primary : theme.border.subtle,
                          backgroundColor: language === lang ? theme.brand.primary : theme.bg.secondary,
                        },
                      ]}
                    >
                      <Text style={[styles.languageText, { color: language === lang ? '#fff' : theme.text.primary }]}>
                        {t[`lang_${lang}` as keyof typeof t]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : (
              <View style={styles.section}>
                <Text style={[styles.title, { color: theme.text.primary }]}>{t.onboarding_intro_title}</Text>
                <Text style={[styles.description, { color: theme.text.muted }]}>{t.onboarding_value_prop}</Text>
                <View style={[styles.bulletList, { borderColor: theme.border.subtle }]}>
                  <Text style={[styles.bulletItem, { color: theme.text.primary }]}>• {t.nav_finance}</Text>
                  <Text style={[styles.bulletItem, { color: theme.text.primary }]}>• {t.nav_reminders}</Text>
                  <Text style={[styles.bulletItem, { color: theme.text.primary }]}>• {t.journals}</Text>
                  <Text style={[styles.bulletItem, { color: theme.text.primary }]}>• {t.habits}</Text>
                  <Text style={[styles.bulletItem, { color: theme.text.primary }]}>• {t.smart_entry}</Text>
                </View>

                <Text style={[styles.flowTitle, { color: theme.text.secondary }]}>{t.flow_title}</Text>
                <FlowDiagram />

                <View style={[styles.syncNote, { backgroundColor: theme.brand.primary + '14', borderColor: theme.brand.primary + '33' }]}>
                  <Text style={[styles.syncNoteText, { color: theme.text.secondary }]}>{t.onboarding_sync_note}</Text>
                </View>
              </View>
            )}
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: theme.border.subtle, backgroundColor: theme.bg.elevated }]}>
            {step > 0 ? (
              <Pressable onPress={handleBack} style={[styles.footerButton, { backgroundColor: theme.bg.secondary, borderColor: theme.border.subtle }]}>
                <Text style={[styles.footerText, { color: theme.text.primary }]}>{t.onboarding_back}</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={handleContinue}
              style={[styles.footerButton, { backgroundColor: theme.brand.primary }]}
            >
              <Text style={[styles.footerText, { color: '#fff' }]}>
                {step === 1 ? t.onboarding_start : t.onboarding_next}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(13,18,23,0.72)',
    justifyContent: 'center',
    padding: spacing[4],
  },
  container: {
    borderRadius: radius.lg,
    borderWidth: 1,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  content: {
    padding: spacing[5],
    gap: spacing[4],
  },
  heading: {
    fontSize: 26,
    lineHeight: 34,
    fontWeight: '700',
  },
  step: {
    fontSize: 14,
    fontWeight: '700',
    color: '#8B96A3',
    marginBottom: spacing[2],
  },
  section: {
    gap: spacing[3],
  },
  title: {
    fontSize: 21,
    fontWeight: '700',
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    marginTop: spacing[2],
  },
  languageOption: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    minWidth: 96,
    flexGrow: 1,
  },
  languageText: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  bulletList: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[4],
    gap: spacing[2],
    backgroundColor: '#F8FAFC',
  },
  bulletItem: {
    fontSize: 16,
    lineHeight: 24,
  },
  flowTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: spacing[1],
  },
  syncNote: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing[3],
    marginTop: spacing[2],
  },
  syncNoteText: {
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing[4],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerButton: {
    flex: 1,
    marginHorizontal: spacing[1],
    paddingVertical: spacing[3],
    borderRadius: radius.md,
    minWidth: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: {
    fontSize: 15,
    fontWeight: '700',
  },
})
