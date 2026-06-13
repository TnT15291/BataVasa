import { useEffect, useRef, useState } from 'react'
import { Pressable, Text, View, StyleSheet, TextInput, ActivityIndicator } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useTheme } from '@design/useTheme'
import { useTranslation } from '@services/i18n'
import { spacing, radius } from '@design/tokens'
import { getCurrentLocation, type LocationFix } from '@services/location'

export type LocationValue = {
  lat: number | null
  lng: number | null
  label: string
}

type Props = {
  value: LocationValue
  onChange: (next: LocationValue) => void
  autoFetch: boolean
  label?: string
}

export const EMPTY_LOCATION: LocationValue = { lat: null, lng: null, label: '' }

export function LocationRow({ value, onChange, autoFetch, label }: Props) {
  const theme = useTheme()
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [fetching, setFetching] = useState(false)
  const hasAutoFetched = useRef(false)

  const displayLabel = label ?? (t as any).location ?? 'Location'

  useEffect(() => {
    if (!autoFetch || hasAutoFetched.current) return
    if (value.label || value.lat !== null) return
    hasAutoFetched.current = true
    let cancelled = false
    setFetching(true)
    getCurrentLocation()
      .then((fix: LocationFix | null) => {
        if (cancelled) return
        if (fix) {
          onChange({
            lat: fix.lat,
            lng: fix.lng,
            label: fix.label ?? `${fix.lat.toFixed(4)}, ${fix.lng.toFixed(4)}`,
          })
        }
      })
      .finally(() => {
        if (!cancelled) setFetching(false)
      })
    return () => {
      cancelled = true
    }
  }, [autoFetch, value.label, value.lat, onChange])

  const clear = () => {
    onChange(EMPTY_LOCATION)
    setEditing(false)
  }

  const onTextChange = (text: string) => {
    onChange({ ...value, label: text })
  }

  return (
    <View>
      {editing ? (
        <View style={[styles.editWrap, { borderColor: theme.border.strong, backgroundColor: theme.bg.elevated }]}>
          <Text style={[styles.label, { color: theme.text.muted }]}>{displayLabel}</Text>
          <TextInput
            value={value.label}
            onChangeText={onTextChange}
            autoFocus
            placeholder={(t as any).location_placeholder ?? 'Type a place name'}
            placeholderTextColor={theme.text.muted}
            onBlur={() => setEditing(false)}
            style={[styles.input, { color: theme.text.primary }]}
          />
        </View>
      ) : (
        <Pressable
          onPress={() => setEditing(true)}
          style={({ pressed }) => [
            styles.row,
            { backgroundColor: pressed ? theme.bg.secondary : theme.bg.elevated, borderColor: theme.border.subtle },
          ]}
        >
          <Feather name="map-pin" size={18} color={theme.brand.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: theme.text.muted }]}>{displayLabel}</Text>
            {fetching ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <ActivityIndicator size="small" color={theme.text.muted} />
                <Text style={[styles.placeholder, { color: theme.text.muted }]}>
                  {(t as any).fetching_location ?? 'Fetching…'}
                </Text>
              </View>
            ) : value.label ? (
              <Text style={[styles.value, { color: theme.text.primary }]} numberOfLines={1}>
                {value.label}
              </Text>
            ) : (
              <Text style={[styles.placeholder, { color: theme.text.muted }]}>
                {(t as any).location_empty ?? 'Tap to add'}
              </Text>
            )}
          </View>
          {value.label ? (
            <Pressable
              hitSlop={12}
              onPress={clear}
              accessibilityRole="button"
              accessibilityLabel={(t as any).cancel ?? 'Clear'}
              style={styles.clearBtn}
            >
              <Feather name="x" size={16} color={theme.text.muted} />
            </Pressable>
          ) : null}
        </Pressable>
      )}
    </View>
  )
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
  label: { fontSize: 12, fontWeight: '600' },
  value: { fontSize: 14, fontWeight: '500', marginTop: 2 },
  placeholder: { fontSize: 13, fontStyle: 'italic' },
  editWrap: {
    padding: spacing[3],
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing[2],
  },
  input: { fontSize: 15, padding: 0 },
  clearBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
