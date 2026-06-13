import { useRef, useEffect, useState } from 'react'
import { Pressable, Animated, StyleSheet, ActivityIndicator, Alert, View, Linking } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@design/useTheme'
import { useTranslation } from '@services/i18n'
import { useSettingsStore } from '@store/settingsStore'
import { hapticVoiceStart, hapticVoiceStop } from '@services/haptics'
import { track } from '@services/analytics'
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
  module?: string
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

const MAX_RECORDING_MS = 120000

function confirmPermissionPrompt(
  title: string,
  message: string,
  cancel: string,
  next: string,
  dontShowAgain: string
): Promise<'cancel' | 'continue' | 'continue-and-hide'> {
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancel, style: 'cancel', onPress: () => resolve('cancel') },
      { text: dontShowAgain, onPress: () => resolve('continue-and-hide') },
      { text: next, onPress: () => resolve('continue') },
    ])
  })
}

export function VoiceButton({ onResult, disabled, size = 36, module = 'unknown' }: Props) {
  const theme = useTheme()
  const { t } = useTranslation()
  const language = useSettingsStore((s) => s.language)
  const hideMicPermissionPrompt = useSettingsStore((s) => s.hideMicPermissionPrompt)
  const setHideMicPermissionPrompt = useSettingsStore((s) => s.setHideMicPermissionPrompt)
  const [state, setState] = useState<State>('idle')
  const scaleAnim = useRef(new Animated.Value(1)).current
  const animRef = useRef<Animated.CompositeAnimation | null>(null)
  const recordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const recordingStartedAtRef = useRef<number | null>(null)

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

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current)
      void stopRecording()
    }
  }, [])

  const stopAndTranscribe = async () => {
    if (recordingTimerRef.current) {
      clearTimeout(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
    setState('transcribing')
    void hapticVoiceStop()
    const startedAt = recordingStartedAtRef.current
    recordingStartedAtRef.current = null
    const uri = await stopRecording()
    if (!uri) {
      track('voice_failed', { module, reason: 'empty_recording' })
      setState('idle')
      return
    }
    const result = await transcribeAudio(uri, language)
    setState('idle')
    if (result.ok) {
      track('voice_transcribed', { module, duration_ms: startedAt ? Date.now() - startedAt : undefined })
      onResult(result.text)
    } else if (result.reason === 'no_speech') {
      // Silence / no detectable speech — a soft nudge, not a system error.
      track('voice_failed', { module, reason: 'no_speech' })
      Alert.alert(t.voice_no_speech_title, t.voice_no_speech_msg, [
        { text: t.cancel, style: 'cancel' },
        { text: t.retry, onPress: () => { void handlePress() } },
      ])
    } else {
      track('voice_failed', { module, reason: 'transcribe_failed' })
      Alert.alert(t.ai_error, t.parse_failed, [
        { text: t.cancel, style: 'cancel' },
        { text: t.retry, onPress: () => { void handlePress() } },
      ])
    }
  }

  const handlePress = async () => {
    if (disabled || state === 'transcribing') return

    if (state === 'recording') {
      await stopAndTranscribe()
      return
    }

    const keyOk = await hasVoiceKey()
    if (!keyOk) {
      track('voice_failed', { module, reason: 'missing_key' })
      Alert.alert(t.no_api_key, t.voice_no_key)
      return
    }
    if (!hideMicPermissionPrompt) {
      const promptAction = await confirmPermissionPrompt(
        t.mic_permission_title,
        t.mic_permission_hint,
        t.cancel,
        t.onboarding_next,
        t.mic_permission_dont_show_again
      )
      if (promptAction === 'cancel') return
      if (promptAction === 'continue-and-hide') await setHideMicPermissionPrompt(true)
    }

    const granted = await requestMicPermission()
    if (!granted) {
      track('voice_failed', { module, reason: 'permission_denied' })
      Alert.alert(t.mic_permission_title, t.mic_denied, [
        { text: t.cancel, style: 'cancel' },
        { text: t.go_to_settings, onPress: () => { void Linking.openSettings() } },
      ])
      return
    }
    try {
      await startRecording()
      void hapticVoiceStart()
      track('voice_started', { module })
      recordingStartedAtRef.current = Date.now()
      recordingTimerRef.current = setTimeout(() => {
        track('voice_failed', { module, reason: 'recording_timeout' })
        Alert.alert(t.voice_timeout_title, t.voice_timeout_msg)
        void stopAndTranscribe()
      }, MAX_RECORDING_MS)
      setState('recording')
    } catch {
      track('voice_failed', { module, reason: 'recording_failed' })
      Alert.alert(t.ai_error, t.parse_failed)
    }
  }

  const isRecording = state === 'recording'
  const bgColor = isRecording ? theme.brand.primary : theme.bg.elevated
  const iconColor = isRecording ? '#fff' : theme.brand.primary
  const borderColor = isRecording ? theme.brand.primary : theme.border.strong

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={t.voice_input}
      accessibilityState={{ disabled: !!disabled, busy: state !== 'idle' }}
    >
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
