import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { useSettingsStore, type AIProvider } from '@store/settingsStore'
import { hapticSaveSuccess } from '@services/haptics'
import {
  getProviderKey,
  saveProviderKey,
  deleteProviderKey,
  getKeysStatus,
} from '@services/ai/openai'
import { AI_PROVIDERS, PROVIDER_ORDER } from '@services/ai/providers'

export function AISettingsScreen() {
  const theme = useTheme()
  const { t } = useTranslation()
  const { aiProvider, setAIProvider } = useSettingsStore()

  const [selectedTab, setSelectedTab] = useState<AIProvider>(aiProvider)
  const [keyInput, setKeyInput] = useState('')
  const [keyMasked, setKeyMasked] = useState(false)
  const [saving, setSaving] = useState(false)
  const [keysStatus, setKeysStatus] = useState<Record<AIProvider, boolean>>({
    openai: false, gemini: false, groq: false, deepseek: false,
  })

  const loadStatus = useCallback(async () => {
    const status = await getKeysStatus()
    setKeysStatus(status)
  }, [])

  const loadTabKey = useCallback(async (provider: AIProvider) => {
    const key = await getProviderKey(provider)
    if (key) {
      setKeyInput(AI_PROVIDERS[provider].keyPrefix + '•'.repeat(16))
      setKeyMasked(true)
    } else {
      setKeyInput('')
      setKeyMasked(false)
    }
  }, [])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  useEffect(() => {
    loadTabKey(selectedTab)
  }, [selectedTab, loadTabKey])

  const onSwitchTab = (provider: AIProvider) => {
    setSelectedTab(provider)
    setKeyInput('')
    setKeyMasked(false)
  }

  const onSave = async () => {
    const trimmed = keyInput.trim()
    if (!trimmed || keyMasked) return
    const config = AI_PROVIDERS[selectedTab]
    if (trimmed.length < 10) {
      Alert.alert(t.ai_error, t.key_too_short)
      return
    }
    if (!trimmed.startsWith(config.keyPrefix)) {
      Alert.alert(t.ai_error, `${t.key_invalid_prefix} "${config.keyPrefix}..."`)
      return
    }
    setSaving(true)
    await saveProviderKey(selectedTab, trimmed)
    setSaving(false)
    setKeyMasked(true)
    await loadStatus()
    void hapticSaveSuccess()
    Alert.alert('✓', `${config.name} — ${t.key_saved_for}`)
  }

  const onDelete = () => {
    const config = AI_PROVIDERS[selectedTab]
    Alert.alert(`${t.delete} ${config.name} Key?`, t.delete_key_msg, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: async () => {
          await deleteProviderKey(selectedTab)
          setKeyInput('')
          setKeyMasked(false)
          await loadStatus()
          if (aiProvider === selectedTab) await setAIProvider('openai')
        },
      },
    ])
  }

  const onSetActive = async () => {
    if (!keysStatus[selectedTab]) {
      Alert.alert(t.no_api_key, t.add_key_first)
      return
    }
    await setAIProvider(selectedTab)
    void hapticSaveSuccess()
    Alert.alert('✓', t.now_using_provider)
  }

  const currentConfig = AI_PROVIDERS[selectedTab]

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.bg.primary }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg.primary }}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
    >
      {/* Provider tabs */}
      <Text style={[styles.sectionLabel, { color: theme.text.muted }]}>PROVIDER</Text>
      <View style={[styles.tabs, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
        {PROVIDER_ORDER.map((p) => {
          const cfg = AI_PROVIDERS[p]
          const active = selectedTab === p
          const hasKey = keysStatus[p]
          const isUsing = aiProvider === p
          return (
            <Pressable
              key={p}
              onPress={() => onSwitchTab(p)}
              style={[
                styles.tab,
                { borderBottomColor: active ? theme.brand.primary : 'transparent' },
              ]}
            >
              <Text style={styles.tabBadge}>{cfg.badge}</Text>
              <Text style={[styles.tabName, { color: active ? theme.brand.primary : theme.text.secondary }]}>
                {cfg.name}
              </Text>
              {isUsing && (
                <View style={[styles.activeDot, { backgroundColor: theme.semantic.success }]} />
              )}
              {hasKey && !isUsing && (
                <View style={[styles.activeDot, { backgroundColor: theme.border.strong }]} />
              )}
            </Pressable>
          )
        })}
      </View>

      {/* Key input */}
      <View style={[styles.card, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: theme.text.primary }]}>
            {currentConfig.badge} {currentConfig.name}
          </Text>
          {aiProvider === selectedTab && (
            <View style={[styles.chip, { backgroundColor: theme.semantic.success }]}>
              <Text style={styles.chipText}>{t.active_label}</Text>
            </View>
          )}
        </View>

        <Text style={[styles.label, { color: theme.text.muted }]}>API KEY</Text>
        <TextInput
          value={keyInput}
          onChangeText={(v) => { setKeyInput(v); setKeyMasked(false) }}
          placeholder={`${currentConfig.keyPrefix}...`}
          placeholderTextColor={theme.text.muted}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={keyMasked}
          style={[
            styles.input,
            {
              color: theme.text.primary,
              borderColor: theme.border.strong,
              backgroundColor: theme.bg.secondary,
            },
          ]}
        />

        <Text style={[styles.hint, { color: theme.text.muted }]}>
          {t.register_free_at} {currentConfig.registerUrl}
        </Text>

        <View style={styles.btnRow}>
          <Pressable
            onPress={onSave}
            disabled={saving || !keyInput.trim() || keyMasked}
            style={[
              styles.btn,
              {
                backgroundColor:
                  saving || !keyInput.trim() || keyMasked
                    ? theme.border.strong
                    : theme.brand.primary,
                flex: 1,
              },
            ]}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.btnText}>{t.save_api_key}</Text>
            )}
          </Pressable>

          {keysStatus[selectedTab] && (
            <Pressable
              onPress={onSetActive}
              disabled={aiProvider === selectedTab}
              style={[
                styles.btn,
                {
                  backgroundColor:
                    aiProvider === selectedTab ? theme.border.strong : theme.brand.accent,
                  flex: 1,
                },
              ]}
            >
              <Text style={styles.btnText}>
                {aiProvider === selectedTab ? t.active_label : t.use_this_provider}
              </Text>
            </Pressable>
          )}
        </View>

        {keysStatus[selectedTab] && (
          <Pressable onPress={onDelete} style={styles.deleteBtn}>
            <Text style={[styles.deleteBtnText, { color: theme.semantic.danger }]}>
              {t.delete_api_key}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Status overview */}
      <Text style={[styles.sectionLabel, { color: theme.text.muted }]}>{t.ai_status}</Text>
      <View style={[styles.card, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
        {PROVIDER_ORDER.map((p) => {
          const cfg = AI_PROVIDERS[p]
          const hasKey = keysStatus[p]
          const isUsing = aiProvider === p
          return (
            <View key={p} style={[styles.statusRow, { borderColor: theme.border.subtle }]}>
              <Text style={styles.statusBadge}>{cfg.badge}</Text>
              <Text style={[styles.statusName, { color: theme.text.primary }]}>{cfg.name}</Text>
              <Text style={[styles.statusVal, { color: hasKey ? theme.semantic.success : theme.text.muted }]}>
                {isUsing ? `✅ ${t.active_label}` : hasKey ? `🔑 ${t.has_key}` : `○ ${t.no_key}`}
              </Text>
            </View>
          )
        })}
      </View>

      {/* Free tier info */}
      <View style={[styles.infoBox, { backgroundColor: theme.bg.secondary, borderColor: theme.border.subtle }]}>
        <Text style={[styles.infoTitle, { color: theme.text.primary }]}>💡 {t.free_tier_title}</Text>
        <Text style={[styles.infoItem, { color: theme.text.secondary }]}>
          🟡 <Text style={{ fontWeight: '600' }}>Groq</Text> — {t.free_tier_groq}
        </Text>
        <Text style={[styles.infoItem, { color: theme.text.secondary }]}>
          🔵 <Text style={{ fontWeight: '600' }}>Gemini</Text> — {t.free_tier_gemini}
        </Text>
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { padding: spacing[4], gap: spacing[3] },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: spacing[1],
    marginTop: spacing[2],
  },
  tabs: {
    flexDirection: 'row',
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing[3],
    borderBottomWidth: 2,
    gap: 2,
  },
  tabBadge: { fontSize: 16 },
  tabName: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  activeDot: { width: 6, height: 6, borderRadius: 3, marginTop: 2 },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[4],
    gap: spacing[3],
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  chip: { paddingHorizontal: spacing[2], paddingVertical: 2, borderRadius: radius.sm },
  chipText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  label: { fontSize: 12, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing[3],
    fontSize: 14,
    fontFamily: 'Courier',
  },
  hint: { fontSize: 12 },
  btnRow: { flexDirection: 'row', gap: spacing[2] },
  btn: { paddingVertical: spacing[3], borderRadius: radius.md, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  deleteBtn: { alignItems: 'center', paddingVertical: spacing[2] },
  deleteBtnText: { fontSize: 14 },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing[2],
  },
  statusBadge: { fontSize: 16, width: 24 },
  statusName: { flex: 1, fontSize: 14 },
  statusVal: { fontSize: 13 },
  infoBox: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[4],
    gap: spacing[2],
  },
  infoTitle: { fontSize: 14, fontWeight: '600', marginBottom: spacing[1] },
  infoItem: { fontSize: 13, lineHeight: 20 },
})
