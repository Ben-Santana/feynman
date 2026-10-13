import type { AccessoryId } from '../characterAppearance'

// Shared local coordinates: eyewear is centered on the eye pair, face details
// sit beneath it, and pins use the body's anchor. Keep the art flat and rounded.
const ink = '#41404B'
const heart = 'M0 15C-5 12-17 4-17-5C-17-16-5-19 0-10C5-19 17-16 17-5C17 4 5 12 0 15Z'
const star = 'M-4-15Q0-23 4-15L8-7L17-5Q26-3 19 3L12 9L13 18Q14 27 6 22L0 18L-6 22Q-14 27-13 18L-12 9L-19 3Q-26-3-17-5L-8-7Z'

function Temples({ color = ink }: { color?: string }) {
  return <g stroke={color} strokeWidth="4" fill="none"><path d="M-54-5-60-8M54-5 60-8" /><path d="M-5-4Q0-9 5-4" /></g>
}

export function AccessoryArtwork({ id }: { id: AccessoryId }) {
  switch (id) {
    case 'round': return <g fill="none" stroke={ink} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round">
      <Temples /><circle cx="-29" r="26" /><circle cx="29" r="26" />
    </g>
    case 'square-specs': return <g fill="none" stroke={ink} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round">
      <Temples /><rect x="-57" y="-26" width="55" height="52" rx="18" /><rect x="2" y="-26" width="55" height="52" rx="18" />
    </g>
    case 'monocle': return <g fill="none" stroke="#B59B69" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="29" r="26" strokeWidth="3.5" /><path d="M48 19C57 33 56 48 46 58" strokeWidth="2" />
    </g>
    case 'blush': return <g fill="#F5BCAF"><ellipse cx="-32" cy="31" rx="11" ry="6" /><ellipse cx="32" cy="31" rx="11" ry="6" /></g>
    case 'freckles': return <g fill="#FFE5CB">
      {[-1, 1].map(side => <g key={side}><circle cx={side * 25} cy="30" r="2.3" /><circle cx={side * 32} cy="27" r="2.3" /><circle cx={side * 39} cy="31" r="2.3" /></g>)}
    </g>
    case 'moustache': return <path d="M0 33C-5 24-11 29-17 32C-21 34-24 33-26 30C-26 43-10 45 0 37C10 45 26 43 26 30C24 33 21 34 17 32C11 29 5 24 0 33Z" transform="scale(.85 1)" fill={ink} />
    case 'star-pin': return <path d={star} fill="#F2D394" />
    case 'heart-pin': return <path d={heart} fill="#EFC0C6" />
    case 'flower-pin': return <g><path d="M-5-11C-12-26-28-13-16-3C-34 0-25 21-10 14C-13 33 11 33 9 14C24 24 36 4 18-2C33-14 13-29 5-13Q0-5-5-11Z" transform="scale(.8)" fill="#CEBFDF" /><circle r="5" fill="#F2D394" /></g>
  }
}

export function AccessoryThumbnail({ id }: { id: AccessoryId }) {
  const face = ['blush', 'freckles', 'moustache'].includes(id)
  const pin = id.endsWith('-pin')
  return <svg viewBox={face ? '-55 12 110 44' : pin ? '-30 -30 60 60' : id === 'monocle' ? '-6 -34 78 100' : '-72 -38 144 76'} aria-hidden="true"><AccessoryArtwork id={id} /></svg>
}
