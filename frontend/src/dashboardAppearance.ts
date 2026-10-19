import { defaultAppearance, type CharacterAppearance } from './characterAppearance.ts'
import { courseBannerPresets } from './courseAppearance.ts'

export function dashboardBanner(color: CharacterAppearance['color']) {
  const preset = courseBannerPresets.some(preset => preset.id === color) ? color : defaultAppearance.color
  return { type: 'preset', preset } as const
}
