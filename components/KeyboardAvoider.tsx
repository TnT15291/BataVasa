import type { ReactNode } from 'react'
import { useContext } from 'react'
import { KeyboardAvoidingView, type StyleProp, type ViewStyle } from 'react-native'
import { HeaderHeightContext } from '@react-navigation/elements'

type Props = {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  /**
   * Override the auto-detected navigation header offset. Pass 0 for screens
   * not anchored under a header (e.g. a bottom-sheet modal).
   */
  offset?: number
}

/**
 * Keyboard-aware wrapper for every screen with text inputs. Centralizes the
 * fix for inputs hidden behind the keyboard:
 *  - `behavior` must be set on Android too — edge-to-edge (app.json) disables
 *    the OS window auto-resize, so an undefined behavior does nothing.
 *  - Screens rendered under a navigation header must offset by the header
 *    height, otherwise the avoided distance is wrong. We read it from context
 *    so the same component works on headerless screens (offset falls back to 0).
 */
export function KeyboardAvoider({ children, style, offset }: Props) {
  const headerHeight = useContext(HeaderHeightContext) ?? 0
  return (
    <KeyboardAvoidingView
      style={style}
      behavior="padding"
      keyboardVerticalOffset={offset ?? headerHeight}
    >
      {children}
    </KeyboardAvoidingView>
  )
}
