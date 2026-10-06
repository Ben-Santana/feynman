import { useRef, useState } from 'react'
import { PaperReview, type Paper, type Review } from '../components/PaperReview'
import './PaperStampPreview.css'

const sample: Paper = {
  id: 'stamp-demo', markdown: '', papers: [
    {
      id: 'sample-1', markdown: '',
      problem: 'A 2 kg cart accelerates at 3 m/s² on a frictionless track. Find the net force acting on the cart.',
      steps: ['Newton’s second law says the net force equals mass times acceleration.\n\n$F = ma$', 'Substitute the mass and acceleration.\n\n$F = 2 \\times 3 = 6\\text{ N}$', 'The net force acts in the direction of the acceleration.'],
      conclusion: '$F = 6\\text{ N}$',
    },
    {
      id: 'sample-2', markdown: '',
      problem: 'A 3 kg book rests on a table. Using g = 10 m/s², find the net force acting on the book.',
      steps: ['The gravitational force on the book is its weight.\n\n$W = mg = 3 \\times 10 = 30\\text{ N}$', 'Since gravity pulls downward, the net force on the book is 30 N downward.', 'The book remains at rest on the table.'],
      conclusion: '$F_{\\text{net}} = 30\\text{ N}$ downward',
    },
    {
      id: 'sample-3', markdown: '',
      problem: 'A 4 kg box is pushed right with 20 N. Friction exerts 8 N to the left. Find the box’s acceleration.',
      steps: ['Choose right as the positive direction. The forces oppose one another.\n\n$F_{\\text{net}} = 20 - 8 = 12\\text{ N}$', 'Apply Newton’s second law.\n\n$a = F_{\\text{net}} / m = 12 / 4$', 'The acceleration is 3 m/s² to the right.'],
      conclusion: '$a = 3\\text{ m/s}^2$ to the right',
    },
  ],
}

export default function StampPreview() {
  const [take, setTake] = useState(0)
  const [review, setReview] = useState<Review>()
  const [error, setError] = useState('')
  const attempts = useRef(0)
  function restart() { setReview(undefined); setError(''); setTake(value => value + 1) }
  return <main className="stamp-preview">
    <header className="stamp-preview-nav"><a href="/">feynman<span>✳</span></a><span>THE INTERACTION LAB <i /> 001</span></header>
    <section className="stamp-preview-main">
      <div className="stamp-preview-copy"><span className="stamp-preview-eyebrow">A LITTLE WEIGHT TO YOUR JUDGMENT</span><h1>Make your<br /><em>mark.</em></h1><p>Read the reasoning. Catch the mistake.<br />Then put a little ink on it.</p><div className="stamp-preview-caption"><span>↘</span><p>Three papers. Your call.<br /><small>Open the stack to try it.</small></p></div></div>
      <div className="stamp-preview-stack">
        <div className="stamp-preview-sheet"><div className="stamp-preview-sheet-top"><span>FEYNMAN CLASSROOM</span><span>ANALYZE / 04</span></div><div className="stamp-preview-sheet-rule" /><p className="stamp-preview-sheet-title">Newton’s second law</p><div className="stamp-preview-handwriting">Force = mass × acceleration<br /><span>F = ma</span><br />Let’s see if this adds up.</div><div className="stamp-preview-open"><PaperReview key={take} paper={sample} review={review} busy={false} error={error} onSubmit={async value => {
          attempts.current += 1
          if (new URLSearchParams(window.location.search).get('submission') === 'fail' && attempts.current === 1) { setError('Sample submission failed. Your grades are preserved; try stamping again.'); return false }
          setReview(value); return true
        }} /><span>{review ? 'View your marks' : 'Grade these papers'} <span aria-hidden="true">↗</span></span></div><div className="stamp-preview-sheet-bottom">{review ? <><span>All three, stamped.</span><button onClick={restart}>Try it again ↻</button></> : <><span>03 PAPERS</span><span>AWAITING YOUR STAMP</span></>}</div></div>
      </div>
    </section>
    <footer className="stamp-preview-footer"><span><i /> An experiment in making learning feel tangible.</span><span>PRESS · INK · REBOUND</span></footer>
  </main>
}
