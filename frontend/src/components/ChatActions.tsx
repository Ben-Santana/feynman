import { useEffect, useRef, useState } from 'react'
import { useConfirm } from './useConfirm'

export type ChatActionProps = {
  boardOpen: boolean
  onToggleBoard: () => void
  topicComplete: boolean
  reportDisabled: boolean
  onFinishTopic: () => void
  assigned: boolean
  restartDisabled: boolean
  onRestart: () => void
}

function useChatActionRequests({ topicComplete, onFinishTopic, assigned, onRestart }: ChatActionProps) {
  const confirm = useConfirm()
  const reportLabel = topicComplete ? 'View topic report' : 'Finish topic'

  async function requestFinish() {
    if (topicComplete || await confirm({ title: 'Finish topic?', description: 'You’ll open your topic report and can’t resume this chat.', confirmLabel: 'Hold to finish' })) onFinishTopic()
  }

  async function requestRestart() {
    if (await confirm({ title: 'Restart session?', description: assigned ? 'This attempt will end and its report will be saved. You’ll start this topic over in a new session.' : 'You’ll start this topic over in a new session. This chat stays saved.', confirmLabel: 'Hold to restart' })) onRestart()
  }

  return { reportLabel, requestFinish, requestRestart }
}

export function ChatActionItems({ onSelect, ...props }: ChatActionProps & { onSelect: () => void }) {
  const { boardOpen, onToggleBoard, reportDisabled, restartDisabled } = props
  const { reportLabel, requestFinish, requestRestart } = useChatActionRequests(props)
  return <>
    <button type="button" aria-expanded={boardOpen} aria-controls="whiteboard-drawing" onClick={() => { onSelect(); onToggleBoard() }}>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="14" rx="2" />
        <path d="M8 21h8m-4-3v3M7 14l4-4 3 2 3-4" />
      </svg>
      {boardOpen ? 'Close whiteboard' : 'Open whiteboard'}
    </button>
    <button type="button" disabled={reportDisabled} onClick={() => { onSelect(); void requestFinish() }}>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 21V4m0 1c5-4 9 4 14 0v10c-5 4-9-4-14 0" />
      </svg>
      {reportLabel}
    </button>
    <button type="button" disabled={restartDisabled} onClick={() => { onSelect(); void requestRestart() }}>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
        <path d="M3 3v5h5" />
      </svg>
      Restart session
    </button>
  </>
}

export function ChatActions(props: ChatActionProps) {
  const { reportDisabled } = props
  const { reportLabel, requestFinish } = useChatActionRequests(props)
  const [open, setOpen] = useState(false)
  const actions = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !actions.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [open])

  function close() {
    setOpen(false)
    trigger.current?.focus()
  }

  return <>
    <div
      ref={actions}
      className="chat-action-menu"
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}
      onKeyDown={event => { if (open && event.key === 'Escape') { event.stopPropagation(); close() } }}
    >
      <button ref={trigger} type="button" className="chat-actions-toggle" aria-label={open ? 'Close chat actions' : 'Open chat actions'} aria-expanded={open} aria-controls="chat-actions-panel" onClick={() => setOpen(value => !value)}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <path className="chat-actions-line-top" d="M4 6h16" />
          <path className="chat-actions-line-middle" d="M4 12h16" />
          <path className="chat-actions-line-bottom" d="M4 18h16" />
        </svg>
      </button>
      <div id="chat-actions-panel" className="chat-actions-panel" hidden={!open}>
        <ChatActionItems {...props} onSelect={close} />
      </div>
    </div>
    <button type="button" className="finish-topic" disabled={reportDisabled} onClick={event => { event.currentTarget.focus(); void requestFinish() }}>{reportLabel}</button>
  </>
}
