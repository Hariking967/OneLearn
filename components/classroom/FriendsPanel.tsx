'use client'
import React, { useState, useEffect } from 'react'
import { UserPlus, UserCheck, UserX, Loader2, Users, Bell } from 'lucide-react'

interface Friendship {
  id: string
  requester_id: string
  addressee_id: string
  status: 'pending' | 'accepted' | 'declined'
  created_at: string
  friend_id: string
  friend_profile: { id: string; display_name: string | null } | null
  is_requester: boolean
}

interface ClassroomMember {
  student_id: string
  email: string
  user_profiles?: { display_name: string | null }
}

interface Props {
  classroomId: string
  currentUserId: string
  members: ClassroomMember[]
  isTeacher: boolean
}

export function FriendsPanel({ classroomId, currentUserId, members, isTeacher }: Props) {
  const [friendships, setFriendships] = useState<Friendship[]>([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)
  const [pingMsg, setPingMsg] = useState('')
  const [pingingId, setPingingId] = useState<string | null>(null)
  const [pingSuccess, setPingSuccess] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/friends')
      if (res.ok) setFriendships(await res.json())
    } finally { setLoading(false) }
  }

  async function sendRequest(userId: string) {
    setActionId(userId)
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addressee_id: userId }),
      })
      if (res.ok || res.status === 409) await load()
    } finally { setActionId(null) }
  }

  async function respond(friendshipId: string, status: 'accepted' | 'declined') {
    setActionId(friendshipId)
    try {
      await fetch(`/api/friends/${friendshipId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      await load()
    } finally { setActionId(null) }
  }

  async function unfriend(friendshipId: string) {
    setActionId(friendshipId)
    try {
      await fetch(`/api/friends/${friendshipId}`, { method: 'DELETE' })
      await load()
    } finally { setActionId(null) }
  }

  async function pingFriend(userId: string, message: string) {
    setPingingId(userId)
    try {
      const res = await fetch(`/api/classrooms/${classroomId}/ping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_user_id: userId, message }),
      })
      if (res.ok) {
        setPingSuccess(userId)
        setTimeout(() => setPingSuccess(null), 2500)
      }
    } finally { setPingingId(null) }
  }

  const friendshipMap = new Map(friendships.map(f => [f.friend_id, f]))

  const pendingReceived = friendships.filter(f => !f.is_requester && f.status === 'pending')
  const accepted = friendships.filter(f => f.status === 'accepted')

  // Classroom members excluding self, enriched with friendship state
  const classroomPeople = members
    .filter(m => m.student_id !== currentUserId)
    .map(m => ({
      id: m.student_id,
      name: m.user_profiles?.display_name || m.email || m.student_id.slice(0, 8),
      friendship: friendshipMap.get(m.student_id) ?? null,
    }))

  return (
    <div style={{ maxWidth: 600 }}>
      {/* Pending friend requests */}
      {pendingReceived.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <Bell size={12} color="hsl(38 92% 65%)" />
            <span style={{ fontSize: 11, color: 'hsl(38 92% 65%)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Pending Requests
            </span>
          </div>
          {pendingReceived.map(f => (
            <div key={f.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
              borderRadius: 10, marginBottom: 8,
              background: 'hsl(38 92% 50% / 0.06)', border: '1px solid hsl(38 92% 50% / 0.2)',
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'hsl(38 92% 50% / 0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 600, color: 'hsl(38 92% 65%)',
                flexShrink: 0,
              }}>
                {(f.friend_profile?.display_name ?? '?')[0].toUpperCase()}
              </div>
              <span style={{ flex: 1, fontSize: 13, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {f.friend_profile?.display_name ?? f.friend_id.slice(0, 8)}
              </span>
              <button
                onClick={() => respond(f.id, 'accepted')}
                disabled={actionId === f.id}
                style={{ padding: '5px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, background: 'oklch(0.42 0.18 295 / 0.15)', border: '1px solid oklch(0.42 0.18 295 / 0.3)', color: 'var(--purple-2)' }}
              >
                {actionId === f.id ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : 'Accept'}
              </button>
              <button
                onClick={() => respond(f.id, 'declined')}
                disabled={actionId === f.id}
                style={{ padding: '5px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 12, background: 'none', border: '1px solid var(--line)', color: 'var(--mute)' }}
              >
                Decline
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Friends (accepted) */}
      {accepted.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <UserCheck size={12} color="oklch(0.72 0.18 145)" />
            <span style={{ fontSize: 11, color: 'oklch(0.72 0.18 145)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Friends ({accepted.length})
            </span>
          </div>
          {accepted.map(f => (
            <div key={f.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
              borderRadius: 10, marginBottom: 8,
              background: 'linear-gradient(180deg, rgba(21,21,29,0.75), rgba(15,15,21,0.75))',
              border: '1px solid var(--line)',
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'oklch(0.42 0.18 295 / 0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 600, color: 'var(--purple-2)', flexShrink: 0,
              }}>
                {(f.friend_profile?.display_name ?? '?')[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--ink)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.friend_profile?.display_name ?? f.friend_id.slice(0, 8)}
                </p>
              </div>
              {pingSuccess === f.friend_id ? (
                <span style={{ fontSize: 11, color: 'oklch(0.72 0.18 145)', fontFamily: 'var(--font-mono)' }}>Pinged!</span>
              ) : (
                <button
                  onClick={() => pingFriend(f.friend_id, `Hey! Check the classroom.`)}
                  disabled={pingingId === f.friend_id}
                  title="Ping this friend"
                  style={{
                    padding: '5px 12px', borderRadius: 8, cursor: 'pointer',
                    background: 'oklch(0.42 0.18 295 / 0.08)', border: '1px solid oklch(0.42 0.18 295 / 0.2)',
                    color: 'var(--purple-2)', fontSize: 12, fontFamily: 'var(--font-sans)',
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  {pingingId === f.friend_id
                    ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
                    : <Bell size={11} />}
                  Ping
                </button>
              )}
              <button
                onClick={() => unfriend(f.id)}
                disabled={actionId === f.id}
                style={{ padding: 6, borderRadius: 7, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mute)' }}
                title="Unfriend"
                onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = 'hsl(0 85% 70%)'}
                onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = 'var(--mute)'}
              >
                {actionId === f.id ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <UserX size={12} />}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Classroom members — add as friends */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <Users size={12} color="var(--mute)" />
          <span style={{ fontSize: 11, color: 'var(--mute)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Classmates
          </span>
        </div>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}>
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', color: 'var(--mute)' }} />
          </div>
        ) : classroomPeople.length === 0 ? (
          <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--mute)', fontSize: 12, fontFamily: 'var(--font-mono)', border: '1px dashed var(--line)', borderRadius: 10 }}>
            No other classmates yet.
          </div>
        ) : (
          classroomPeople.map(person => {
            const f = person.friendship
            const isPendingSent = f?.is_requester && f.status === 'pending'
            const isPendingReceived = !f?.is_requester && f?.status === 'pending'
            const isFriend = f?.status === 'accepted'

            return (
              <div key={person.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                borderRadius: 10, marginBottom: 8,
                background: 'linear-gradient(180deg, rgba(21,21,29,0.75), rgba(15,15,21,0.75))',
                border: '1px solid var(--line)',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: isFriend ? 'oklch(0.42 0.18 295 / 0.15)' : 'rgba(255,255,255,0.05)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 600,
                  color: isFriend ? 'var(--purple-2)' : 'var(--mute)',
                  flexShrink: 0,
                }}>
                  {person.name[0].toUpperCase()}
                </div>
                <span style={{ flex: 1, fontSize: 13, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {person.name}
                </span>

                {isFriend ? (
                  pingSuccess === person.id ? (
                    <span style={{ fontSize: 11, color: 'oklch(0.72 0.18 145)', fontFamily: 'var(--font-mono)' }}>Pinged!</span>
                  ) : (
                    <button
                      onClick={() => pingFriend(person.id, 'Hey! Check the classroom.')}
                      disabled={pingingId === person.id}
                      style={{
                        padding: '5px 12px', borderRadius: 8, cursor: 'pointer',
                        background: 'oklch(0.42 0.18 295 / 0.08)', border: '1px solid oklch(0.42 0.18 295 / 0.2)',
                        color: 'var(--purple-2)', fontSize: 12, fontFamily: 'var(--font-sans)',
                        display: 'flex', alignItems: 'center', gap: 5,
                      }}
                    >
                      {pingingId === person.id ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Bell size={11} />}
                      Ping
                    </button>
                  )
                ) : isPendingSent ? (
                  <span style={{ fontSize: 11, color: 'var(--mute)', fontFamily: 'var(--font-mono)' }}>Request sent</span>
                ) : isPendingReceived ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => respond(f!.id, 'accepted')} style={{ padding: '4px 10px', borderRadius: 7, cursor: 'pointer', fontSize: 11, background: 'oklch(0.42 0.18 295 / 0.15)', border: '1px solid oklch(0.42 0.18 295 / 0.3)', color: 'var(--purple-2)' }}>Accept</button>
                    <button onClick={() => respond(f!.id, 'declined')} style={{ padding: '4px 8px', borderRadius: 7, cursor: 'pointer', fontSize: 11, background: 'none', border: '1px solid var(--line)', color: 'var(--mute)' }}>Decline</button>
                  </div>
                ) : (
                  <button
                    onClick={() => sendRequest(person.id)}
                    disabled={actionId === person.id}
                    style={{
                      padding: '5px 12px', borderRadius: 8, cursor: 'pointer',
                      background: 'none', border: '1px solid var(--line)', color: 'var(--mute)',
                      fontSize: 12, fontFamily: 'var(--font-sans)',
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'oklch(0.42 0.18 295 / 0.4)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--purple-2)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--line)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--mute)' }}
                  >
                    {actionId === person.id
                      ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
                      : <UserPlus size={11} />}
                    Add Friend
                  </button>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
