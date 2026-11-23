import type { CSSProperties } from 'react'
import { Bloub, type EmotionId } from './Bloub'
import type { CharacterAppearance } from '../characterAppearance'

// Visuals for the landing page story. Each one plays while its scene is on screen.

const levels = ['Remember', 'Understand', 'Apply', 'Analyze']
export function LevelsDiagram({ active }: { active: boolean }) {
  return <div className="diagram diagram-levels" data-active={active} aria-hidden="true">
    <div className="levels-steps">
      {levels.map((level, index) => <div key={level} className="levels-step" style={{ '--step': index } as CSSProperties}>
        <div className="levels-bar" style={{ height: `${(index + 1) * 25}%` }} />
        <span className="levels-label">{level}</span>
      </div>)}
    </div>
  </div>
}

type CastMember = { appearance: CharacterAppearance; expression: EmotionId; x: number; y: number; size: number; tilt: number }
// Positions are percentages of the cast area; members overlap in a loose fan.
const cast: CastMember[] = [
  { appearance: { name: 'Sky', color: 'sky', shape: 'circle', accessories: { glasses: 'round', face: null, pin: null } }, expression: 'attentive', x: 0, y: 34, size: 33, tilt: -10 },
  { appearance: { name: 'Fern', color: 'mint', shape: 'flower', accessories: { glasses: null, face: 'blush', pin: null } }, expression: 'excited', x: 19, y: 4, size: 36, tilt: 7 },
  { appearance: { name: 'Ada', color: 'lavender', shape: 'squircle', accessories: { glasses: 'square-specs', face: null, pin: 'star-pin' } }, expression: 'neutral', x: 37, y: 30, size: 38, tilt: -3 },
  { appearance: { name: 'Pip', color: 'butter', shape: 'star', accessories: { glasses: null, face: 'freckles', pin: null } }, expression: 'confused', x: 60, y: 2, size: 32, tilt: 12 },
  { appearance: { name: 'Nimbus', color: 'graphite', shape: 'cloud', accessories: { glasses: 'monocle', face: 'moustache', pin: null } }, expression: 'wary', x: 64, y: 40, size: 35, tilt: -7 },
]
// Uneven offsets so no two classmates blink together. The idle loop plays forward then back (~5.9 s),
// so offsets are also kept apart from each other's mirrored times.
const blinkOffsets = [0, 700, 1500, 2600, 4100]
export function CastDiagram({ active, mounted }: { active: boolean; mounted: boolean }) {
  return <div className="diagram diagram-cast" data-active={active} aria-hidden="true">
    {mounted && cast.map(({ appearance, expression, x, y, size, tilt }, index) => <div key={appearance.name} className="cast-member" style={{ '--x': `${x}%`, '--y': `${y}%`, '--size': `${size}%`, '--tilt': `${tilt}deg`, '--member': index, zIndex: index === 2 ? 6 : index + 1 } as CSSProperties}>
      <Bloub mode="hero" expression={expression} appearance={appearance} idleOffset={blinkOffsets[index]} />
    </div>)}
  </div>
}
