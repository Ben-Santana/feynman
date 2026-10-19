export type SettingsCategory = 'profile' | 'display' | 'ai'

const settings = {
  displayName: { category: 'profile', terms: 'profile personal details display name nickname' },
  email: { category: 'profile', terms: 'profile personal details email address sign-in account' },
  password: { category: 'profile', terms: 'profile sign-in security new password passwords show confirm authentication credentials WPI single sign-on' },
  accountDetails: { category: 'profile', terms: 'profile account overview type role admin student instructor member since created last sign-in method' },
  darkMode: { category: 'display', terms: 'display appearance theme dark light mode night colors' },
  fontSize: { category: 'display', terms: 'display text font size sizing small default large extra reading accessibility' },
  fontFamily: { category: 'display', terms: 'display text font family typeface sans serif Arial Georgia reading accessibility' },
  boldWordStarts: { category: 'display', terms: 'display text reading bold word beginnings bionic dyslexia dyslexic friendly accessibility' },
  provider: { category: 'ai', terms: 'ai settings provider ChatGPT OpenAI Claude Anthropic API key plan' },
  accounts: { category: 'ai', terms: 'ai settings ChatGPT OpenAI accounts connection connect add remove sign-in' },
  model: { category: 'ai', terms: 'ai settings model default ChatGPT OpenAI Claude Anthropic' },
  usage: { category: 'ai', terms: 'ai settings usage plan limits billing API key' },
} satisfies Record<string, { category: SettingsCategory; terms: string }>

export type SettingId = keyof typeof settings

export function matchesSetting(id: SettingId, query: string) {
  const terms = settings[id].terms.toLowerCase()
  return query.toLowerCase().trim().split(/\s+/).every(word => terms.includes(word))
}

export function matchingSettings(category: SettingsCategory, query: string) {
  return (Object.keys(settings) as SettingId[]).filter(id => settings[id].category === category && matchesSetting(id, query))
}
