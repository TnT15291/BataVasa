// Base module — resolved by TypeScript and bundled on web (Metro picks
// `googleAuth.native.ts` on iOS/Android). Web has no native Google Sign-In
// module; the OAuth browser-popup flow in authStore handles web, so these are
// "unavailable" stubs that make the caller fall back to that flow. Keeping the
// native module out of this file ensures it never enters the web bundle.

export type NativeGoogleResult =
  | { ok: true; idToken: string }
  | { ok: false; cancelled: true }
  | { ok: false; error: string }

export function isNativeGoogleAvailable(): boolean {
  return false
}

export function configureGoogleSignin(): void {
  // no-op on web
}

export async function nativeGoogleSignIn(): Promise<NativeGoogleResult> {
  return { ok: false, error: 'Native Google sign-in is not available on web' }
}

export async function nativeGoogleSignOut(): Promise<void> {
  // no-op on web
}
