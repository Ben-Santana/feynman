import { sessionProgress } from '../sessionProgress'
import type { Concept } from '../learningFlow'
import './SessionProgress.css'

export function SessionProgress({ concepts }: { concepts: Concept[] }) {
  const { completed, total, percent } = sessionProgress(concepts)
  return <div className="concept-orb session-progress-orb" tabIndex={0} role="progressbar" aria-label="Session completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-valuetext={`${percent}% complete, ${completed} of ${total} goals`}>
    <svg className="concept-orb-visual" viewBox="0 0 32 32" aria-hidden="true"><circle className="concept-orb-track" cx="16" cy="16" r="13.75" /><circle className="concept-orb-progress" cx="16" cy="16" r="13.75" pathLength="100" strokeDasharray={`${percent} 100`} /></svg>
    <span className="session-progress-number" aria-hidden="true"><span>{percent}%</span></span>
  </div>
}
