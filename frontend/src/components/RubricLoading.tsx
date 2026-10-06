import './RubricLoading.css'

export function RubricLoading() {
  return <div className="setup-loading" role="status" aria-label="Creating your rubric">
    <div className="rubric-loading" aria-hidden="true">
      <svg viewBox="0 0 200 200" fill="none">
        <ellipse className="rubric-loading-shadow" cx="100" cy="171" rx="43" ry="5" />
        <g className="rubric-loading-stack">
          <rect className="rubric-loading-back" x="55" y="42" width="90" height="116" rx="12" transform="rotate(-10 100 100)" />
          <rect className="rubric-loading-middle" x="55" y="42" width="90" height="116" rx="12" transform="rotate(7 100 100)" />
          <rect className="rubric-loading-page" x="55" y="38" width="90" height="116" rx="12" />
          <path className="rubric-loading-heading" d="M73 60H108" />
          {[80, 104, 128].map((y, index) => <g key={y}>
            <rect className="rubric-loading-box" x="72" y={y - 6} width="12" height="12" rx="3" />
            <path className={`rubric-loading-line rubric-loading-step-${index}`} d={`M94 ${y}H127`} />
            <path className={`rubric-loading-check rubric-loading-step-${index}`} d={`M74 ${y}l3 3 6-7`} />
          </g>)}
        </g>
        <g className="rubric-loading-spark"><path d="M159 48v12m-6-6h12" /></g>
        <circle className="rubric-loading-dot" cx="39" cy="123" r="3" />
      </svg>
    </div>
  </div>
}
