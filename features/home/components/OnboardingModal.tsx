import { useState, useEffect } from 'react'
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native'
import { usePathname, useRouter } from 'expo-router'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { useSettingsStore, type Language } from '@store/settingsStore'
import { getProviderKey } from '@services/ai/openai'
import { AI_PROVIDERS } from '@services/ai/providers'
import { FlowDiagram } from '@components/FlowDiagram'

const LANGUAGE_OPTIONS: Language[] = ['vi', 'en', 'zh', 'ja', 'ko', 'fr']

export function OnboardingModal({ visible }: { visible: boolean }) {
  const theme = useTheme()
  const { t } = useTranslation()
  const router = useRouter()
  const pathname = usePathname()
  const language = useSettingsStore((s) => s.language)
  const setLanguage = useSettingsStore((s) => s.setLanguage)
  const aiProvider = useSettingsStore((s) => s.aiProvider)
  const setHasSeenOnboarding = useSettingsStore((s) => s.setHasSeenOnboarding)
  const [step, setStep] = useState(0)
  const [hasApiKey, setHasApiKey] = useState(false)
  const isIndexRoute = pathname === '/'

  useEffect(() => {
    if (!visible) return
    setStep(0)
  }, [visible])

  useEffect(() => {
    if (!visible || !isIndexRoute || step !== 1) return
    let active = true
    const loadKey = async () => {
      const key = await getProviderKey(aiProvider)
      if (active) setHasApiKey(!!key)
    }
    void loadKey()
    const interval = setInterval(() => { void loadKey() }, 1000)
    return () => { active = false; clearInterval(interval) }
  }, [visible, aiProvider, step, isIndexRoute])

  const providerName = AI_PROVIDERS[aiProvider]?.name ?? aiProvider
  const stepLabel = t.onboarding_step
    .replace('{{step}}', String(step + 1))
    .replace('{{total}}', '3')

  const handleContinue = async () => {
    if (step === 0) {
      setStep(1)
      return
    }
    if (step === 1) {
      if (!hasApiKey) {
        router.push('/ai-settings')
        return
      }
      setStep(2)
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
                          backgroundColor: language === lang ? theme.bg.elevated : theme.bg.secondary,
                        },
                      ]}
                    >
                      <Text style={[styles.languageText, { color: theme.text.primary }]}> {t[`lang_${lang}` as keyof typeof t]} </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : step === 1 ? (
              <View style={styles.section}>
                <Text style={[styles.title, { color: theme.text.primary }]}>{t.onboarding_ai_title}</Text>
                <Text style={[styles.description, { color: theme.text.muted }]}>{t.onboarding_ai_desc}</Text>
                <View style={[styles.card, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
                  <Text style={[styles.cardLabel, { color: theme.text.muted }]}>{t.ai_settings}</Text>
                  <Text style={[styles.cardTitle, { color: theme.text.primary }]}>{providerName}</Text>
                  <Text style={[styles.cardStatus, { color: hasApiKey ? theme.semantic.success : theme.text.muted }]}> 
                    {hasApiKey ? `✅ ${t.has_key}` : `⚠️ ${t.no_key}`} 
                  </Text>
                  <Text style={[styles.cardHint, { color: theme.text.muted }]}>
                    {hasApiKey ? t.onboarding_api_key_ready : t.onboarding_api_key_missing}
                  </Text>
                </View>

                <Pressable
                  onPress={() => router.push('/ai-settings')}
                  style={[styles.button, { backgroundColor: theme.brand.primary }]}
                >
                  <Text style={[styles.buttonText, { color: '#fff' }]}>{t.onboarding_open_ai_settings}</Text>
                </Pressable>
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

          <View style={styles.footer}>
            {step > 0 ? (
              <Pressable onPress={handleBack} style={[styles.footerButton, { backgroundColor: theme.bg.secondary, borderColor: theme.border.subtle }]}>
                <Text style={[styles.footerText, { color: theme.text.primary }]}>{t.onboarding_back}</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={handleContinue}
              style={[
                styles.footerButton,
                {
                  backgroundColor: step === 1 && !hasApiKey ? theme.border.strong : theme.brand.primary,
                  opacity: step === 1 && !hasApiKey ? 0.6 : 1,
                },
              ]}
              disabled={step === 1 && !hasApiKey}
            >
              <Text style={[styles.footerText, { color: '#fff' }]}> 
                {step === 2 ? t.onboarding_start : t.onboarding_next}
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
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: spacing[4],
  },
  container: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  content: {
    padding: spacing[4],
    gap: spacing[3],
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
  },
  step: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  section: {
    gap: spacing[3],
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
    marginTop: spacing[2],
  },
  languageOption: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    minWidth: 100,
  },
  languageText: {
    fontSize: 14,
    textAlign: 'center',
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing[4],
    gap: spacing[2],
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardStatus: {
    fontSize: 13,
    fontWeight: '600',
  },
  cardHint: {
    fontSize: 13,
    lineHeight: 18,
  },
  button: {
    paddingVertical: spacing[3],
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing[2],
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  bulletList: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing[4],
    gap: spacing[2],
  },
  bulletItem: {
    fontSize: 14,
    lineHeight: 20,
  },
  flowTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: spacing[1],
  },
  syncNote: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing[3],
    marginTop: spacing[1],
  },
  syncNoteText: {
    fontSize: 13,
    lineHeight: 18,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: {
    fontSize: 14,
    fontWeight: '700',
  },
})
