export const characterColors = [
  { id: 'red', name: 'Original red', hex: '#e8483f' },
  { id: 'coral', name: 'Coral', hex: '#e8663f' },
  { id: 'peach', name: 'Orange', hex: '#e8943f' },
  { id: 'butter', name: 'Mustard', hex: '#d8b358' },
  { id: 'mint', name: 'Sage', hex: '#70ad81' },
  { id: 'sky', name: 'Blue', hex: '#3fa4e8' },
  { id: 'lavender', name: 'Lavender', hex: '#a17bc4' },
  { id: 'rose', name: 'Dusty rose', hex: '#d47796' },
  { id: 'graphite', name: 'Graphite', hex: '#62666b' },
] as const
export const characterShapes = [
  { id: 'hexagon', name: 'Hexagon', family: 'Geometric', pin: [-43, 56] },
  { id: 'circle', name: 'Circle', family: 'Geometric', pin: [-43, 56] },
  { id: 'square', name: 'Rounded square', family: 'Geometric', pin: [-53, 57] },
  { id: 'squircle', name: 'Squircle', family: 'Geometric', pin: [-49, 57] },
  { id: 'triangle', name: 'Soft triangle', family: 'Geometric', pin: [-43, 65] },
  { id: 'blob', name: 'Blob', family: 'Playful', pin: [-43, 56] },
  { id: 'cloud', name: 'Cloud', family: 'Playful', pin: [-65, -30] },
  { id: 'flower', name: 'Flower', family: 'Playful', pin: [-38, 54] },
  { id: 'star', name: 'Soft star', family: 'Playful', pin: [-40, 56] },
] as const
export const accessorySlots = [
  { id: 'glasses', name: 'Glasses' }, { id: 'face', name: 'Face details' }, { id: 'pin', name: 'Body pins' },
] as const
export type AccessorySlot = typeof accessorySlots[number]['id']
export const accessories = [
  { id: 'round', name: 'Round specs', slot: 'glasses' },
  { id: 'square-specs', name: 'Square specs', slot: 'glasses' },
  { id: 'monocle', name: 'Monocle', slot: 'glasses' },
  { id: 'blush', name: 'Rosy cheeks', slot: 'face' },
  { id: 'freckles', name: 'Freckles', slot: 'face' },
  { id: 'moustache', name: 'Tiny moustache', slot: 'face' },
  { id: 'star-pin', name: 'Star pin', slot: 'pin' },
  { id: 'heart-pin', name: 'Heart pin', slot: 'pin' },
  { id: 'flower-pin', name: 'Flower pin', slot: 'pin' },
] as const satisfies readonly { id: string; name: string; slot: AccessorySlot }[]
export type AccessoryId = typeof accessories[number]['id']
export type CharacterAppearance = {
  name: string
  color: typeof characterColors[number]['id']
  shape: typeof characterShapes[number]['id']
  accessories: Record<AccessorySlot, AccessoryId | null>
}
export const defaultAppearance: CharacterAppearance = {
  name: 'Feynman',
  color: 'red', shape: 'hexagon',
  accessories: { glasses: null, face: null, pin: null },
}
export const APPEARANCE_KEY = 'feynman.character.v1'
export function normalizeCharacterName(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\p{Cc}/gu, '').trim().slice(0, 32) || defaultAppearance.name : defaultAppearance.name
}
export function normalizeAppearance(value: unknown): CharacterAppearance {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const equipped = source.accessories && typeof source.accessories === 'object' ? source.accessories as Record<string, unknown> : {}
  return {
    name: normalizeCharacterName(source.name),
    color: source.color === 'periwinkle' ? 'graphite' : characterColors.find(item => item.id === source.color)?.id ?? defaultAppearance.color,
    shape: characterShapes.find(item => item.id === source.shape)?.id ?? defaultAppearance.shape,
    accessories: Object.fromEntries(accessorySlots.map(slot => [slot.id,
      accessories.find(item => item.id === equipped[slot.id] && item.slot === slot.id)?.id ?? null,
    ])) as CharacterAppearance['accessories'],
  }
}
export function equipAccessory(appearance: CharacterAppearance, slot: AccessorySlot, id: AccessoryId | null): CharacterAppearance {
  const valid = accessories.find(item => item.id === id && item.slot === slot)
  return { ...appearance, accessories: { ...appearance.accessories, [slot]: valid?.id ?? null } }
}
export function loadAppearance(): CharacterAppearance {
  try {
    const record = JSON.parse(localStorage.getItem(APPEARANCE_KEY) ?? 'null')
    return record?.version === 1 ? normalizeAppearance(record.appearance) : normalizeAppearance(null)
  } catch { return normalizeAppearance(null) }
}
export function saveAppearance(appearance: CharacterAppearance): CharacterAppearance {
  const normalized = normalizeAppearance(appearance)
  localStorage.setItem(APPEARANCE_KEY, JSON.stringify({ version: 1, appearance: normalized }))
  return normalized
}
