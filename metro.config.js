const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

config.resolver.assetExts.push('wasm')

// @supabase/supabase-js@2.106 ships an OpenTelemetry tracing loader that uses a
// bare dynamic `import(OTEL_PKG)` in its ESM build (dist/index.mjs). Hermes — the
// engine Expo Go runs — can't parse dynamic import() with a non-literal specifier
// ("Invalid expression encountered"), so the bundle crashes on QR-scan/launch.
// The CJS build (dist/index.cjs) uses `require(s)` instead, which Hermes accepts.
// Force resolution of just this package to CJS by disabling package "exports"
// (which otherwise picks the `import` condition → the .mjs file) for it alone.
const defaultResolveRequest = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@supabase/supabase-js') {
    return context.resolveRequest(
      { ...context, unstable_enablePackageExports: false },
      moduleName,
      platform,
    )
  }
  return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform)
}

config.server = config.server || {}
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  return middleware(req, res, next)
}

module.exports = config
