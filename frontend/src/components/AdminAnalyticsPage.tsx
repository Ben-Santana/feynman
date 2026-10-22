import './AdminPage.css'
import './AdminAnalyticsPage.css'

export function AdminAnalyticsPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  return <section className="admin-page analytics-overview" aria-labelledby="analytics-title"><div className="admin-shell">
    <h1 id="analytics-title">Analytics</h1>
    <nav aria-label="Analytics reports" className="analytics-reports">
      <button type="button" className="analytics-report" onClick={() => onNavigate('/admin/analytics/salg-survey')}>
        <span>SALG survey</span><span aria-hidden="true">→</span>
      </button>
    </nav>
  </div></section>
}
