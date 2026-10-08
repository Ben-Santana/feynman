import { useEffect, useRef, useState } from 'react'
import { MathfieldElement } from 'mathlive'
import 'mathlive/fonts.css'

MathfieldElement.soundsDirectory = null
MathfieldElement.fontsDirectory = null

export default function EquationEditor({ initial, display: initialDisplay, onApply, onCancel }: {
  initial: string; display: boolean; onApply: (latex: string, display: boolean) => void; onCancel: () => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const field = useRef<MathfieldElement | null>(null)
  const [empty, setEmpty] = useState(!initial.trim())
  const [display, setDisplay] = useState(initialDisplay)
  const apply = useRef(onApply)
  const displayRef = useRef(display)
  useEffect(() => { apply.current = onApply; displayRef.current = display }, [onApply, display])
  useEffect(() => {
    const math = new MathfieldElement()
    math.setAttribute('aria-label', 'Equation')
    math.mathVirtualKeyboardPolicy = 'manual'
    math.smartFence = true
    math.smartSuperscript = true
    math.defaultMode = 'math'
    math.value = initial
    const input = () => setEmpty(!math.value.trim())
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        event.preventDefault(); event.stopPropagation()
        if (math.value.trim()) apply.current(math.value, displayRef.current)
      }
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onCancel() }
    }
    math.addEventListener('input', input)
    math.addEventListener('keydown', keydown)
    host.current?.append(math)
    field.current = math
    math.focus()
    return () => { math.removeEventListener('input', input); math.removeEventListener('keydown', keydown); math.remove(); field.current = null }
  }, [initial, onCancel])
  function insert(latex: string) { field.current?.insert(latex); field.current?.focus(); setEmpty(!field.current?.value.trim()) }
  return <section className="equation-editor" aria-label="Equation editor">
    <div className="equation-tools" aria-label="Equation symbols">
      <button type="button" onClick={() => insert('\\frac{#?}{#?}')} aria-label="Insert fraction">a/b</button>
      <button type="button" onClick={() => insert('^{#?}')} aria-label="Insert exponent">x²</button>
      <button type="button" onClick={() => insert('\\sqrt{#?}')} aria-label="Insert square root">√</button>
      <button type="button" onClick={() => insert('_{#?}')} aria-label="Insert subscript">xₙ</button>
      <button type="button" onClick={() => insert('\\pi')} aria-label="Insert pi">π</button>
      <button type="button" onClick={() => insert('\\angle')} aria-label="Insert phasor angle">∠</button>
    </div>
    <div ref={host} className="equation-field" />
    <p className="equation-hint">Type / for a fraction, ^ for a power, or sqrt for a root. Use arrow keys to move through your equation.</p>
    <div className="equation-actions">
      <label><input type="checkbox" checked={display} onChange={event => setDisplay(event.target.checked)} /> On its own line</label>
      <button type="button" onClick={onCancel}>Cancel</button>
      <button type="button" disabled={empty} onClick={() => field.current && onApply(field.current.value, display)}>{initial ? 'Update equation' : 'Insert equation'}</button>
    </div>
  </section>
}
