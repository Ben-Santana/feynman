import { useSyncExternalStore } from 'react'
import { getDisplayPreferences, subscribeDisplayPreferences } from './displayPreferences.ts'

export function useDisplayPreferences() {
  return useSyncExternalStore(subscribeDisplayPreferences, getDisplayPreferences, getDisplayPreferences)
}
