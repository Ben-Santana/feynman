export const courseBannerPresets = [
  { id: 'red', name: 'Red' },
  { id: 'coral', name: 'Coral' },
  { id: 'peach', name: 'Orange' },
  { id: 'butter', name: 'Mustard' },
  { id: 'mint', name: 'Sage' },
  { id: 'sky', name: 'Blue' },
  { id: 'lavender', name: 'Lavender' },
  { id: 'rose', name: 'Dusty rose' },
  { id: 'graphite', name: 'Graphite' },
] as const
export type CourseBannerPreset = typeof courseBannerPresets[number]['id']
export type CourseBanner = { type: 'none' } | { type: 'preset'; preset: CourseBannerPreset } | { type: 'image'; path: string }
export const defaultCourseBanner: CourseBanner = { type: 'preset', preset: 'mint' }
export function courseBannerClass(banner?: CourseBanner) {
  return banner?.type === 'none' ? 'course-cover-none' : banner?.type === 'image' ? 'course-cover-image' : `course-cover-${banner?.preset ?? 'mint'}`
}

export function validateCourseBannerFile(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG, or WebP image.')
  if (file.size > 5_000_000) throw new Error('Choose an image smaller than 5 MB.')
}
