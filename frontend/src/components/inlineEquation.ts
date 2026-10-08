import { MathfieldElement } from 'mathlive'
import 'mathlive/fonts.css'

MathfieldElement.soundsDirectory = null
MathfieldElement.fontsDirectory = null

export function createEquationField(initial: string): MathfieldElement {
  // Use the registered element constructor, including across Vite hot reloads.
  const math = document.createElement('math-field') as MathfieldElement
  math.setAttribute('aria-label', 'Equation')
  math.mathVirtualKeyboardPolicy = 'manual'
  math.smartFence = true
  math.smartSuperscript = true
  math.defaultMode = 'math'
  math.placeholder = 'E = mc^2'
  math.value = initial.trim()
  return math
}
