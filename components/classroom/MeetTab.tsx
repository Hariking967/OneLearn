'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, Users,
  FileText, Loader2, Sparkles, CheckCircle, Radio,
  Clock, ChevronDown, ChevronRight
} from 'lucide-react'

interface Segment {
  id: string
  speaker_name: string
  text: string
  created_at: string
}

interface Participant {
  meet_id: string
  user_id: string
  display_name: string
  joined_at: string
}

interface Meet {
  id: string
  classroom_id: string
  host_id: string
  title: string
  status: 'active' | 'ended'
  summary: string | null
  started_at: string
  ended_at: string | null
}

interface Props {
  classroomId: string
  isTeacher: boolean
  currentUserId: string
  currentUserName: string
}

// Web Speech API type augmentation
declare global {
  interface Window {
    SpeechRecognition: any
    webkitSpeechRecognition: any
  }
}

export function MeetTab({ classroomId, isTeacher, currentUserId, currentUserName }: Props) {
  const [meets, setMeets] = useState<Meet[]>([])
  const [activeMeet, setActiveMeet] = useState<Meet | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [segments, setSegments] = useState<Segment[]>([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [ending, setEnding] = useState(false)
  const [summarizing, setSummarizing] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)
  const [isListening, setIsListening] = useState(false)
  const [micEnabled, setMicEnabled] = useState(true)
  const [expandedMeet, setExpandedMeet] = useState<string | null>(null)
  const [meetTitle, setMeetTitle] = useState('')
  const [joined, setJoined] = useState(false)
  const [liveText, setLiveText] = useState('')

  const recognitionRef = useRef<any>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const transcriptEndRef = useRef<HTMLDivElement | null>(null)

  const speechSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  useEffect(() => {
    loadMeets()
    return () => {
      stopListening()
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [classroomId])

  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [segments])

  async function loadMeets() {
    setLoading(true)
    try {
      const res = await fetch(`/api/classrooms/${classroomId}/meet`)
      if (res.ok) {
        const data: Meet[] = await res.json()
        setMeets(data)
        const active = data.find(m => m.status === 'active')
        if (active) {
          setActiveMeet(active)
          loadMeetDetails(active.id)
          startPolling(active.id)
        }
      }
    } finally {
      setLoading(false)
    }
  }

  async function loadMeetDetails(meetId: string) {
    const res = await fetch(`/api/classrooms/${classroomId}/meet/${meetId}`)
    if (res.ok) {
      const { meet, segments: segs, participants: parts } = await res.json()
      setActiveMeet(meet)
      setSegments(segs)
      setParticipants(parts)
    }
  }

  function startPolling(meetId: string) {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(() => loadMeetDetails(meetId), 3000)
  }

  async function startMeet() {
    setStarting(true)
    try {
      const res = await fetch(`/api/classrooms/${classroomId}/meet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: meetTitle.trim() || 'Class Meeting' }),
      })
      if (res.ok) {
        const meet = await res.json()
        setActiveMeet(meet)
        setMeets(prev => [meet, ...prev])
        setSegments([])
        setParticipants([])
        setSummary(null)
        setMeetTitle('')
        setJoined(true)
        startPolling(meet.id)
      }
    } finally {
      setStarting(false)
    }
  }

  async function joinMeet(meet: Meet) {
    await fetch(`/api/classrooms/${classroomId}/meet/${meet.id}/transcript`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: currentUserName }),
    })
    setJoined(true)
    setActiveMeet(meet)
    loadMeetDetails(meet.id)
    startPolling(meet.id)
  }

  async function leaveMeet() {
    stopListening()
    if (pollRef.current) clearInterval(pollRef.current)
    setJoined(false)
    setActiveMeet(null)
    setParticipants([])
    setSegments([])
  }

  async function endMeet() {
    if (!activeMeet) return
    stopListening()
    setEnding(true)
    try {
      await fetch(`/api/classrooms/${classroomId}/meet/${activeMeet.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ended', ended_at: new Date().toISOString() }),
      })
      setJoined(false)
      setActiveMeet(null)
      if (pollRef.current) clearInterval(pollRef.current)
      await loadMeets()
    } finally {
      setEnding(false)
    }
  }

  async function generateSummary(meetId: string) {
    setSummarizing(true)
    try {
      const res = await fetch(`/api/classrooms/${classroomId}/meet/${meetId}/summarize`, {
        method: 'POST',
      })
      if (res.ok) {
        const { summary: s } = await res.json()
        setSummary(s)
        setMeets(prev => prev.map(m => m.id === meetId ? { ...m, summary: s, status: 'ended' } : m))
      }
    } finally {
      setSummarizing(false)
    }
  }

  const sendSegment = useCallback(async (text: string, meetId: string) => {
    if (!text.trim() || !meetId) return
    await fetch(`/api/classrooms/${classroomId}/meet/${meetId}/transcript`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, speaker_name: currentUserName }),
    })
  }, [classroomId, currentUserName])

  function startListening() {
    if (!speechSupported || !activeMeet) return
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SR()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    const meetId = activeMeet.id

    recognition.onresult = (event: any) => {
      let interim = ''
      let final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) final += t
        else interim += t
      }
      setLiveText(interim)
      if (final.trim()) {
        sendSegment(final.trim(), meetId)
        setLiveText('')
      }
    }

    recognition.onerror = () => setIsListening(false)
    recognition.onend = () => {
      setIsListening(false)
      setLiveText('')
    }

    recognition.start()
    recognitionRef.current = recognition
    setIsListening(true)
  }

  function stopListening() {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setIsListening(false)
    setLiveText('')
  }

  function toggleMic() {
    if (isListening) {
      stopListening()
      setMicEnabled(false)
    } else {
      startListening()
      setMicEnabled(true)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', color: 'var(--mute)' }} />
      </div>
    )
  }

  // Active meet room view
  if (activeMeet && joined) {
    return (
      <div style={{ maxWidth: 900, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Meet header */}
        <div style={{
          borderRadius: 14, overflow: 'hidden',
          background: 'linear-gradient(135deg, oklch(0.18 0.04 270), oklch(0.14 0.03 280))',
          border: '1px solid oklch(0.42 0.18 295 / 0.3)',
        }}>
          <div style={{
            background: 'linear-gradient(90deg, oklch(0.42 0.18 295 / 0.2), oklch(0.55 0.18 295 / 0.1))',
            padding: '10px 18px', borderBottom: '1px solid oklch(0.42 0.18 295 / 0.2)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', fontFamily: 'var(--font-sans)' }}>
              {activeMeet.title}
            </span>
            <span style={{ fontSize: 11, color: 'var(--mute)', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>
              {Math.floor((Date.now() - new Date(activeMeet.started_at).getTime()) / 60000)}m elapsed
            </span>
          </div>

          {/* Participants grid */}
          <div style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <Users size={12} color="var(--mute)" />
              <span style={{ fontSize: 11, color: 'var(--mute)', fontFamily: 'var(--font-mono)' }}>
                {participants.length} participant{participants.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {participants.map(p => (
                <div key={p.user_id} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  width: 80,
                }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: 12, flexShrink: 0,
                    background: p.user_id === currentUserId
                      ? 'oklch(0.42 0.18 295 / 0.25)'
                      : 'rgba(255,255,255,0.06)',
                    border: `2px solid ${p.user_id === currentUserId ? 'oklch(0.55 0.18 295 / 0.6)' : 'var(--line)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    position: 'relative',
                  }}>
                    <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink-2)' }}>
                      {p.display_name[0].toUpperCase()}
                    </span>
                    {p.user_id === currentUserId && isListening && (
                      <div style={{
                        position: 'absolute', bottom: -4, right: -4,
                        width: 14, height: 14, borderRadius: '50%',
                        background: '#22c55e', border: '2px solid var(--bg)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Radio size={7} color="white" />
                      </div>
                    )}
                  </div>
                  <span style={{
                    fontSize: 10, color: 'var(--ink-2)', fontFamily: 'var(--font-mono)',
                    textAlign: 'center', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {p.display_name}
                    {p.user_id === currentUserId && ' (you)'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Transcript */}
        <div style={{
          borderRadius: 12,
          background: 'linear-gradient(180deg, rgba(21,21,29,0.75), rgba(15,15,21,0.75))',
          border: '1px solid var(--line)',
          overflow: 'hidden',
          flex: 1,
        }}>
          <div style={{
            padding: '10px 14px', borderBottom: '1px solid var(--line)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <FileText size={12} color="var(--mute)" />
            <span style={{ fontSize: 11, color: 'var(--mute)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Live Transcript
            </span>
            {!speechSupported && (
              <span style={{ fontSize: 10, color: 'hsl(38 92% 65%)', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>
                Speech recognition not supported in this browser
              </span>
            )}
          </div>
          <div style={{ maxHeight: 300, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {segments.length === 0 && !liveText ? (
              <p style={{ fontSize: 12, color: 'var(--mute)', fontFamily: 'var(--font-mono)', textAlign: 'center', padding: '20px 0' }}>
                {speechSupported
                  ? 'Enable your mic to start transcribing the meeting…'
                  : 'Transcript will appear here as participants speak…'}
              </p>
            ) : (
              segments.map(s => (
                <div key={s.id} style={{ display: 'flex', gap: 8 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: 'var(--purple-2)',
                    fontFamily: 'var(--font-mono)', flexShrink: 0, minWidth: 80,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {s.speaker_name}:
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.5 }}>{s.text}</span>
                </div>
              ))
            )}
            {liveText && (
              <div style={{ display: 'flex', gap: 8, opacity: 0.6 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#22c55e', fontFamily: 'var(--font-mono)', flexShrink: 0, minWidth: 80 }}>
                  {currentUserName}:
                </span>
                <span style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.5, fontStyle: 'italic' }}>{liveText}</span>
              </div>
            )}
            <div ref={transcriptEndRef} />
          </div>
        </div>

        {/* Controls */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
          padding: '14px', borderRadius: 14,
          background: 'rgba(15,15,21,0.8)',
          border: '1px solid var(--line)',
          backdropFilter: 'blur(12px)',
        }}>
          {speechSupported && (
            <button
              onClick={toggleMic}
              title={isListening ? 'Mute' : 'Unmute'}
              style={{
                width: 48, height: 48, borderRadius: '50%', cursor: 'pointer',
                background: isListening ? 'oklch(0.42 0.18 295 / 0.2)' : 'rgba(255,255,255,0.05)',
                border: `2px solid ${isListening ? 'oklch(0.55 0.18 295 / 0.6)' : 'var(--line)'}`,
                color: isListening ? 'var(--purple-2)' : 'var(--mute)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s',
              }}
            >
              {isListening ? <Mic size={18} /> : <MicOff size={18} />}
            </button>
          )}

          {isTeacher && activeMeet.host_id === currentUserId ? (
            <button
              onClick={endMeet}
              disabled={ending}
              style={{
                padding: '10px 28px', borderRadius: 12, cursor: 'pointer',
                background: 'hsl(0 85% 60% / 0.15)',
                border: '2px solid hsl(0 85% 60% / 0.4)',
                color: 'hsl(0 85% 70%)',
                fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-sans)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              {ending ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <PhoneOff size={14} />}
              End Meet
            </button>
          ) : (
            <button
              onClick={leaveMeet}
              style={{
                padding: '10px 28px', borderRadius: 12, cursor: 'pointer',
                background: 'hsl(0 85% 60% / 0.15)',
                border: '2px solid hsl(0 85% 60% / 0.4)',
                color: 'hsl(0 85% 70%)',
                fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-sans)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              <PhoneOff size={14} />
              Leave
            </button>
          )}
        </div>
      </div>
    )
  }

  // Pre-meet / meet list view
  return (
    <div style={{ maxWidth: 720 }}>
      {/* Active meet banner (join) */}
      {activeMeet && !joined && (
        <div style={{
          borderRadius: 14, overflow: 'hidden', marginBottom: 20,
          background: 'linear-gradient(135deg, oklch(0.18 0.04 145 / 0.4), oklch(0.14 0.03 145 / 0.3))',
          border: '1px solid oklch(0.55 0.18 145 / 0.35)',
        }}>
          <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e', animation: 'pulse 2s infinite' }} />
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{activeMeet.title}</p>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--mute)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                Live · Started {new Date(activeMeet.started_at).toLocaleTimeString()}
              </p>
            </div>
            <button
              onClick={() => joinMeet(activeMeet)}
              style={{
                padding: '8px 20px', borderRadius: 10, cursor: 'pointer',
                background: 'oklch(0.55 0.18 145 / 0.2)',
                border: '1px solid oklch(0.55 0.18 145 / 0.4)',
                color: 'oklch(0.72 0.18 145)',
                fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-sans)',
              }}
            >
              Join
            </button>
          </div>
        </div>
      )}

      {/* Start meet (teacher only) */}
      {isTeacher && !activeMeet && (
        <div style={{
          borderRadius: 12, padding: 16, marginBottom: 20,
          background: 'linear-gradient(180deg, rgba(21,21,29,0.75), rgba(15,15,21,0.75))',
          border: '1px solid var(--line)',
        }}>
          <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Start a class meeting</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={meetTitle}
              onChange={e => setMeetTitle(e.target.value)}
              placeholder="Meeting title (optional)"
              onKeyDown={e => e.key === 'Enter' && startMeet()}
              style={{
                flex: 1, background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 8,
                padding: '8px 12px', fontSize: 13, color: 'var(--ink)',
              }}
            />
            <button
              onClick={startMeet}
              disabled={starting}
              style={{
                padding: '8px 20px', borderRadius: 9, cursor: 'pointer',
                background: 'oklch(0.42 0.18 295 / 0.15)',
                border: '1px solid oklch(0.42 0.18 295 / 0.3)',
                color: 'var(--purple-2)',
                fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-sans)',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {starting ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Video size={13} />}
              Start Meet
            </button>
          </div>
        </div>
      )}

      {/* Past meets */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <Clock size={12} color="var(--mute)" />
          <span style={{ fontSize: 11, color: 'var(--mute)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Past Meetings
          </span>
        </div>
        {meets.filter(m => m.status === 'ended').length === 0 ? (
          <div style={{
            padding: '40px 0', textAlign: 'center', color: 'var(--mute)',
            fontSize: 13, fontFamily: 'var(--font-mono)',
            border: '1px dashed var(--line)', borderRadius: 12,
          }}>
            No meetings yet.{isTeacher && ' Start one above!'}
          </div>
        ) : (
          meets.filter(m => m.status === 'ended').map(meet => (
            <div key={meet.id} style={{
              borderRadius: 12, marginBottom: 10, overflow: 'hidden',
              background: 'linear-gradient(180deg, rgba(21,21,29,0.75), rgba(15,15,21,0.75))',
              border: '1px solid var(--line)',
            }}>
              <div
                onClick={() => setExpandedMeet(expandedMeet === meet.id ? null : meet.id)}
                style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                  background: 'oklch(0.42 0.18 295 / 0.1)',
                  border: '1px solid oklch(0.42 0.18 295 / 0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Video size={14} color="var(--purple-2)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>{meet.title}</p>
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--mute)', fontFamily: 'var(--font-mono)' }}>
                    {new Date(meet.started_at).toLocaleString()}
                    {meet.ended_at && ` · ${Math.floor((new Date(meet.ended_at).getTime() - new Date(meet.started_at).getTime()) / 60000)}m`}
                  </p>
                </div>
                {meet.summary && <CheckCircle size={14} color="oklch(0.72 0.18 145)" />}
                {expandedMeet === meet.id ? <ChevronDown size={14} color="var(--mute)" /> : <ChevronRight size={14} color="var(--mute)" />}
              </div>

              {expandedMeet === meet.id && (
                <div style={{ borderTop: '1px solid var(--line)', padding: '12px 16px' }}>
                  {meet.summary ? (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                        <Sparkles size={12} color="var(--purple-2)" />
                        <span style={{ fontSize: 11, color: 'var(--purple-2)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          AI Summary (saved to resources)
                        </span>
                      </div>
                      <div style={{
                        fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.7,
                        whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)',
                        background: 'var(--bg-3)', borderRadius: 8, padding: 12,
                        maxHeight: 300, overflowY: 'auto',
                      }}>
                        {meet.summary}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p style={{ fontSize: 12, color: 'var(--mute)', fontFamily: 'var(--font-mono)', margin: '0 0 10px' }}>
                        No summary generated yet.
                      </p>
                      {isTeacher && (
                        <button
                          onClick={() => generateSummary(meet.id)}
                          disabled={summarizing}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 7,
                            padding: '7px 16px', borderRadius: 9, cursor: 'pointer',
                            background: 'oklch(0.42 0.18 295 / 0.12)',
                            border: '1px solid oklch(0.42 0.18 295 / 0.3)',
                            color: 'var(--purple-2)',
                            fontSize: 12, fontFamily: 'var(--font-sans)',
                          }}
                        >
                          {summarizing
                            ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                            : <Sparkles size={12} />
                          }
                          Generate AI Summary & Save to Resources
                        </button>
                      )}
                    </div>
                  )}
                  {summary && meet.id === meets[0]?.id && (
                    <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, background: 'oklch(0.72 0.18 145 / 0.08)', border: '1px solid oklch(0.72 0.18 145 / 0.2)', fontSize: 11, color: 'oklch(0.72 0.18 145)', fontFamily: 'var(--font-mono)' }}>
                      Summary saved to classroom resources!
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
