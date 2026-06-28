import { useEffect, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Switch,
  Alert,
  Share,
  ActivityIndicator,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useTheme } from '@design/useTheme'
import { spacing, radius } from '@design/tokens'
import { useTranslation } from '@services/i18n'
import { track } from '@services/analytics'
import { useContextStore } from '@store/contextStore'
import { useSettingsStore } from '@store/settingsStore'
import { exportAllContext } from '@features/context/services'
import { hapticSaveSuccess } from '@services/haptics'
import type { ContextKind, UserContextEntry } from '@features/context/types'

const KINDS: ContextKind[] = ['goal', 'preference', 'fact']

export function AIMemoryScreen() {
  const theme = useTheme()
  const { t } = useTranslation()
  const entries = useContextStore((s) => s.entries)
  const loadState = useContextStore((s) => s.loadState)
  const loadContext = useContextStore((s) => s.loadContext)
  const createEntry = useContextStore((s) => s.createEntry)
  const updateEntry = useContextStore((s) => s.updateEntry)
  const deleteEntry = useContextStore((s) => s.deleteEntry)
  const wipeAll = useContextStore((s) => s.wipeAll)
  const syncContext = useSettingsStore((s) => s.syncContext)
  const setSyncContext = useSettingsStore((s) => s.setSyncContext)

  const [content, setContent] = useState('')
  const [kind, setKind] = useState<ContextKind>('fact')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (loadState === 'idle') void loadContext()
  }, [loadState, loadContext])

  const kindLabel = (k: ContextKind): string =>
    k === 'goal' ? t.ai_memory_kind_goal : k === 'preference' ? t.ai_memory_kind_preference : t.ai_memory_kind_fact

  const resetForm = () => {
    setContent('')
    setKind('fact')
    setEditingId(null)
  }

  const onSubmit = async () => {
    const text = content.trim()
    if (!text || busy) return
    setBusy(true)
    try {
      const r = editingId
        ? await updateEntry({ id: editingId, kind, content: text })
        : await createEntry({ kind, content: text })
      if (!r.ok) {
        Alert.alert(t.could_not_save, r.error ?? '')
        return
      }
      void hapticSaveSuccess()
      if (!editingId) track('feature_used', { feature_name: 'ai_memory_add' })
      resetForm()
    } finally {
      setBusy(false)
    }
  }

  const onEdit = (entry: UserContextEntry) => {
    setEditingId(entry.id)
    setKind(entry.kind)
    setContent(entry.content)
  }

  const onDelete = (entry: UserContextEntry) => {
    Alert.alert(t.ai_memory_delete_title, entry.content, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: () => {
          if (editingId === entry.id) resetForm()
          void deleteEntry(entry.id)
        },
      },
    ])
  }

  const onExport = async () => {
    const r = await exportAllContext()
    if (!r.ok) {
      Alert.alert(t.could_not_save, r.error.message)
      return
    }
    await Share.share({ message: r.value, title: 'batavasa-ai-memory.json' })
  }

  const onWipe = () => {
    Alert.alert(t.ai_memory_delete_all, t.ai_memory_delete_all_hint, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: () => {
          Alert.alert(t.confirm_wipe_final_title, t.confirm_wipe_final_msg, [
            { text: t.cancel, style: 'cancel' },
            {
              text: t.delete,
              style: 'destructive',
              onPress: async () => {
                const r = await wipeAll()
                if (r.ok) Alert.alert(t.wipe_success.replace('{{count}}', String(r.deleted ?? 0)))
                else Alert.alert(t.could_not_save, r.error ?? '')
                resetForm()
              },
            },
          ])
        },
      },
    ])
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg.primary }}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.note, { backgroundColor: theme.brand.primary + '14', borderColor: theme.brand.primary + '33' }]}>
        <Feather name="cpu" size={18} color={theme.brand.primary} />
        <Text style={[styles.noteText, { color: theme.text.secondary }]}>{t.ai_memory_intro}</Text>
      </View>

      {/* Add / edit form */}
      <View style={[styles.card, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
        <View style={styles.kindRow}>
          {KINDS.map((k) => {
            const active = kind === k
            return (
              <Pressable
                key={k}
                onPress={() => setKind(k)}
                style={[
                  styles.kindChip,
                  {
                    backgroundColor: active ? theme.brand.primary : theme.bg.secondary,
                    borderColor: active ? theme.brand.primary : theme.border.subtle,
                  },
                ]}
              >
                <Text style={[styles.kindChipText, { color: active ? theme.brand.onPrimary : theme.text.secondary }]}>
                  {kindLabel(k)}
                </Text>
              </Pressable>
            )
          })}
        </View>
        <TextInput
          value={content}
          onChangeText={setContent}
          placeholder={t.ai_memory_placeholder}
          placeholderTextColor={theme.text.muted}
          multiline
          maxLength={280}
          style={[styles.input, { color: theme.text.primary, backgroundColor: theme.bg.secondary, borderColor: theme.border.subtle }]}
        />
        <View style={styles.formActions}>
          {editingId ? (
            <Pressable onPress={resetForm} style={[styles.secondaryBtn, { borderColor: theme.border.strong }]}>
              <Text style={[styles.secondaryBtnText, { color: theme.text.secondary }]}>{t.cancel}</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={onSubmit}
            disabled={!content.trim() || busy}
            style={[styles.primaryBtn, { backgroundColor: theme.brand.primary, opacity: !content.trim() || busy ? 0.5 : 1 }]}
          >
            {busy ? (
              <ActivityIndicator color={theme.brand.onPrimary} size="small" />
            ) : (
              <Text style={[styles.primaryBtnText, { color: theme.brand.onPrimary }]}>{editingId ? t.ai_memory_update : t.ai_memory_add}</Text>
            )}
          </Pressable>
        </View>
      </View>

      {/* List */}
      {entries.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="bookmark" size={28} color={theme.text.muted} />
          <Text style={[styles.emptyText, { color: theme.text.muted }]}>{t.ai_memory_empty}</Text>
        </View>
      ) : (
        <View style={[styles.card, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
          {entries.map((entry, i) => (
            <Pressable
              key={entry.id}
              onPress={() => onEdit(entry)}
              style={({ pressed }) => [
                styles.entryRow,
                { borderColor: theme.border.subtle, backgroundColor: pressed ? theme.bg.secondary : theme.bg.elevated },
                i === entries.length - 1 && styles.entryRowLast,
              ]}
            >
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[styles.entryKind, { color: theme.brand.primary }]}>{kindLabel(entry.kind).toUpperCase()}</Text>
                <Text style={[styles.entryContent, { color: theme.text.primary }]}>{entry.content}</Text>
              </View>
              <Pressable hitSlop={10} onPress={() => onDelete(entry)} style={styles.deleteBtn}>
                <Feather name="trash-2" size={18} color={theme.text.muted} />
              </Pressable>
            </Pressable>
          ))}
        </View>
      )}

      {/* Data management (Cross-Module Rule 1) */}
      <View style={[styles.card, { backgroundColor: theme.bg.elevated, borderColor: theme.border.subtle }]}>
        <View style={[styles.manageRow, { borderColor: theme.border.subtle }]}>
          <View style={{ flex: 1, paddingRight: spacing[3] }}>
            <Text style={[styles.manageLabel, { color: theme.text.primary }]}>{t.sync_data}</Text>
            <Text style={[styles.manageHint, { color: theme.text.muted }]}>{t.sync_data_hint}</Text>
          </View>
          <Switch
            value={syncContext}
            onValueChange={(next) => { void setSyncContext(next) }}
            trackColor={{ false: '#D1D5DB', true: '#34C759' }}
            thumbColor="#FFFFFF"
            ios_backgroundColor="#D1D5DB"
          />
        </View>
        <Pressable
          onPress={onExport}
          style={({ pressed }) => [styles.manageRow, { borderColor: theme.border.subtle, backgroundColor: pressed ? theme.bg.secondary : theme.bg.elevated }]}
        >
          <View style={{ flex: 1, paddingRight: spacing[3] }}>
            <Text style={[styles.manageLabel, { color: theme.text.primary }]}>{t.ai_memory_export}</Text>
            <Text style={[styles.manageHint, { color: theme.text.muted }]}>{t.ai_memory_export_hint}</Text>
          </View>
          <Feather name="share" size={18} color={theme.text.muted} />
        </Pressable>
        <Pressable
          onPress={onWipe}
          style={({ pressed }) => [styles.manageRow, styles.manageRowLast, { borderColor: theme.border.subtle, backgroundColor: pressed ? theme.bg.secondary : theme.bg.elevated }]}
        >
          <View style={{ flex: 1, paddingRight: spacing[3] }}>
            <Text style={[styles.manageLabel, { color: theme.text.danger }]}>{t.ai_memory_delete_all}</Text>
            <Text style={[styles.manageHint, { color: theme.text.muted }]}>{t.ai_memory_delete_all_hint}</Text>
          </View>
        </Pressable>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { padding: spacing[4], gap: spacing[3] },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing[4],
  },
  noteText: { flex: 1, fontSize: 13, lineHeight: 19 },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  kindRow: { flexDirection: 'row', gap: spacing[2], padding: spacing[3], paddingBottom: 0 },
  kindChip: {
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: radius.full,
    borderWidth: 1,
  },
  kindChipText: { fontSize: 13, fontWeight: '600' },
  input: {
    margin: spacing[3],
    minHeight: 64,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing[3],
    fontSize: 15,
    textAlignVertical: 'top',
  },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing[2], paddingHorizontal: spacing[3], paddingBottom: spacing[3] },
  primaryBtn: {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[5],
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 96,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  secondaryBtn: {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: { fontSize: 15, fontWeight: '600' },
  empty: { alignItems: 'center', gap: spacing[2], paddingVertical: spacing[6] },
  emptyText: { fontSize: 13, textAlign: 'center', maxWidth: 280, lineHeight: 19 },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[3],
    padding: spacing[4],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  entryRowLast: { borderBottomWidth: 0 },
  entryKind: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  entryContent: { fontSize: 15, lineHeight: 21 },
  deleteBtn: { padding: spacing[1] },
  manageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  manageRowLast: { borderBottomWidth: 0 },
  manageLabel: { fontSize: 15, fontWeight: '600' },
  manageHint: { fontSize: 12, lineHeight: 18, marginTop: 2 },
})
