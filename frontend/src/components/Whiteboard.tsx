import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

export type BoardSnapshot = { image: string; version: number }
export type WhiteboardHandle = { snapshot: () => BoardSnapshot | null; markSent: (version: number) => void }
type Shape = 'line' | 'circle' | 'rectangle' | 'polygon'
type Tool = 'pen' | 'text' | 'eraser' | Shape
type Point = { x: number; y: number }
type TextDraft = { x: number; y: number; width: number; value: string }
const colors = [
  { name: 'Ink', value: '#242424' },
  { name: 'Red', value: '#e8483f' },
  { name: 'Charcoal', value: '#484848' },
  { name: 'Graphite', value: '#777777' },
  { name: 'Gray', value: '#aaaaaa' },
]
const shapes: { id: Shape; label: string }[] = [
  { id: 'line', label: 'Line' },
  { id: 'circle', label: 'Circle' },
  { id: 'rectangle', label: 'Rectangle' },
  { id: 'polygon', label: 'Polygon' },
]
const eraserSize = 64
const strokeSizes = [2, 4, 7, 12, 20]
const historyLimit = 30
const textFontSize = 28
const textLineHeight = 34

function wrapText(context: CanvasRenderingContext2D, value: string, maxWidth: number) {
  const lines: string[] = []
  for (const paragraph of value.split('\n')) {
    if (!paragraph) { lines.push(''); continue }
    let line = ''
    for (const word of paragraph.split(' ')) {
      const candidate = line ? `${line} ${word}` : word
      if (context.measureText(candidate).width <= maxWidth) { line = candidate; continue }
      if (line) lines.push(line)
      line = word
      while (context.measureText(line).width > maxWidth && line.length > 1) {
        let count = 1
        while (count < line.length && context.measureText(line.slice(0, count + 1)).width <= maxWidth) count++
        lines.push(line.slice(0, count))
        line = line.slice(count)
      }
    }
    lines.push(line)
  }
  return lines
}

function drawShape(context: CanvasRenderingContext2D, shape: Shape, start: Point, end: Point) {
  context.beginPath()
  if (shape === 'line') {
    context.moveTo(start.x, start.y)
    context.lineTo(end.x, end.y)
  } else if (shape === 'circle') {
    context.arc(start.x, start.y, Math.hypot(end.x - start.x, end.y - start.y), 0, Math.PI * 2)
  } else if (shape === 'rectangle') {
    context.rect(start.x, start.y, end.x - start.x, end.y - start.y)
  }
  context.stroke()
}

function ShapeIcon({ shape }: { shape: Shape }) {
  const path = {
    line: <path d="M4 19 20 5" />,
    circle: <circle cx="12" cy="12" r="8" />,
    rectangle: <rect x="4" y="6" width="16" height="12" rx="1.5" />,
    polygon: <path d="m12 3 9 7-3.5 11h-11L3 10Z" />,
  }[shape]
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{path}</svg>
}

