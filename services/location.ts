import { Platform } from 'react-native'
import * as Location from 'expo-location'
import { logger } from './logger'

export type LocationFix = {
  lat: number
  lng: number
  label: string | null
}

// All paths return null on denial / unavailable / error — never throw.

export async function requestLocationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') {
    // Web permission is implicit at fetch time. Return true; getCurrentLocation will handle denial.
    return typeof navigator !== 'undefined' && 'geolocation' in navigator
  }
  try {
    const { status } = await Location.requestForegroundPermissionsAsync()
    return status === 'granted'
  } catch (e) {
    logger.warn('location', 'permission request failed', { error: String(e) })
    return false
  }
}

export async function getCurrentLocation(): Promise<LocationFix | null> {
  if (Platform.OS === 'web') return getCurrentLocationWeb()
  return getCurrentLocationNative()
}

async function getCurrentLocationNative(): Promise<LocationFix | null> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync()
    if (status !== 'granted') {
      const req = await Location.requestForegroundPermissionsAsync()
      if (req.status !== 'granted') return null
    }
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
    const lat = pos.coords.latitude
    const lng = pos.coords.longitude
    const label = await reverseGeocode(lat, lng)
    return { lat, lng, label }
  } catch (e) {
    logger.warn('location', 'getCurrentLocation native failed', { error: String(e) })
    return null
  }
}

function getCurrentLocationWeb(): Promise<LocationFix | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      resolve(null)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: null })
      },
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 }
    )
  })
}

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  if (Platform.OS === 'web') return null // browser has no built-in reverse geocode
  try {
    const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng })
    const r = results[0]
    if (!r) return null
    // Compose a compact human label: street + district + city (filter falsy)
    return [r.name, r.street, r.district, r.city, r.region]
      .filter((p): p is string => !!p && p.trim().length > 0)
      .slice(0, 3)
      .join(', ')
  } catch (e) {
    logger.warn('location', 'reverseGeocode failed', { error: String(e) })
    return null
  }
}
