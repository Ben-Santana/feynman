import type { MathfieldElement } from 'mathlive'
import { TooltipButton } from './TooltipButton'

const symbols = [
  { label: 'Fraction', symbol: 'a/b', latex: '\\frac{#0}{#?}' },
  { label: 'Power', symbol: 'x²', latex: '^{#?}' },
  { label: 'Root', symbol: '√', latex: '\\sqrt{#0}' },
  { label: 'Subscript', symbol: 'xₙ', latex: '_{#?}' },
  { label: 'Pi', symbol: 'π', latex: '\\pi' },
  { label: 'Angle', symbol: '∠', latex: '\\angle' },
  { label: 'Parentheses', symbol: '( )', latex: '\\left(#0\\right)' },
  { label: 'Absolute value', symbol: '|x|', latex: '\\left|#0\\right|' },
  { label: 'Multiply', symbol: '×', latex: '\\times' },
  { label: 'Plus or minus', symbol: '±', latex: '\\pm' },
  { label: 'Not equal', symbol: '≠', latex: '\\ne' },
  { label: 'Less than or equal', symbol: '≤', latex: '\\le' },
  { label: 'Greater than or equal', symbol: '≥', latex: '\\ge' },
  { label: 'Theta', symbol: 'θ', latex: '\\theta' },
  { label: 'Degrees', symbol: '°', latex: '^{\\circ}' },
  { label: 'Logarithm', symbol: 'log', latex: '\\log_{#?}\\left(#0\\right)' },
  { label: 'Sum', symbol: 'Σ', latex: '\\sum_{#?}^{#?}#0' },
  { label: 'Integral', symbol: '∫', latex: '\\int #0\\,dx' },
]

export default function EquationTools({ field }: { field: MathfieldElement }) {
  return <div className="equation-tools" role="group" aria-label="Equation symbols">
    {symbols.map(({ label, symbol, latex }, index) => <TooltipButton key={label} type="button" tooltip={label} style={{ animationDelay: `${index * 28}ms` }} onMouseDown={event => event.preventDefault()} onClick={() => field.insert(latex, { selectionMode: 'placeholder', focus: true })} aria-label={`Insert ${label.toLowerCase()}`}><span aria-hidden="true">{symbol}</span></TooltipButton>)}
  </div>
}
