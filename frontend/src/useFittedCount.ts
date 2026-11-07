import { useLayoutEffect, useState } from 'react'

/** Returns how many of `total` list items fit the list's height, always at least one row. */
export function useFittedCount<T extends HTMLElement>(total: number) {
  const [list, setList] = useState<T | null>(null)
  const [count, setCount] = useState(Infinity)
  useLayoutEffect(() => {
    if (!list) return
    function measure(element: T) {
      const items = Array.from(element.children, item => (item as HTMLElement).offsetHeight)
      if (!items.length) return
      const style = getComputedStyle(element)
      const gap = parseFloat(style.rowGap) || 0
      const columns = style.display === 'grid' ? style.gridTemplateColumns.split(' ').length : 1
      const rows = Math.floor((element.clientHeight + gap) / (Math.max(...items) + gap))
      setCount(Math.max(rows, 1) * columns)
    }
    measure(list)
    const observer = new ResizeObserver(() => measure(list))
    observer.observe(list)
    return () => observer.disconnect()
  }, [list, total])
  return [Math.min(count, total), setList] as const
}
