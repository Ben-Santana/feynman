// Equation chips serialize to the same LaTeX string used by saved drafts and APIs.
export function draftDomText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? '').replace(/\u00a0/g, ' ')
  if (node instanceof HTMLElement && node.dataset.equation !== undefined) return node.dataset.equation
  if (node instanceof HTMLBRElement) return node.dataset.tail !== undefined ? '' : '\n'
  let text = ''
  for (const child of node.childNodes) {
    if (child instanceof HTMLElement && /^(DIV|P)$/.test(child.tagName) && text && !text.endsWith('\n')) text += '\n'
    text += draftDomText(child)
  }
  return text
}

export function draftSelection(editor: HTMLElement): { start: number; end: number } | null {
  const selection = window.getSelection()
  if (!selection?.rangeCount) return null
  const range = selection.getRangeAt(0)
  if (!editor.contains(range.startContainer) || !editor.contains(range.endContainer)) return null
  function offset(node: Node, position: number) {
    const prefix = document.createRange()
    prefix.selectNodeContents(editor)
    prefix.setEnd(node, position)
    return draftDomText(prefix.cloneContents()).length
  }
  return { start: offset(range.startContainer, range.startOffset), end: offset(range.endContainer, range.endOffset) }
}

export function focusDraft(editor: HTMLElement, position: number) {
  editor.focus()
  const range = document.createRange()
  let remaining = position
  for (const node of editor.childNodes) {
    const length = draftDomText(node).length
    if (node instanceof HTMLBRElement && node.dataset.tail !== undefined && remaining <= 0) {
      range.setStartBefore(node); range.collapse(true)
      window.getSelection()?.removeAllRanges(); window.getSelection()?.addRange(range)
      return
    }
    if (node.nodeType === Node.TEXT_NODE && length > 0 && remaining <= length) {
      range.setStart(node, Math.max(0, remaining)); range.collapse(true)
      window.getSelection()?.removeAllRanges(); window.getSelection()?.addRange(range)
      return
    }
    remaining -= length
  }
  range.selectNodeContents(editor); range.collapse(false)
  window.getSelection()?.removeAllRanges(); window.getSelection()?.addRange(range)
}

export function equationRange(editor: HTMLElement, equation: HTMLElement) {
  const prefix = document.createRange()
  prefix.selectNodeContents(editor); prefix.setEndBefore(equation)
  const start = draftDomText(prefix.cloneContents()).length
  return { start, end: start + (equation.dataset.equation?.length ?? 0) }
}
