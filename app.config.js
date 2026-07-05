const appJson = require('./app.json')

const GOOGLE_PLUGIN = '@react-native-google-signin/google-signin'
const ASSET_PLUGIN = 'expo-asset'
const IOS_CLIENT_SUFFIX = '.apps.googleusercontent.com'

function googleIosUrlScheme() {
  if (process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME) {
    return process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME
  }

  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
  if (iosClientId && iosClientId.endsWith(IOS_CLIENT_SUFFIX)) {
    return `com.googleusercontent.apps.${iosClientId.slice(0, -IOS_CLIENT_SUFFIX.length)}`
  }

  return null
}

const config = {
  ...appJson.expo,
  plugins: (appJson.expo.plugins ?? []).filter((plugin) => {
    return Array.isArray(plugin) ? plugin[0] !== GOOGLE_PLUGIN : plugin !== GOOGLE_PLUGIN
  }),
}

if (!config.plugins.some((plugin) => Array.isArray(plugin) ? plugin[0] === ASSET_PLUGIN : plugin === ASSET_PLUGIN)) {
  config.plugins.push(ASSET_PLUGIN)
}

const iosUrlScheme = googleIosUrlScheme()
if (iosUrlScheme) {
  config.plugins.push([GOOGLE_PLUGIN, { iosUrlScheme }])
}

module.exports = { expo: config }
