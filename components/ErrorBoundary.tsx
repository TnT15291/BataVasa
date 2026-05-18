import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import * as Sentry from '@sentry/react-native'

type Props = { children: React.ReactNode }
type State = { hasError: boolean }

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    try {
      Sentry.captureException(error, { extra: { componentStack: info.componentStack ?? '' } })
    } catch {}
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.body}>An unexpected error occurred.</Text>
          <Pressable style={styles.btn} onPress={() => this.setState({ hasError: false })}>
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
  btn: { backgroundColor: '#333', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  btnText: { color: '#fff', fontWeight: '600' },
})
