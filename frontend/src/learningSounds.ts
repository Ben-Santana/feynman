import type { Assessment } from './learningFlow'

type Reward = 'item' | 'level'

export function learningReward(previous: Assessment | null | undefined, next: Assessment | null): Reward | undefined {
  if (next?.complete) return 'level'
  const passed = new Set(previous?.criteria.filter(item => item.status === 'supported' && !item.skipped).map(item => item.aspect))
  if (next?.criteria.some(item => item.status === 'supported' && !item.skipped && !passed.has(item.aspect))) return 'item'
}

let audio: AudioContext | undefined

export function prepareLearningSounds() {
  try {
    audio ??= new AudioContext()
    if (audio.state !== 'running') void audio.resume().catch(() => {})
  } catch {
    // Audio may be unavailable or blocked by the browser.
  }
}

export function playLearningReward(reward: Reward | undefined) {
  if (!reward || audio?.state !== 'running') return
  const context = audio
  const start = context.currentTime + 0.015
  const notes = reward === 'level'
    ? [[523.25, 0, 0.23], [659.25, 0.10, 0.23], [783.99, 0.20, 0.30], [1046.50, 0.32, 0.52], [659.25, 0.32, 0.40]]
    : [[659.25, 0, 0.14], [880, 0.075, 0.23]]

  try {
    for (const [pitch, delay, duration] of notes) {
      const tone = context.createOscillator()
      const envelope = context.createGain()
      const time = start + delay
      tone.type = 'sine'
      tone.frequency.value = pitch
      envelope.gain.setValueAtTime(0, time)
      envelope.gain.linearRampToValueAtTime(reward === 'level' ? 0.085 : 0.065, time + 0.025)
      envelope.gain.exponentialRampToValueAtTime(0.001, time + duration)
      tone.connect(envelope).connect(context.destination)
      tone.onended = () => { tone.disconnect(); envelope.disconnect() }
      tone.start(time)
      tone.stop(time + duration)
    }
  } catch {
    // Sound is optional feedback and must not interrupt the turn.
  }
}
