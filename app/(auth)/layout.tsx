export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Grid */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px)',
        backgroundSize: '64px 64px',
        maskImage: 'radial-gradient(ellipse at 50% 40%, rgba(0,0,0,0.7), transparent 70%)',
        WebkitMaskImage: 'radial-gradient(ellipse at 50% 40%, rgba(0,0,0,0.7), transparent 70%)',
      }} />

      {/* Purple vignette top */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 50% 0%, oklch(0.68 0.19 295 / 0.18), transparent 55%)',
      }} />

      {/* Ambient orbs */}
      <div className="orb-drift-1" style={{
        position: 'absolute', top: '-20%', left: '-10%',
        width: 500, height: 500, borderRadius: '50%', pointerEvents: 'none',
        background: 'radial-gradient(circle, oklch(0.68 0.19 295 / 0.12), transparent 65%)',
      }} />
      <div className="orb-drift-2" style={{
        position: 'absolute', bottom: '-20%', right: '-10%',
        width: 400, height: 400, borderRadius: '50%', pointerEvents: 'none',
        background: 'radial-gradient(circle, oklch(0.6 0.18 250 / 0.08), transparent 65%)',
      }} />

      {/* Content */}
      <div style={{ width: '100%', maxWidth: 420, padding: '0 16px', position: 'relative', zIndex: 1 }}>
        {children}
      </div>
    </div>
  )
}
