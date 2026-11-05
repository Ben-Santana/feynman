import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// The checked-in pages retain the original Hairline kernel and bench.
// Only replace the figure script when its source changes.
const directory = new URL('../frontend/public/simulations/', import.meta.url)
const shared = readFileSync(new URL('interactions.js', directory), 'utf8').trim()
for (const name of ['balance', 'circuit', 'ladder']) {
  const htmlFile = new URL(`hairline-${name}.html`, directory)
  const html = readFileSync(htmlFile, 'utf8')
  const source = readFileSync(new URL(`${name}.js`, directory), 'utf8').trim()
  const slot = /(<script type="module" id="hl-figure">)[\s\S]*?(<\/script>)/
  if (!slot.test(html)) throw new Error(`Missing figure slot in ${fileURLToPath(htmlFile)}`)
  writeFileSync(htmlFile, html.replace(slot, (_match, start, end) => `${start}\n${shared}\n${source}\n${end}`))
}

// Keep the generation model's visual references in the deployed backend bundle.
const referenceDirectory = new URL('../backend/assets/puzzles/', import.meta.url)
mkdirSync(referenceDirectory, { recursive: true })
const page = readFileSync(new URL('hairline-balance.html', directory), 'utf8')
const kernel = /<script id="hl-kernel">([\s\S]*?)<\/script>/.exec(page)?.[1]?.trim()
if (!kernel) throw new Error('Missing immutable Hairline kernel')
writeFileSync(new URL('kernel.js', referenceDirectory), `${kernel}\n`)
writeFileSync(new URL('interactions.js', referenceDirectory), `${shared}\n`)
const examples = [['balance', 'Torque'], ['circuit', 'Ohm’s law'], ['ladder', 'Right-triangle trigonometry']].map(([name, topic]) => ({
  name, topic, note: 'Visual and physical reference only. Adapt to mountPuzzle/onValue/config.value; do not copy its old parent messaging or hard-coded host contract.',
  source: readFileSync(new URL(`${name}.js`, directory), 'utf8'),
}))
writeFileSync(new URL('examples.json', referenceDirectory), `${JSON.stringify(examples, null, 2)}\n`)
