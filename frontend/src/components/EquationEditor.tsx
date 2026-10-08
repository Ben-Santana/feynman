import type { MathfieldElement } from 'mathlive'

const symbols = [
  { label: 'Fraction', symbol: 'a/b', latex: '\\frac{#0}{#?}' },
  { label: 'Power', symbol: 'x²', latex: '^{#?}' },
  { label: 'Root', symbol: '√', latex: '\\sqrt{#0}' },
  { label: 'Subscript', symbol: 'xₙ', latex: '_{#?}' },
  { label: 'Pi', symbol: 'π', latex: '\\pi' },
  { label: 'Angle', symbol: '∠', latex: '\\angle' },
]

export default function EquationTools({ field }: { field: MathfieldElement }) {
  return <div className="equation-tools" role="group" aria-label="Equation symbols">
    {symbols.map(({ label, symbol, latex }, index) => <button key={label} type="button" style={{ animationDelay: `${index * 28}ms` }} onMouseDown={event => event.preventDefault()} onClick={() => field.insert(latex, { selectionMode: 'placeholder', focus: true })} aria-label={`Insert ${label.toLowerCase()}`} title={label}><span aria-hidden="true">{symbol}</span><span>{label}</span></button>)}
  </div>
}