export const Whiteboard = forwardRef<WhiteboardHandle, { open: boolean }>(function Whiteboard({ open }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pixelRatio = useRef(Math.max(1, window.devicePixelRatio || 1))
  const previewBaseRef = useRef<HTMLCanvasElement | null>(null)
  const pendingActionRef = useRef<HTMLCanvasElement | null>(null)
  const textDraftRef = useRef<TextDraft | null>(null)
  const textPointerRef = useRef<number | null>(null)
  const historyRef = useRef<{ undo: HTMLCanvasElement[]; redo: HTMLCanvasElement[] }>({ undo: [], redo: [] })
  const drawing = useRef(false)
  const shapeStart = useRef<Point | null>(null)
  const polygon = useRef<Point[]>([])
  const version = useRef(0)
  const sentVersion = useRef(0)
  const pendingResize = useRef(false)
  const scheduleResizeRef = useRef<() => void>(() => {})
  const [tool, setTool] = useState<Tool>('pen')
  const [shapeMenuOpen, setShapeMenuOpen] = useState(false)
  const [colorMenuOpen, setColorMenuOpen] = useState(false)
  const [color, setColor] = useState(colors[0].value)
  const [strokeWidth, setStrokeWidth] = useState(7)
  const [textDraft, setTextDraft] = useState<TextDraft | null>(null)
  const [textDraftId, setTextDraftId] = useState(0)
  const [historyAvailable, setHistoryAvailable] = useState({ undo: false, redo: false })
  const surfaceRef = useRef<HTMLDivElement>(null)
  const eraserPreviewRef = useRef<HTMLSpanElement>(null)
  const textInputRef = useRef<HTMLTextAreaElement>(null)
  const strokeIndex = strokeSizes.indexOf(strokeWidth)
  const strokePercent = strokeIndex / (strokeSizes.length - 1) * 100
  const strokePosition = `calc(${strokePercent}% + ${12 - strokePercent * .24}px)`

  useEffect(() => {
    if (!open && eraserPreviewRef.current) eraserPreviewRef.current.style.display = 'none'
  }, [open])

  useEffect(() => {
    if (textDraftId) textInputRef.current?.focus()
  }, [textDraftId])

  useEffect(() => {
    void document.fonts.load(`${textFontSize}px "Patrick Hand"`).catch(() => {})
  }, [])

  useEffect(() => {
    const surface = surfaceRef.current
    const canvas = canvasRef.current
    if (!surface || !canvas || !open) return
    let resizeTimer: ReturnType<typeof setTimeout> | undefined
    const resize = () => {
      if (drawing.current || polygon.current.length) {
        pendingResize.current = true
        return
      }
      pendingResize.current = false
      // Keep a fixed drawing coordinate system. A smaller viewport clips the
      // board temporarily; growing it reveals the original strokes again.
      const width = Math.max(canvas.width, Math.ceil(surface.clientWidth * pixelRatio.current))
      const height = Math.max(canvas.height, Math.ceil(surface.clientHeight * pixelRatio.current))
      if (canvas.width === width && canvas.height === height) return
      const old = document.createElement('canvas')
      old.width = canvas.width; old.height = canvas.height
      old.getContext('2d')?.drawImage(canvas, 0, 0)
      canvas.width = width; canvas.height = height
      canvas.style.width = `${width / pixelRatio.current}px`
      canvas.style.height = `${height / pixelRatio.current}px`
      canvas.getContext('2d')?.drawImage(old, 0, 0)
    }
    // Wait for the board's size animation to settle before growing its bitmap.
    const scheduleResize = () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(resize, 100)
    }
    scheduleResizeRef.current = scheduleResize
    const observer = new ResizeObserver(scheduleResize)
    observer.observe(surface)
    scheduleResize()
    return () => { observer.disconnect(); clearTimeout(resizeTimer); scheduleResizeRef.current = () => {} }
  }, [open])

  useImperativeHandle(ref, () => ({
    snapshot: () => {
      commitText()
      if (version.current === sentVersion.current) return null
      const canvas = canvasRef.current
      if (!canvas) return null
      const image = document.createElement('canvas')
      image.width = canvas.width; image.height = canvas.height
      const context = image.getContext('2d')
      if (!context) return null
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, image.width, image.height)
      context.drawImage(previewBaseRef.current ?? canvas, 0, 0)
      return { image: image.toDataURL('image/png'), version: version.current }
    },
    markSent: sent => { sentVersion.current = Math.max(sentVersion.current, sent) },
  }))

  function point(event: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: (event.clientX - rect.left) * event.currentTarget.width / rect.width, y: (event.clientY - rect.top) * event.currentTarget.height / rect.height }
  }
  function hideEraserPreview() {
    if (eraserPreviewRef.current) eraserPreviewRef.current.style.display = 'none'
  }
  function moveEraserPreview(event: React.PointerEvent<HTMLCanvasElement>) {
    const preview = eraserPreviewRef.current
    if (!preview || tool !== 'eraser') return
    const canvas = event.currentTarget
    const position = point(event)
    preview.style.left = `${canvas.offsetLeft + position.x * canvas.clientWidth / canvas.width}px`
    preview.style.top = `${canvas.offsetTop + position.y * canvas.clientHeight / canvas.height}px`
    preview.style.width = `${eraserSize * canvas.clientWidth / canvas.width}px`
    preview.style.height = `${eraserSize * canvas.clientHeight / canvas.height}px`
    preview.style.display = 'block'
  }
  function setup(context: CanvasRenderingContext2D) {
    context.lineCap = 'round'; context.lineJoin = 'round'
    context.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over'
    context.strokeStyle = color; context.fillStyle = color
    context.lineWidth = (tool === 'eraser' ? eraserSize : strokeWidth) * pixelRatio.current
  }
  function clearPreview() {
    const canvas = canvasRef.current
    const base = previewBaseRef.current
    if (!canvas || !base) return
    const context = canvas.getContext('2d')
    context?.clearRect(0, 0, canvas.width, canvas.height)
    if (context) context.globalCompositeOperation = 'source-over'
    context?.drawImage(base, 0, 0)
    previewBaseRef.current = null
  }
  function capturePreviewBase() {
    const canvas = canvasRef.current
    if (!canvas || previewBaseRef.current) return
    const base = document.createElement('canvas')
    base.width = canvas.width
    base.height = canvas.height
    base.getContext('2d')?.drawImage(canvas, 0, 0)
    previewBaseRef.current = base
  }
  function finishPendingResize() {
    if (pendingResize.current) scheduleResizeRef.current()
  }
  function copyCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return null
    const copy = document.createElement('canvas')
    copy.width = canvas.width
    copy.height = canvas.height
    copy.getContext('2d')?.drawImage(canvas, 0, 0)
    return copy
  }
  function restoreCanvas(saved: HTMLCanvasElement) {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    context.globalCompositeOperation = 'source-over'
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.drawImage(saved, 0, 0)
    version.current += 1
  }
  function updateHistoryAvailable() {
    setHistoryAvailable({ undo: historyRef.current.undo.length > 0, redo: historyRef.current.redo.length > 0 })
  }
  function beginAction() {
    if (!pendingActionRef.current) pendingActionRef.current = copyCanvas()
  }
  function commitAction() {
    const before = pendingActionRef.current
    if (!before) return
    const history = historyRef.current
    history.undo.push(before)
    if (history.undo.length > historyLimit) history.undo.shift()
    history.redo = []
    pendingActionRef.current = null
    updateHistoryAvailable()
  }
  function cancelText() {
    textDraftRef.current = null
    setTextDraft(null)
  }
  function commitText() {
    const draft = textDraftRef.current
    if (!draft) return
    cancelText()
    if (!draft.value.trim()) return
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    beginAction()
    const scaleX = canvas.width / canvas.clientWidth
    const scaleY = canvas.height / canvas.clientHeight
    context.save()
    context.globalCompositeOperation = 'source-over'
    context.scale(scaleX, scaleY)
    context.fillStyle = color
    context.font = `400 ${textFontSize}px "Patrick Hand", "Comic Sans MS", cursive`
    context.textBaseline = 'top'
    wrapText(context, draft.value, draft.width - 16).forEach((line, index) => {
      context.fillText(line, draft.x + 8, draft.y + 7 + index * textLineHeight)
    })
    context.restore()
    version.current += 1
    commitAction()
  }
  function stepHistory(direction: 'undo' | 'redo') {
    commitText()
    const history = historyRef.current
    const source = history[direction]
    if (!source.length) return
    clearPreview()
    pendingActionRef.current = null
    drawing.current = false
    shapeStart.current = null
    polygon.current = []
    const current = copyCanvas()
    const previous = source.pop()!
    if (current) history[direction === 'undo' ? 'redo' : 'undo'].push(current)
    restoreCanvas(previous)
    finishPendingResize()
    updateHistoryAvailable()
  }
  function selectTool(next: Tool) {
    commitText()
    hideEraserPreview()
    clearPreview()
    if (drawing.current && (tool === 'pen' || tool === 'eraser')) commitAction()
    else pendingActionRef.current = null
    drawing.current = false
    shapeStart.current = null
    polygon.current = []
    finishPendingResize()
    setTool(next)
    setShapeMenuOpen(false)
    setColorMenuOpen(false)
  }
  function previewShape(end: Point) {
    const canvas = canvasRef.current
    const base = previewBaseRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !base || !context) return
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.globalCompositeOperation = 'source-over'
    context.drawImage(base, 0, 0)
    context.strokeStyle = color
    context.fillStyle = color
    context.lineWidth = strokeWidth * pixelRatio.current
    context.lineCap = 'round'
    context.lineJoin = 'round'
    if (tool === 'polygon') {
      const points = polygon.current
      if (!points.length) return
      context.beginPath()
      context.moveTo(points[0].x, points[0].y)
      for (const vertex of points.slice(1)) context.lineTo(vertex.x, vertex.y)
      context.lineTo(end.x, end.y)
      context.stroke()
      for (const vertex of points) {
        context.beginPath()
        context.arc(vertex.x, vertex.y, 4 * pixelRatio.current, 0, Math.PI * 2)
        context.fill()
      }
    } else if (shapeStart.current) drawShape(context, tool as Shape, shapeStart.current, end)
  }
  function finishPolygon() {
    const points = polygon.current
    if (points.length > 1 && Math.hypot(points.at(-1)!.x - points.at(-2)!.x, points.at(-1)!.y - points.at(-2)!.y) < 2 * pixelRatio.current) points.pop()
    if (points.length < 3) return
    const context = canvasRef.current?.getContext('2d')
    if (!context) return
    clearPreview()
    setup(context)
    context.beginPath()
    context.moveTo(points[0].x, points[0].y)
    for (const vertex of points.slice(1)) context.lineTo(vertex.x, vertex.y)
    context.closePath()
    context.stroke()
    version.current += 1
    commitAction()
    polygon.current = []
    finishPendingResize()
  }
  function startDraw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (event.button !== 0 && event.pointerType === 'mouse') return
    if (tool === 'text') {
      textPointerRef.current = event.pointerId
      return
    }
    moveEraserPreview(event)
    setShapeMenuOpen(false)
    setColorMenuOpen(false)
    const context = event.currentTarget.getContext('2d')
    if (!context) return
    const position = point(event)
    beginAction()
    if (tool === 'polygon') {
      capturePreviewBase()
      const first = polygon.current[0]
      if (first && polygon.current.length >= 3 && Math.hypot(position.x - first.x, position.y - first.y) < 14 * pixelRatio.current) finishPolygon()
      else polygon.current.push(position)
      previewShape(position)
      return
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    drawing.current = true
    if (tool !== 'pen' && tool !== 'eraser') {
      capturePreviewBase()
      shapeStart.current = position
      previewShape(position)
      return
    }
    setup(context)
    const { x, y } = position
    context.beginPath()
    context.arc(x, y, context.lineWidth / 2, 0, Math.PI * 2)
    context.fill()
    context.beginPath(); context.moveTo(x, y)
    version.current += 1
  }
  function moveDraw(event: React.PointerEvent<HTMLCanvasElement>) {
    moveEraserPreview(event)
    if (tool === 'polygon' || (drawing.current && tool !== 'pen' && tool !== 'eraser')) {
      previewShape(point(event))
      return
    }
    if (!drawing.current) return
    const context = event.currentTarget.getContext('2d')
    if (!context) return
    const { x, y } = point(event)
    context.lineTo(x, y); context.stroke()
    context.beginPath(); context.moveTo(x, y)
    version.current += 1
  }
  function stopDraw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (tool === 'text') {
      const clicked = textPointerRef.current === event.pointerId && event.type !== 'pointercancel'
      textPointerRef.current = null
      if (clicked) {
        commitText()
        const canvas = event.currentTarget
        const rect = canvas.getBoundingClientRect()
        const surface = surfaceRef.current!
        const x = Math.min(Math.max(0, event.clientX - rect.left), Math.max(0, surface.clientWidth - 92))
        const y = Math.min(Math.max(0, event.clientY - rect.top), Math.max(0, surface.clientHeight - 46))
        const draft = { x, y, width: Math.min(260, surface.clientWidth - x - 8), value: '' }
        textDraftRef.current = draft
        setTextDraft(draft)
        setTextDraftId(id => id + 1)
        setShapeMenuOpen(false)
        setColorMenuOpen(false)
      }
      return
    }
    if (event.pointerType === 'touch' || event.type === 'pointercancel') hideEraserPreview()
    if (!drawing.current) return
    drawing.current = false
    const context = event.currentTarget.getContext('2d')
    clearPreview()
    if (context && shapeStart.current && event.type !== 'pointercancel') {
      setup(context)
      drawShape(context, tool as Shape, shapeStart.current, point(event))
      version.current += 1
    }
    if (tool === 'pen' || tool === 'eraser' || event.type !== 'pointercancel') commitAction()
    else pendingActionRef.current = null
    shapeStart.current = null
    context?.beginPath()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    finishPendingResize()
  }
  function clearBoard() {
    commitText()
    const canvas = canvasRef.current
    clearPreview()
    pendingActionRef.current = null
    beginAction()
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
    if (canvas) version.current += 1
    commitAction()
    drawing.current = false
    polygon.current = []
    shapeStart.current = null
    finishPendingResize()
  }
  return <div className="whiteboard" aria-label="Whiteboard">
    <div className="whiteboard-surface" ref={surfaceRef}>
      <canvas ref={canvasRef} width={1} height={1} className={tool === 'eraser' ? 'board-eraser-active' : tool === 'text' ? 'board-text-active' : undefined} aria-label="Drawing area" onPointerEnter={moveEraserPreview} onPointerLeave={hideEraserPreview} onPointerDown={startDraw} onPointerMove={moveDraw} onPointerUp={stopDraw} onPointerCancel={stopDraw} onDoubleClick={() => { if (tool === 'polygon') finishPolygon() }} />
      <span ref={eraserPreviewRef} className="board-eraser-preview" aria-hidden="true" />
      {textDraft && <textarea ref={textInputRef} className="board-text-input" aria-label="Whiteboard text" placeholder="Type here" rows={1} value={textDraft.value} style={{ left: textDraft.x, top: textDraft.y, width: textDraft.width, color }} onChange={event => { const next = { ...textDraft, value: event.target.value }; textDraftRef.current = next; setTextDraft(next); event.target.style.height = 'auto'; event.target.style.height = `${Math.max(46, event.target.scrollHeight)}px` }} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); cancelText() } else if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); commitText() } }} onBlur={commitText} />}
    </div>
    <div className="board-tray" role="toolbar" aria-label="Whiteboard tools">
      <div className="board-drawing-tools">
        <button type="button" className="board-tool-button board-marker-button board-tooltip-anchor" aria-label="Marker" aria-pressed={tool === 'pen'} onClick={() => selectTool('pen')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><g transform="rotate(35 12 12)"><rect x="8" y="2" width="8" height="6" rx="1.5" /><path d="M8 8h8v10H8zM8 18h8l-2.5 4h-3L8 18Z" /><path d="M10 11h4" /></g></svg><span className="board-tooltip" role="tooltip">Marker</span></button>
        <button type="button" className="board-tool-button board-tooltip-anchor" aria-label="Text" aria-pressed={tool === 'text'} onClick={() => selectTool('text')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 6V4h16v2M12 4v16m-4 0h8" /></svg><span className="board-tooltip" role="tooltip">Text</span></button>
        <div className="board-colors">
          <button type="button" className="board-tool-button board-color-button board-tooltip-anchor" aria-label="Marker color" aria-expanded={colorMenuOpen} onClick={() => { setShapeMenuOpen(false); setColorMenuOpen(open => !open) }}><span className="board-current-color" style={{ backgroundColor: color }} aria-hidden="true" /><span className="board-tooltip" role="tooltip">Marker color</span></button>
          {colorMenuOpen && <div className="board-color-menu" role="group" aria-label="Marker settings"><div className="board-color-swatches">{colors.map(item => <button key={item.name} type="button" className="board-color-swatch" aria-label={item.name} aria-pressed={color === item.value} style={{ '--swatch-color': item.value } as React.CSSProperties} onClick={() => { setColor(item.value); setColorMenuOpen(false) }} />)}</div><label className="board-custom-color"><span>Custom color</span><input type="color" aria-label="Custom marker color" value={color} onChange={event => setColor(event.target.value)} /></label><div className="board-stroke-slider"><div className="board-stroke-heading"><span>Stroke</span><output>{strokeWidth} px</output></div><div className="level-slider-wrap"><div className="level-slider-track" aria-hidden="true"><span className="level-slider-fill" style={{ width: strokePosition }} />{strokeSizes.map(size => <span className="level-slider-stop" key={size} />)}<span className="level-slider-thumb" style={{ left: strokePosition }} /></div><span className="level-slider-tooltip" style={{ left: strokePosition }} aria-hidden="true">{strokeWidth} px</span><input className="level-slider-input" type="range" min="0" max={strokeSizes.length - 1} step="1" value={strokeIndex} aria-label="Stroke width" aria-valuetext={`${strokeWidth} pixels`} onChange={event => setStrokeWidth(strokeSizes[Number(event.target.value)])} /></div></div></div>}
        </div>
        <div className="board-shapes">
          <button type="button" className="board-tool-button board-ruler-button board-tooltip-anchor" aria-label="Shapes" aria-expanded={shapeMenuOpen} aria-pressed={shapes.some(shape => shape.id === tool)} onClick={() => { setColorMenuOpen(false); setShapeMenuOpen(open => !open) }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M7 6v5m4-5v3m4-3v5m4-5v3" /></svg><span className="board-tooltip" role="tooltip">Shapes</span></button>
          {shapeMenuOpen && <div className="board-shape-menu" role="group" aria-label="Choose a shape">{shapes.map(shape => <button key={shape.id} type="button" aria-pressed={tool === shape.id} onClick={() => selectTool(shape.id)}><ShapeIcon shape={shape.id} /><span>{shape.label}</span></button>)}</div>}
        </div>
      </div>
      <div className="board-erasers">
        <button type="button" className="board-tool-button board-eraser-button board-tooltip-anchor" aria-label="Eraser" aria-pressed={tool === 'eraser'} onClick={() => selectTool('eraser')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m13 3 8 8-9 9H6l-4-4L13 3Z" /><path d="m8 10 8 8M12 20h9" /></svg><span className="board-tooltip" role="tooltip">Eraser</span></button>
        <button type="button" className="board-tool-button board-clear-button board-tooltip-anchor" aria-label="Clear board" onClick={clearBoard}><svg viewBox="0 0 32 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="7" width="28" height="12" rx="3" /><path d="M7 7v12M25 7v12" /></svg><span className="board-tooltip" role="tooltip">Clear board</span></button>
      </div>
      <div className="board-history">
        <button type="button" className="board-tool-button board-tooltip-anchor" aria-label="Undo" disabled={!historyAvailable.undo} onClick={() => stepHistory('undo')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 14-5-5 5-5M4 9h10a6 6 0 0 1 0 12" /></svg><span className="board-tooltip" role="tooltip">Undo</span></button>
        <button type="button" className="board-tool-button board-tooltip-anchor" aria-label="Redo" disabled={!historyAvailable.redo} onClick={() => stepHistory('redo')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 14 5-5-5-5m5 5H10a6 6 0 0 0 0 12" /></svg><span className="board-tooltip" role="tooltip">Redo</span></button>
      </div>
    </div>
  </div>
})
