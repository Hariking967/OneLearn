'use client'

import { useEffect, useRef } from 'react'

function ConstellationCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let animId: number

    type Star = { x: number; y: number; vx: number; vy: number; r: number; a: number; tw: number }
    let W = 0, H = 0, stars: Star[] = []

    function init() {
      if (!canvas) return
      const dpr = window.devicePixelRatio || 1
      W = canvas.offsetWidth || window.innerWidth
      H = canvas.offsetHeight || window.innerHeight
      canvas.width = W * dpr
      canvas.height = H * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      stars = Array.from({ length: 65 }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.07,
        vy: (Math.random() - 0.5) * 0.07,
        r: 0.5 + Math.random() * 1.3,
        a: 0.15 + Math.random() * 0.45,
        tw: Math.random() * Math.PI * 2,
      }))
    }

    function tick(t: number) {
      ctx.clearRect(0, 0, W, H)
      const N = stars.length
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const dx = stars[i].x - stars[j].x
          const dy = stars[i].y - stars[j].y
          const d = Math.hypot(dx, dy)
          if (d < 130) {
            ctx.strokeStyle = `rgba(167,139,250,${(1 - d / 130) * 0.07})`
            ctx.lineWidth = 0.5
            ctx.beginPath(); ctx.moveTo(stars[i].x, stars[i].y); ctx.lineTo(stars[j].x, stars[j].y); ctx.stroke()
          }
        }
      }
      stars.forEach(s => {
        s.x += s.vx; s.y += s.vy
        if (s.x < 0 || s.x > W) s.vx *= -1
        if (s.y < 0 || s.y > H) s.vy *= -1
        const tw = (Math.sin(t * 0.001 + s.tw) + 1) / 2
        ctx.fillStyle = `rgba(200,180,255,${s.a * (0.45 + tw * 0.55)})`
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill()
      })
      animId = requestAnimationFrame(tick)
    }

    init()
    window.addEventListener('resize', init)
    animId = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', init) }
  }, [])

  return (
    <canvas
      ref={ref}
      style={{ position: 'fixed', inset: 0, left: '240px', width: 'calc(100vw - 240px)', height: '100vh', pointerEvents: 'none', zIndex: 0 }}
    />
  )
}

function DriftingGlyphs() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const layer = ref.current
    if (!layer) return
    const glyphs = ['∂', 'Σ', '∫', 'ψ', '∞', '≈', 'π', '∇', 'λ', 'μ', 'φ', '≡', '∴', 'α', 'β', 'γ', 'θ', 'Ω', 'ℵ']
    const items: { el: HTMLDivElement; vy: number; phase: number }[] = []
    for (let i = 0; i < 11; i++) {
      const el = document.createElement('div')
      el.textContent = glyphs[Math.floor(Math.random() * glyphs.length)]
      const size = 64 + Math.random() * 130
      el.style.cssText = `position:absolute;font-family:var(--font-serif),"Times New Roman",serif;font-style:italic;font-size:${size}px;color:rgba(167,139,250,0.045);pointer-events:none;user-select:none;left:${Math.random() * 100}%;top:${Math.random() * 100}%;`
      layer.appendChild(el)
      items.push({ el, vy: 0.04 + Math.random() * 0.07, phase: Math.random() * Math.PI * 2 })
    }
    let animId: number
    function tick(t: number) {
      items.forEach(({ el, vy, phase }) => {
        const x = Math.sin(t * 0.0002 + phase) * 18
        const y = Math.cos(t * 0.00015 + phase * 1.3) * 28 - (t * 0.003 * vy) % 220
        el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`
      })
      animId = requestAnimationFrame(tick)
    }
    animId = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(animId); items.forEach(({ el }) => el.remove()) }
  }, [])

  return (
    <div
      ref={ref}
      style={{ position: 'fixed', inset: 0, left: '240px', overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}
    />
  )
}

export function AppBackground() {
  return (
    <>
      <ConstellationCanvas />
      {/* CSS grid lines */}
      <div style={{
        position: 'fixed', inset: 0, left: '240px', pointerEvents: 'none', zIndex: 0,
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.022) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.022) 1px,transparent 1px)',
        backgroundSize: '64px 64px',
        maskImage: 'radial-gradient(ellipse at 50% 30%, rgba(0,0,0,0.65), transparent 72%)',
        WebkitMaskImage: 'radial-gradient(ellipse at 50% 30%, rgba(0,0,0,0.65), transparent 72%)',
      }} />
      {/* Purple vignette */}
      <div style={{
        position: 'fixed', inset: 0, left: '240px', pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(ellipse at 68% -5%, oklch(0.68 0.19 295 / 0.2), transparent 52%)',
      }} />
      <DriftingGlyphs />
    </>
  )
}
