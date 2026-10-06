import { useLayoutEffect, useRef, type ComponentProps } from 'react'
import { checklistRows, checklistText } from '../rubricChecklist.js'

export function RubricChecklistEditor({ id, name, value, invalid, disabled, onChange }: { id: string; name: string; value: string; invalid: boolean; disabled: boolean; onChange: (value: string) => void }) {
  const editor = useRef<HTMLDivElement>(null)
  const addedItem = useRef<number | null>(null)
  const items = checklistRows(value)
  useLayoutEffect(() => {
    if (addedItem.current === null) return
    const input = editor.current?.querySelectorAll('textarea')[addedItem.current]
    addedItem.current = null
    input?.focus()
  }, [value])
  function update(next: string[]) {
    const text = checklistText(next)
    if (next.length <= 20 && text.length <= 1000) onChange(text)
  }
  return <div ref={editor} id={id} className={`rubric-checklist-editor ${invalid ? 'validation-field' : ''}`} tabIndex={-1} role="group" aria-label={`${name} checklist`} aria-invalid={invalid}>
    <ul>{items.map((item, index) => <li key={index}>
      <AutosizeTextarea aria-label={`${name}, item ${index + 1}`} value={item} rows={1} maxLength={1000} disabled={disabled} placeholder="What must the learner demonstrate?" onChange={event => update(items.flatMap((entry, i) => i === index ? (checklistRows(event.target.value).length ? checklistRows(event.target.value) : ['']) : [entry]))} />
      <button type="button" className="rubric-item-remove" disabled={disabled} aria-label={`Remove ${name} item ${index + 1}`} onClick={() => update(items.filter((_, i) => i !== index))}><span aria-hidden="true">−</span></button>
    </li>)}</ul>
    <button type="button" className="rubric-item-add" disabled={disabled || items.length >= 20 || value.length > 990} onClick={() => { addedItem.current = items.length; update([...items, '']) }}>＋ Add item</button>
  </div>
}

function AutosizeTextarea(props: ComponentProps<'textarea'>) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const resize = () => {
      element.style.height = '0px'
      element.style.height = `${element.scrollHeight}px`
    }
    resize()
    let width = element.getBoundingClientRect().width
    const observer = new ResizeObserver(() => {
      const nextWidth = element.getBoundingClientRect().width
      if (nextWidth !== width) { width = nextWidth; resize() }
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [props.value])
  return <textarea {...props} ref={ref} />
}
