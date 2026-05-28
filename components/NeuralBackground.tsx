export function NeuralBackground() {
  const nodes = [
    { x: 12, y: 18, size: 'md', delay: '0s', drift: 'orb-drift-1' },
    { x: 78, y: 12, size: 'sm', delay: '0.8s', drift: 'orb-drift-2' },
    { x: 88, y: 65, size: 'md', delay: '1.4s', drift: 'orb-drift-3' },
    { x: 22, y: 72, size: 'sm', delay: '2.1s', drift: 'orb-drift-1' },
    { x: 55, y: 30, size: 'sm', delay: '0.3s', drift: 'orb-drift-2' },
    { x: 40, y: 80, size: 'md', delay: '1.8s', drift: 'orb-drift-3' },
    { x: 68, y: 48, size: 'sm', delay: '0.6s', drift: 'orb-drift-1' },
    { x: 8,  y: 50, size: 'sm', delay: '2.5s', drift: 'orb-drift-2' },
  ]

  const lines = [
    { x1: 12, y1: 18, x2: 55, y2: 30 },
    { x1: 55, y1: 30, x2: 78, y2: 12 },
    { x1: 55, y1: 30, x2: 68, y2: 48 },
    { x1: 68, y1: 48, x2: 88, y2: 65 },
    { x1: 12, y1: 18, x2: 22, y2: 72 },
    { x1: 22, y1: 72, x2: 40, y2: 80 },
    { x1: 40, y1: 80, x2: 68, y2: 48 },
    { x1: 8,  y1: 50, x2: 22, y2: 72 },
  ]

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {/* Connection lines */}
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="line-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(271,91%,65%)" stopOpacity="0" />
            <stop offset="50%" stopColor="hsl(271,91%,65%)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="hsl(271,91%,65%)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {lines.map((l, i) => (
          <line
            key={i}
            x1={`${l.x1}%`} y1={`${l.y1}%`}
            x2={`${l.x2}%`} y2={`${l.y2}%`}
            stroke="url(#line-grad)"
            strokeWidth="1"
            strokeDasharray="6 4"
            style={{
              animation: `line-draw 1.5s ease ${i * 0.15}s both`,
              opacity: 0.35,
            }}
          />
        ))}
      </svg>

      {/* Nodes */}
      {nodes.map((n, i) => (
        <div
          key={i}
          className={`neural-node neural-node-${n.size} ${n.drift}`}
          style={{
            left: `${n.x}%`,
            top: `${n.y}%`,
            animationDelay: n.delay,
          }}
        />
      ))}
    </div>
  )
}
