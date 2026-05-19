import { useRef, useEffect, useState } from 'react'
import { Pressable, Animated, StyleSheet, ActivityIndicator, Alert, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@design/useTheme'
import { useTranslation } from '@services/i18n'
import { useSettingsStore } from '@store/settingsStore'
import { hapticVoiceStart, hapticVoiceStop } from '@services/haptics'
import {
  requestMicPermission,
  startRecording,
  stopRecording,
  transcribeAudio,
  hasVoiceKey,
} from '@services/voice'

type State = 'idle' | 'recording' | 'transcribing'

type Props = {
  onResult: (text: string) => void
  disabled?: boolean
  size?: number
}

function WaveformBars({ color, size }: { color: string; size: number }) {
  const barHeight = size * 0.42
  const b1 = useRef(new Animated.Value(0.35)).current
  const b2 = useRef(new Animated.Value(0.65)).current
  const b3 = useRef(new Animated.Value(0.45)).current

  useEffect(() => {
    const animate = (val: Animated.Value, toHigh: number, duration: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(val, { toValue: toHigh, duration, useNativeDriver: false }),
          Animated.timing(val, { toValue: 0.25, duration, useNativeDriver: false }),
        ])
      )

    const a1 = animate(b1, 0.75, 380)
    const a2 = animate(b2, 1.0, 280)
    const a3 = animate(b3, 0.6, 340)
    a1.start(); a2.start(); a3.start()
    return () => { a1.stop(); a2.stop(); a3.stop() }
  }, [])

  const barW = Math.max(2, size * 0.085)
  const gap = Math.max(2, size * 0.075)

  return (
    <View style={styles.waveform}>
      {[b1, b2, b3].map((anim, i) => (
        <Animated.View
          key={i}
          style={{
            width: barW,
            height: anim.interpolate({ inputRange: [0, 1], outputRange: [2, barHeight] }),
            backgroundColor: color,
            borderRadius: barW / 2,
            marginHorizontal: gap / 2,
          }}
        />
      ))}
    </View>
  )
}

export function VoiceButton({ onResult, disabled, size = 36 }: Props) {
  const theme = useTheme()
  const { t } = useTranslation()
  const language = useSettingsStore((s) => s.language)
  const [state, setState] = useState<State>('idle')
  const scaleAnim = useRef(new Animated.Value(1)).current
  const animRef = useRef<Animated.CompositeAnimation | null>(null)

  useEffect(() => {
    if (state === 'recording') {
      animRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, { toValue: 1.08, duration: 600, useNativeDriver: true }),
          Animated.timing(scaleAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      )
      animRef.current.start()
    } else {
      animRef.current?.stop()
      scaleAnim.setValue(1)
    }
    return () => animRef.current?.stop()
  }, [state])

  const handlePress = async () => {
    if (disabled || state === 'transcribing') return

    if (state === 'recording') {
      setState('transcribing')
      void hapticVoiceStop()
      const uri = await stopRecording()
      if (!uri) { setState('idle'); return }
      const text = await transcribeAudio(uri, language)
      setState('idle')
      if (text) {
        onResult(text)
      } else {
        Alert.alert(t.ai_error, t.parse_failed)
      }
      return
    }

    const keyOk = await hasVoiceKey()
    if (!keyOk) {
      Alert.alert(t.no_api_key, t.voice_no_key)
      return
    }
    const granted = await requestMicPermission()
    if (!granted) {
      Alert.alert('', t.mic_denied)
      return
    }
    try {
      await startRecording()
      void hapticVoiceStart()
      setState('recording')
    } catch {
      Alert.alert(t.ai_error, t.parse_failed)
    }
  }

  const isRecording = state === 'recording'
  const bgColor = isRecording ? theme.brand.primary : theme.bg.elevated
  const iconColor = isRecording ? '#fff' : theme.brand.primary
  const borderColor = isRecording ? theme.brand.primary : theme.border.strong

  return (
    <Pressable onPress={handlePress} disabled={disabled} hitSlop={8}>
      <Animated.View
        style={[
          styles.btn,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: bgColor,
            borderColor,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {state === 'transcribing' ? (
          <ActivityIndicator size="small" color={theme.brand.primary} />
        ) : isRecording ? (
          <WaveformBars color={iconColor} size={size} />
        ) : (
          <Ionicons name="mic" size={size * 0.52} color={iconColor} />
        )}
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
