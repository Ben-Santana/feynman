// Format recognizable equations from older plain-text rubrics for display only.
// Stored checklist text stays unchanged so assessment matching still uses the original.
const variable = String.raw`[A-Za-zα-ωΑ-Ω](?:['′])?(?:_\{?[A-Za-z0-9]+\}?)?(?:\([^()\n]*\))?(?:\^\{?[A-Za-z0-9+-]+\}?)?`
const atom = String.raw`(?:${variable}|\d+(?:\.\d+)?)`
const product = String.raw`(?:${atom}){1,3}`
const expression = new RegExp(String.raw`(?<![\w\\])${product}(?:\s*[=<>≤≥≠≈⇔±+−*/^–-]\s*${product})+(?![\w])`, 'gu')

export function rubricMath(text: string): string {
  // Keep explicit math and code untouched. Also accept common alternate LaTeX delimiters.
  return text.split(/(\$\$[\s\S]*?\$\$|\$(?!\$)[^$\n]+\$|`[^`\n]*`|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\])/g).map(part => {
    if (part.startsWith('\\(')) return `$${part.slice(2, -2)}$`
    if (part.startsWith('\\[')) return `$$${part.slice(2, -2)}$$`
    if (part.startsWith('$') || part.startsWith('`')) return part
    return part.replace(expression, equation => {
      // Avoid turning ordinary hyphenated prose into equations.
      if (!/[=<>≤≥≠≈⇔]/.test(equation)) return equation
      const latex = equation.replace(/⇔\s*/g, String.raw`\iff `).replace(/−|–/g, '-').replace(/α/g, String.raw`\alpha `).replace(/θ/g, String.raw`\theta `)
      return `$${latex}$`
    })
  }).join('')
}
