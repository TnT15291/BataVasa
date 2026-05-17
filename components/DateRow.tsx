import { useState } from 'react'
import { Platform, Pressable, Text, View, StyleSheet, Modal } from 'react-native'
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { format } from 'date-fns'
import { useTheme } from '@design/useTheme'
import { useTranslation } from '@services/i18n'
import { spacing, radius } from '@design/tokens'

type Props = {
  value: Date
  onChange: (next: Date) => void
  label?: string
}

export function DateRow({ value, onChange, label }: Props) {
  const theme = useTheme()
  const { t } = useTranslation()
  const [showPicker, setShowPicker] = useState(false)
  const [mode, setMode] = useState<'date' | 'time'>('date')

  const displayLabel = label ?? (t as any).date ?? 'Date'
  const formatted = format(value, 'EEE, dd MMM yyyy · HH:mm')

  const handleNativeChange = (event: DateTimePickerEvent, selected?: Date) => {
    // Android closes the picker on selection; iOS keeps it open
    if (Platform.OS === 'android') setShowPicker(false)
    if (event.type === 'set' && selected) {
      onChange(selected)
      if (Platform.OS === 'android' && mode === 'date') {
        // chain to time picker on Android
        setMode('time')
        setTimeout(() => setShowPicker(true), 100)
      } else if (Platform.OS === 'android' && mode === 'time') {
        setMode('date')
      }
    } else if (event.type === 'dismissed') {
      setShowPicker(false)
      setMode('date')
    }
  }

  const open = () => {
    setMode('date')
    setShowPicker(true)
  }

  return (
    <View>
      <Pressable
        onPress={open}
        style={({ pressed }) => [
          styles.row,
          {
            backgroundColor: pressed ? theme.bg.secondary : theme.bg.elevated,
            borderColor: theme.border.subtle,
          },
        ]}
      >
        <Text style={[styles.icon]}>📅</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: theme.text.muted }]}>{displayLabel}</Text>
          <Text style={[styles.value, { color: theme.text.primary }]}>{formatted}</Text>
        </View>
      </Pressable>

      {showPicker && Platform.OS !== 'web' && (
        <DateTimePicker
          value={value}
          mode={mode}
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={handleNativeChange}
          maximumDate={new Date(Date.now() + 24 * 60 * 60 * 1000)}
        />
      )}

      {/* Web: use native datetime-local via a hidden input modal */}
      {showPicker && Platform.OS === 'web' && (
        <Modal transparent animationType="fade" onRequestClose={() => setShowPicker(false)}>
          <Pressable style={styles.webBackdrop} onPress={() => setShowPicker(false)}>
            <View
              style={[styles.webSheet, { backgroundColor: theme.bg.elevated }]}
              onStartShouldSetResponder={() => true}
            >
              <Text style={[styles.label, { color: theme.text.muted, marginBottom: spacing[2] }]}>
                {displayLabel}
              </Text>
              {/* eslint-disable-next-line react/no-unknown-property */}
              <input
                type="datetime-local"
                value={toLocalInput(value)}
                onChange={(e) => {
                  const v = (e.target as HTMLInputElement).value
                  if (v) onChange(fromLocalInput(v))
                }}
                style={{
                  padding: 12,
                  fontSize: 16,
                  border: `1px solid ${theme.border.strong}`,
                  borderRadius: 8,
                  background: theme.bg.secondary,
                  color: theme.text.primary,
                }}
              />
              <Pressable
                style={[styles.webDone, { backgroundColor: theme.brand.primary }]}
                onPress={() => setShowPicker(false)}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>OK</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      )}
    </View>
  )
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromLocalInput(s: string): Date {
  return new Date(s)
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[3],
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing[3],
  },
  icon: { fontSize: 18 },
  label: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  value: { fontSize: 14, fontWeight: '500', marginTop: 2 },
  webBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[6],
  },
  webSheet: {
    padding: spacing[4],
    borderRadius: radius.lg,
    minWidth: 280,
    gap: spacing[3],
  },
  webDone: {
    padding: spacing[3],
    borderRadius: radius.md,
    alignItems: 'center',
  },
})
