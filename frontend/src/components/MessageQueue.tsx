import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { QueuedMessage } from '../messageQueue'
import { ChatComposer } from './ChatComposer'
import { ChatText } from './ChatText'
import { focusDraft } from './mathComposerDom'
import { TooltipButton } from './TooltipButton'
import './MessageQueue.css'

type Drag = { id: string; from: number; to: number; offset: number; shift: number }
type DragStart = { pointerY: number; scrollTop: number; tops: number[]; height: number }

const edgeScroll = 28
// Rows are one line, so display equations render inline.
const previewText = (text: string) => text.replace(/\s*\n\s*/g, ' ').replace(/\$\$(.+?)\$\$/g, '$$$1$$')

function QueueEditor({ item, onSave, onCancel }: { item: QueuedMessage; onSave: (text: string) => void; onCancel: () => void }) {
  const [text, setText] = useState(item.text)
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const editor = host.current?.querySelector<HTMLElement>('.mixed-draft')
    if (editor) focusDraft(editor, item.text.length)
  }, [item.text])
  return <div ref={host} className="queue-editor" onKeyDown={event => { if (event.key === 'Escape') onCancel() }}>
    <ChatComposer className="chat-composer queue-edit-composer" value={text} onChange={setText} onSend={() => onSave(text.trim())} busy={false} sendLabel="Save" />
    <button type="button" className="queue-cancel" onClick={onCancel}>Cancel</button>
  </div>
}

export function MessageQueue({ items, editingId, status, canEdit, onResume, onEditingChange, onDraggingChange, onChange, onMove }: {
  items: QueuedMessage[]; editingId: string | null; status: string; canEdit: boolean; onResume?: () => void
  onEditingChange: (id: string | null) => void; onDraggingChange: (dragging: boolean) => void; onChange: (items: QueuedMessage[]) => void; onMove: (from: number, to: number) => void
}) {
  const [drag, setDrag] = useState<Drag | null>(null)
  const list = useRef<HTMLOListElement>(null)
  const start = useRef<DragStart | null>(null)
  if (!items.length) return null
  const canDrag = !editingId && items.length > 1

  function beginDrag(event: PointerEvent<HTMLLIElement>, id: string, from: number) {
    const target = event.target as HTMLElement
    // Touch drags start on the grip so the rest of the row can still scroll.
    if (!canDrag || event.button !== 0 || target.closest('.queue-action') || (event.pointerType !== 'mouse' && !target.closest('.queue-grip'))) return
    const rows = [...list.current!.children] as HTMLElement[]
    start.current = { pointerY: event.clientY, scrollTop: list.current!.scrollTop, tops: rows.map(row => row.offsetTop), height: rows[from].offsetHeight }
    event.currentTarget.setPointerCapture(event.pointerId)
    onDraggingChange(true)
    setDrag({ id, from, to: from, offset: 0, shift: (rows[1]?.offsetTop ?? 0) - (rows[0]?.offsetTop ?? 0) })
  }
  function moveDrag(event: PointerEvent<HTMLLIElement>) {
    const origin = start.current
    const element = list.current
    if (!drag || !origin || !element) return
    const bounds = element.getBoundingClientRect()
    if (event.clientY < bounds.top + edgeScroll) element.scrollTop -= 6
    else if (event.clientY > bounds.bottom - edgeScroll) element.scrollTop += 6
    const first = origin.tops[0], last = origin.tops.at(-1)!
    const top = Math.max(first, Math.min(last, origin.tops[drag.from] + event.clientY - origin.pointerY + element.scrollTop - origin.scrollTop))
    const center = top + origin.height / 2
    const to = origin.tops.filter((rowTop, index) => index !== drag.from && rowTop + origin.height / 2 < center).length
    setDrag({ ...drag, to, offset: top - origin.tops[drag.from] })
  }
  function endDrag() {
    if (drag && drag.to !== drag.from) onMove(drag.from, drag.to)
    start.current = null
    setDrag(null)
    onDraggingChange(false)
  }
  function rowOffset(index: number) {
    if (!drag) return undefined
    if (index === drag.from) return drag.offset
    if (index > drag.from && index <= drag.to) return -drag.shift
    if (index < drag.from && index >= drag.to) return drag.shift
    return 0
  }
  function moveWithKeys(event: KeyboardEvent, index: number) {
    const to = event.key === 'ArrowUp' ? index - 1 : event.key === 'ArrowDown' ? index + 1 : -1
    if (to < 0 || to >= items.length) return
    event.preventDefault()
    onMove(index, to)
  }

  return <section className="message-queue" aria-label="Queued messages">
    <header className="queue-header">
      <span>{items.length} queued</span>
      {status && <span className="queue-status" role="status">{status}</span>}
      {onResume && <button type="button" className="queue-resume" onClick={onResume}>Resume</button>}
    </header>
    <ol ref={list} className="queue-list" data-dragging={Boolean(drag)} data-editing={Boolean(editingId)}>
      {items.map((item, index) => {
        const offset = rowOffset(index)
        return <li key={item.id} className="queue-row" data-active={drag?.id === item.id} data-draggable={canDrag} style={offset ? { transform: `translateY(${offset}px)` } : undefined} onPointerDown={event => beginDrag(event, item.id, index)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
          {item.id === editingId
            ? <QueueEditor item={item} onCancel={() => onEditingChange(null)} onSave={text => { onChange(items.map(other => other.id === item.id ? { ...other, text } : other)); onEditingChange(null) }} />
            : <>
              {items.length > 1 && <button type="button" className="queue-grip" disabled={!canDrag} aria-label={`Move message ${index + 1} of ${items.length}. Use the up and down arrow keys.`} onKeyDown={event => moveWithKeys(event, index)}>
                <svg viewBox="0 0 10 16" width="10" height="16" fill="currentColor" aria-hidden="true"><circle cx="2.5" cy="3" r="1.4" /><circle cx="7.5" cy="3" r="1.4" /><circle cx="2.5" cy="8" r="1.4" /><circle cx="7.5" cy="8" r="1.4" /><circle cx="2.5" cy="13" r="1.4" /><circle cx="7.5" cy="13" r="1.4" /></svg>
              </button>}
              <div className="queue-text"><ChatText>{previewText(item.text)}</ChatText></div>
              <div className="queue-actions">
                {canEdit && <TooltipButton type="button" className="queue-action" aria-label="Edit message" tooltip="Edit" disabled={Boolean(editingId)} onClick={() => onEditingChange(item.id)}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                </TooltipButton>}
                <TooltipButton type="button" className="queue-action" aria-label="Delete message" tooltip="Delete" onClick={() => onChange(items.filter(other => other.id !== item.id))}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="m19 6-1 14H6L5 6" /><path d="M10 11v5M14 11v5" /></svg>
                </TooltipButton>
              </div>
            </>}
        </li>
      })}
    </ol>
  </section>
}
