'use client'
import { useState } from 'react'
import { BarChart3, Loader2, X } from 'lucide-react'

interface Props {
  classroomId: string
  assignmentId: string
  assignmentTitle: string
}

export function AssignmentReportDialog({ classroomId, assignmentId, assignmentTitle }: Props) {
  const [open, setOpen] = useState(false)
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  async function load() {
    setOpen(true)
    if (report) return
    setLoading(true)
    try {
      const res = await fetch(`/api/classrooms/${classroomId}/assignments/${assignmentId}/report`)
      if (res.ok) setReport(await res.json())
    } finally { setLoading(false) }
  }

  return (
    <>
      <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, background: 'var(--bg-3)', border: '1px solid var(--line)', color: 'var(--mute)', fontSize: 11, cursor: 'pointer', flexShrink: 0 }}>
        <BarChart3 size={11} /> Report
      </button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={() => setOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#0f0f13', border: '1px solid var(--line)', borderRadius: 16, width: '90vw', maxWidth: 720, maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: 17, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{assignmentTitle} — Report</span>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--mute)', cursor: 'pointer', padding: 4 }}><X size={16} /></button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Loader2 size={20} style={{ animation: 'spin 1s linear infinite', color: 'var(--mute)' }} /></div>}
              {report && !loading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    {[
                      { label: 'Submissions', value: String(report.submissions.length) },
                      { label: 'Avg Score', value: report.avgScore != null ? `${report.avgScore}%` : '—' },
                      { label: 'Hardest Q', value: report.hardest ? `${report.hardest.pct}% correct` : '—' },
                    ].map(c => (
                      <div key={c.label} style={{ padding: 14, borderRadius: 10, background: 'var(--bg-3)', border: '1px solid var(--line)', textAlign: 'center' }}>
                        <p style={{ fontFamily: 'var(--font-serif)', fontSize: 24, color: 'var(--ink)', margin: '0 0 4px' }}>{c.value}</p>
                        <p style={{ fontSize: 11, color: 'var(--mute)', margin: 0, fontFamily: 'var(--font-mono)' }}>{c.label}</p>
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: 14, borderRadius: 10, background: 'var(--bg-3)', border: '1px solid var(--line)' }}>
                    <p style={{ fontSize: 11, color: 'var(--mute)', fontFamily: 'var(--font-mono)', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Score Distribution</p>
                    {Object.entries(report.distribution).map(([range, count]: any) => (
                      <div key={range} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--mute)', width: 60, flexShrink: 0 }}>{range}%</span>
                        <div style={{ flex: 1, height: 8, background: 'var(--line)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ height: '100%', background: 'oklch(0.42 0.18 295)', borderRadius: 4, width: report.submissions.length ? `${(count / report.submissions.length) * 100}%` : '0%', transition: 'width 0.5s' }} />
                        </div>
                        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-2)', width: 20, textAlign: 'right', flexShrink: 0 }}>{count}</span>
                      </div>
                    ))}
                  </div>
                  {report.insight && (
                    <div style={{ padding: 14, borderRadius: 10, background: 'oklch(0.42 0.18 295 / 0.08)', border: '1px solid oklch(0.42 0.18 295 / 0.2)' }}>
                      <p style={{ fontSize: 12, color: 'var(--purple-2)', margin: 0, fontStyle: 'italic', lineHeight: 1.6 }}>💡 {report.insight}</p>
                    </div>
                  )}
                  <div style={{ borderRadius: 10, border: '1px solid var(--line)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-3)', borderBottom: '1px solid var(--line)' }}>
                          {['Student', 'Score', 'Submitted'].map(h => <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--mute)', fontWeight: 500 }}>{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {report.submissions.map((s: any, i: number) => (
                          <tr key={s.id} style={{ borderBottom: '1px solid var(--line)', background: i % 2 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                            <td style={{ padding: '8px 12px', color: 'var(--ink)' }}>{s.student_name}</td>
                            <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', color: s.score != null ? (s.score >= 70 ? 'oklch(0.72 0.18 145)' : s.score >= 40 ? 'hsl(38 92% 65%)' : 'hsl(0 85% 70%)') : 'var(--mute)' }}>{s.score != null ? `${s.score}%` : '—'}</td>
                            <td style={{ padding: '8px 12px', color: 'var(--mute)', fontFamily: 'var(--font-mono)' }}>{new Date(s.submitted_at).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
