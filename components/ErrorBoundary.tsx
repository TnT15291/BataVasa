import React from 'react'
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native'
import * as Sentry from '@sentry/react-native'

type Props = { children: React.ReactNode }
type State = { hasError: boolean; message: string; stack: string }

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, message: '', stack: '' }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message ? String(error.message) : String(error),
      stack: '',
    }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Surface the component stack on-device in dev so the failing screen is
    // identifiable without a remote logger (Cross-Module Rule 8).
    this.setState({ stack: info.componentStack ?? '' })
    try {
      Sentry.captureException(error, { extra: { componentStack: info.componentStack ?? '' } })
    } catch {}
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          {this.state.message ? (
            <Text style={styles.message}>{this.state.message}</Text>
          ) : (
            <Text style={styles.body}>An unexpected error occurred.</Text>
          )}
          {__DEV__ && this.state.stack ? (
            <ScrollView style={styles.stackBox} contentContainerStyle={styles.stackContent}>
              <Text style={styles.stack}>{this.state.stack.trim()}</Text>
            </ScrollView>
          ) : null}
          <Pressable
            style={styles.btn}
            onPress={() => this.setState({ hasError: false, message: '', stack: '' })}
          >
            <Text style={styles.btnText}>Try again</Text>
          </Pressable>
        </View>
      )
    }
    return this.props.children
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#0f0f0f' },
  title: { color: '#ff4d4f', fontSize: 18, fontWeight: '600', marginBottom: 8 },
  body: { color: '#888', textAlign: 'center', marginBottom: 24, fontSize: 14 },
  message: { color: '#ffb4b4', textAlign: 'center', marginBottom: 16, fontSize: 14, fontWeight: '500' },
  stackBox: { maxHeight: 220, alignSelf: 'stretch', marginBottom: 24, backgroundColor: '#1a1a1a', borderRadius: 8 },
  stackContent: { padding: 12 },
  stack: { color: '#9aa', fontSize: 11, fontFamily: 'monospace' },
  btn: { backgroundColor: '#333', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  btnText: { color: '#fff', fontWeight: '600' },
})
