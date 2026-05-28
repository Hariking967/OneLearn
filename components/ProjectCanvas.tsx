'use client'

import { useEffect, useRef } from 'react'

interface Props {
  hue?: number
  seed?: string
}

export function ProjectCanvas({ hue = 295, seed = 'x' }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const dpr = window.devicePixelRatio || 1
    const W = canvas.offsetWidth || 300
    const H = canvas.offsetHeight || 140
    canvas.width = W * dpr
    canvas.height = H * dpr
    ctx.scale(dpr, dpr)

    // seeded pseudo-random
    let s = 0
    for (const c of seed) s = ((s << 5) - s + c.charCodeAt(0)) | 0
    function rand() { s = Math.imul(s ^ (s >>> 16), 0x45d9f3b) | 0; return ((s >>> 0) / 0xffffffff) }

    const g = ctx.createLinearGradient(0, 0, W, H)
    g.addColorStop(0, `hsl(${hue} 25% 7%)`)
    g.addColorStop(1, '#0a0a0f')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)

    const N = 26
    const pts = Array.from({ length: N }, () => ({ x: rand() * W, y: rand() * H }))

    ctx.lineWidth = 0.6
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y)
        if (d < 68) {
          ctx.globalAlpha = (1 - d / 68) * 0.22
          ctx.strokeStyle = `hsl(${hue} 70% 68%)`
          ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke()
        }
      }
    }
    ctx.globalAlpha = 1
    pts.forEach(p => {
      const rg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 3.5)
      rg.addColorStop(0, `hsl(${hue} 80% 78%)`)
      rg.addColorStop(1, 'transparent')
      ctx.fillStyle = rg
      ctx.globalAlpha = 0.9
      ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2); ctx.fill()
    })
    ctx.globalAlpha = 1
  }, [hue, seed])

  return (
    <canvas
      ref={ref}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    />
  )
}
