import { useEffect, useState } from 'react'
import { accountFetch } from './accounts'
type InboxMessage = {
  id: string
  title: string
  description: string
  action: { label: string; href: string }
}
type InboxResult = { messages: InboxMessage[]; total: number; page: number; pageSize: number }

export function useInbox(accountId: string | undefined, activePage: string) {
  const [page, setPage] = useState(1)
  const [result, setResult] = useState<InboxResult | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!accountId) return
    const controller = new AbortController()
    let loading = false

    async function refresh() {
      if (loading) return
      loading = true
      try {
        const response = await accountFetch(`/api/inbox?page=${page}`, { signal: controller.signal })
        if (!response.ok) throw new Error((await response.json()).error)
        const data: InboxResult = await response.json()
        if (controller.signal.aborted) return
        const lastPage = Math.max(1, Math.ceil(data.total / data.pageSize))
        if (page > lastPage) {
          setPage(lastPage)
          return
        }
        setResult(data)
        setError('')
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not load the inbox.')
      } finally {
        loading = false
      }
    }

    void refresh()
    window.addEventListener('focus', refresh)
    const timer = window.setInterval(refresh, 30_000)
    return () => {
      controller.abort()
      window.removeEventListener('focus', refresh)
      window.clearInterval(timer)
    }
  }, [accountId, activePage, page])

  return {
    total: accountId ? result?.total ?? 0 : 0,
    result: accountId && result?.page === page ? result : null,
    error: accountId ? error : '',
    page,
    changePage: setPage,
  }
}

