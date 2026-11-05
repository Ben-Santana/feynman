import { useEffect, useRef, useState } from 'react'
import './ApplySimulations.css'

type Demo = 'balance' | 'circuit' | 'ladder'
const demos: { id: Demo; topic: string; title: string }[] = [
  { id: 'balance', topic: 'Torque', title: 'Balance a load' },
  { id: 'circuit', topic: 'Ohm’s law', title: 'Choose the resistor' },
  { id: 'ladder', topic: 'Right triangle trigonometry', title: 'Reach the balcony' },
]
function resistorOptions(voltage: number, variant: number) {
  const values = [voltage / .4, voltage / .2, voltage / .1]
  return variant === 0 ? values : variant === 1 ? [values[1], values[2], values[0]] : [values[2], values[0], values[1]]
}
const frameStyle = `
:root { color-scheme:light; --ground:#fafafa; --ink:#202022; --muted:#656569; --hairline-plate:#fafafa; --hairline-hi:#202022; --hairline-edge:#55555a; --hairline-mid:#77777c; --hairline-lo:#a3a3aa; }
html,body { background:var(--ground); } body { min-height:0;height:100vh;padding:0;display:grid;place-items:center; } main {max-width:none;width:min(100%,calc(100vh * 1.25));margin:0 auto;} .plate {border:0;border-radius:0;}
#name,#means,#rules,#theme,#read,.controls { display:none; } #stage { width:100%;touch-action:none; } #stage>svg {width:100%;height:auto;} #error {font:14px/1.5 system-ui;}
`
export function ApplySimulations() {
  const [selected, setSelected] = useState<Demo>('balance')
  return <div className="apply-workshop">
    <header className="apply-workshop-heading"><h2>Apply simulations</h2><span>Student preview</span></header>
    <div className="apply-demo-picker" role="group" aria-label="Choose a simulation">
      {demos.map(demo => <button key={demo.id} type="button" aria-pressed={selected === demo.id} onClick={() => setSelected(demo.id)}><span>{demo.topic}</span><strong>{demo.title}</strong></button>)}
    </div>
    <Experiment key={selected} kind={selected} />
  </div>
}
function Experiment({ kind }: { kind: Demo }) {
  const demo = demos.find(item => item.id === kind)!
  const frame = useRef<HTMLIFrameElement>(null)
  const [ready, setReady] = useState(false)
  const [variant, setVariant] = useState(0)
  const [right, setRight] = useState(1)
  const [selectedResistor, setSelectedResistor] = useState<number | null>(null)
  const [angle, setAngle] = useState(20)
  const [solved, setSolved] = useState(false)
  const [checked, setChecked] = useState(false)
  const [inputDraft, setInputDraft] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')
  const [attempts, setAttempts] = useState(0)
  const leftMass = [4, 6, 3][variant], leftDistance = [3, 2, 4][variant], rightMass = [6, 4, 2][variant]
  const voltage = [6, 8, 10][variant]
  const options = resistorOptions(voltage, variant)
  const resistance = selectedResistor === null ? null : options[selectedResistor]
  const length = [10, 13, 17][variant], rise = [6, 5, 8][variant], run = [8, 12, 15][variant]
  const leftTorque = leftDistance * leftMass * 10, rightTorque = right * rightMass * 10
  const current = resistance === null ? 0 : voltage / resistance
  const tipHeight = length * Math.sin(angle * Math.PI / 180), tipRun = length * Math.cos(angle * Math.PI / 180)
  const balanced = Math.abs(leftTorque - rightTorque) < .01
  const powered = resistance !== null && Math.abs(current - .2) < .0001
  const aligned = Math.hypot(tipHeight - rise, tipRun - run) < .08
  const valid = kind === 'balance' ? balanced : kind === 'circuit' ? powered : aligned
  const problem = kind === 'balance'
    ? `A ${leftMass} kg load sits ${leftDistance} m left of the pivot. Where should you place a ${rightMass} kg counterweight on the right to balance the beam?`
    : kind === 'circuit'
      ? `A ${voltage} V source powers an ideal lamp with zero resistance. The lamp needs exactly 0.20 A. Which resistor completes the circuit with the required current?`
      : `A ${length} m ladder must reach a balcony ${rise} m high, ${run} m horizontally from its foot. What angle should the ladder make with the ground?`
  useEffect(() => {
    function receive(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow || solved) return
      const value = event.data?.value
      if (event.data?.type === 'feynman-balance-move' && kind === 'balance' && event.data.side === 'right' && Number.isFinite(value)) { setRight(Math.min(6, Math.max(1, value))); setFeedback(''); setChecked(false); setInputDraft(null) }
      if (event.data?.type === 'feynman-circuit-select' && kind === 'circuit' && (value === null || Number.isInteger(value) && value >= 0 && value < 3)) { setSelectedResistor(value); setFeedback(''); setChecked(false); setInputDraft(null) }
      if (event.data?.type === 'feynman-ladder-angle' && kind === 'ladder' && Number.isFinite(value)) { setAngle(Math.min(75, Math.max(10, value))); setFeedback(''); setChecked(false); setInputDraft(null) }
    }
    window.addEventListener('message', receive)
    return () => window.removeEventListener('message', receive)
  }, [kind, solved])
  useEffect(() => {
    if (!ready) return
    const config = kind === 'balance' ? { left: -leftDistance, right, leftMass, rightMass, checked, solved } : kind === 'circuit' ? { selected: selectedResistor, options: resistorOptions(voltage, variant), voltage, checked, solved } : { angle, length, rise, run, checked, solved }
    frame.current?.contentWindow?.postMessage({ type: `feynman-${kind}-state`, config }, window.location.origin)
  }, [ready, kind, variant, leftDistance, right, leftMass, rightMass, selectedResistor, voltage, angle, length, rise, run, checked, solved])
  function reset(next = variant) { setVariant(next); setRight(1); setSelectedResistor(null); setAngle(20); setSolved(false); setFeedback(''); setChecked(false); setAttempts(0); setInputDraft(null) }
  function choose(index: number | null) { setSelectedResistor(index); setFeedback(''); setChecked(false); setInputDraft(null) }
  function check() {
    setChecked(true); setAttempts(value => value + 1)
    if (valid) { setSolved(true); setFeedback(kind === 'balance' ? `Balanced. Both sides exert ${leftTorque} N·m of torque.` : kind === 'circuit' ? `${voltage} V ÷ ${resistance} Ω = 0.20 A. The lamp is on.` : `Ladder secured. Its tip reaches ${rise} m high and ${run} m from the foot.`) }
    else setFeedback(kind === 'balance' ? `The right torque is ${rightTorque < leftTorque ? 'too small. Move the counterweight farther from' : 'too large. Move the counterweight closer to'} the pivot.` : kind === 'circuit' ? resistance === null ? 'Drag a resistor into the green socket.' : current > .2 ? 'Too much current. Choose a larger resistance.' : 'Too little current. Choose a smaller resistance.' : `The ladder ${tipHeight < rise ? 'falls short of' : 'rises above'} the balcony. ${tipHeight < rise ? 'Increase' : 'Decrease'} its angle.`)
  }
  const draftValue = inputDraft === null ? null : Number(inputDraft)
  const draftInvalid = inputDraft !== null && (!inputDraft.trim() || !Number.isFinite(draftValue) || draftValue! < (kind === 'balance' ? 1 : 10) || draftValue! > (kind === 'balance' ? 6 : 75))
  return <article className={`apply-experiment${solved ? ' is-solved' : ''}`}>
    <div className="apply-experiment-title"><h3>{demo.title}</h3><button type="button" onClick={() => reset()}>Reset</button></div>
    <p className="apply-topic">Topic: {demo.topic}</p>
    <div className="apply-problem"><h4>Problem</h4><p>{problem}</p></div>
    <div className="apply-experiment-grid">
      <div className="apply-scene-column">
        <div className="apply-scene">
          <label className="apply-answer"><span>{kind === 'balance' ? 'Distance from pivot' : kind === 'circuit' ? 'Resistance' : 'Ladder angle'}</span><div>
            {kind === 'circuit' ? <select aria-label="Resistance" value={selectedResistor ?? ''} disabled={solved} onChange={event => choose(event.target.value === '' ? null : Number(event.target.value))}><option value="">—</option>{options.map((value, index) => <option key={value} value={index}>{value}</option>)}</select> : <input aria-label={kind === 'balance' ? 'Counterweight distance' : 'Ladder angle'} type="number" inputMode="decimal" onFocus={event => event.currentTarget.select()} min={kind === 'balance' ? 1 : 10} max={kind === 'balance' ? 6 : 75} step="any" value={inputDraft ?? (kind === 'balance' ? right : angle)} disabled={solved} onChange={event => {
              setInputDraft(event.target.value); setFeedback(''); setChecked(false)
              const value = event.target.valueAsNumber
              if (!Number.isFinite(value)) return
              if (kind === 'balance' && value >= 1 && value <= 6) setRight(value)
              else if (kind === 'ladder' && value >= 10 && value <= 75) setAngle(value)
            }} onBlur={() => {
              if (inputDraft?.trim() && Number.isFinite(Number(inputDraft))) {
                const value = Number(inputDraft)
                if (kind === 'balance') setRight(Math.max(1, Math.min(6, value)))
                else setAngle(Math.max(10, Math.min(75, value)))
              }
              setInputDraft(null)
            }} />}
            <small>{kind === 'balance' ? 'm' : kind === 'circuit' ? 'Ω' : '°'}</small>
          </div></label>
          <iframe ref={frame} title={`${demo.topic}: ${demo.title}`} src={`/simulations/hairline-${kind}.html?theme=light`} onLoad={event => {
          const doc = event.currentTarget.contentDocument
          if (!doc) return
          const style = doc.createElement('style'); style.textContent = frameStyle; doc.head.append(style); setReady(true)
        }} />{!ready && <span className="apply-scene-loading">Loading simulation…</span>}</div>
        <div className="apply-affordance-key"><span><i className="is-grab" />{kind === 'circuit' ? 'Drag a resistor' : kind === 'balance' ? 'Drag the counterweight' : 'Drag to set the ladder angle'}</span>{kind !== 'balance' && <span><i className="is-drop" />{kind === 'circuit' ? 'Drop into the socket' : 'Reach the landing when checked'}</span>}</div>

      </div>

    </div>
    <footer className="apply-footer"><div className="apply-result" role="status" aria-live="polite"><strong>{solved ? 'Challenge complete' : feedback ? 'Try another arrangement' : 'Find a solution'}</strong><p>{feedback || (kind === 'balance' ? 'Place the counterweight. Check answer releases the beam.' : kind === 'circuit' ? 'Choose a resistor. Check answer powers the circuit.' : 'Set the angle. Check answer raises the ladder.')}</p></div><button type="button" className="apply-check" disabled={!ready || draftInvalid || (kind === 'circuit' && selectedResistor === null)} onClick={solved ? () => reset((variant + 1) % 3) : check}>{solved ? 'Next challenge' : 'Check answer'}</button></footer>
    <details className="apply-dev-notes"><summary>Demo details{attempts > 0 ? ` · ${attempts} ${attempts === 1 ? 'check' : 'checks'}` : ''}</summary><p>Handcrafted examples for the Apply step: explicit topic, constrained problem, visible manipulation, and a deterministic solution. Completion is not saved. Each topic includes three variants.</p><a href="https://hairline.lucasmarkes.com/skills" target="_blank" rel="noreferrer">Based on Hairline by Lucas Marques</a></details>
  </article>
}
