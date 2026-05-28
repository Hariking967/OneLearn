'use client'
import { useState, useEffect, useRef } from 'react'
import { FolderOpen, Plus, Trash2, Upload, FileText, Loader2, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface ResourceFile {
  id: string
  name: string
  type: string
  storage_path: string | null
  url: string | null
  size_bytes: number | null
  ingested: boolean
  created_at: string
}

interface Section {
  id: string
  title: string
  order_index: number
  classroom_resource_files: ResourceFile[]
}

interface Props {
  classroomId: string
  isTeacher: boolean
}

export function ResourcesTab({ classroomId, isTeacher }: Props) {
  const [sections, setSections] = useState<Section[]>([])
  const [loading, setLoading] = useState(true)
  const [newSectionTitle, setNewSectionTitle] = useState('')
  const [addingSection, setAddingSection] = useState(false)
  const [uploadingTo, setUploadingTo] = useState<string | null>(null)
  const [ingestingId, setIngestingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadSectionRef = useRef<string | null>(null)

  useEffect(() => { load() }, [classroomId])

  async function load() {
    setLoading(true)
    const res = await fetch(`/api/classrooms/${classroomId}/resource-sections`)
    if (res.ok) setSections(await res.json())
    setLoading(false)
  }

  async function addSection() {
    if (!newSectionTitle.trim()) return
    setAddingSection(true)
    const res = await fetch(`/api/classrooms/${classroomId}/resource-sections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newSectionTitle, order_index: sections.length }),
    })
    if (res.ok) {
      const s = await res.json()
      setSections(p => [...p, { ...s, classroom_resource_files: [] }])
    }
    setNewSectionTitle('')
    setAddingSection(false)
  }

  async function deleteSection(sectionId: string) {
    await fetch(`/api/classrooms/${classroomId}/resource-sections?sectionId=${sectionId}`, {
      method: 'DELETE',
    })
    setSections(p => p.filter(s => s.id !== sectionId))
  }

  function triggerUpload(sectionId: string) {
    uploadSectionRef.current = sectionId
    fileInputRef.current?.click()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    const sectionId = uploadSectionRef.current
    if (!file || !sectionId) return

    setUploadingTo(sectionId)
    const supabase = createClient()
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
    const path = `${classroomId}/${sectionId}/${Date.now()}-${file.name}`

    const { error: uploadError } = await supabase.storage
      .from('classroom-resources')
      .upload(path, file)

    if (uploadError) {
      setUploadingTo(null)
      e.target.value = ''
      return
    }

    const type = ext === 'pdf' ? 'pdf' : ext === 'docx' ? 'docx' : 'txt'
    const res = await fetch(
      `/api/classrooms/${classroomId}/resource-sections/${sectionId}/files`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.name, type, storage_path: path, size_bytes: file.size }),
      }
    )

    if (res.ok) {
      const newFile: ResourceFile = await res.json()
      setSections(p =>
        p.map(s =>
          s.id === sectionId
            ? { ...s, classroom_resource_files: [...s.classroom_resource_files, newFile] }
            : s
        )
      )

      setUploadingTo(null)
      setIngestingId(newFile.id)

      await fetch(`/api/classrooms/${classroomId}/resource-ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: newFile.id }),
      })

      setSections(p =>
        p.map(s => ({
          ...s,
          classroom_resource_files: s.classroom_resource_files.map(f =>
            f.id === newFile.id ? { ...f, ingested: true } : f
          ),
        }))
      )
      setIngestingId(null)
    } else {
      setUploadingTo(null)
    }

    e.target.value = ''
  }

  async function deleteFile(sectionId: string, fileId: string) {
    await fetch(
      `/api/classrooms/${classroomId}/resource-sections/${sectionId}/files/${fileId}`,
      { method: 'DELETE' }
    )
    setSections(p =>
      p.map(s =>
        s.id === sectionId
          ? { ...s, classroom_resource_files: s.classroom_resource_files.filter(f => f.id !== fileId) }
          : s
      )
    )
  }

  if (loading) {
    return (
      <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}>
        <Loader2 size={18} style={{ animation: 'spin 1s linear infinite', color: 'var(--mute)' }} />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.txt"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Add section — teacher only */}
      {isTeacher && (
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={newSectionTitle}
            onChange={e => setNewSectionTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addSection()}
            placeholder="New section title…"
            style={{
              flex: 1,
              background: 'var(--bg-3)',
              border: '1px solid var(--line)',
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 13,
              color: 'var(--ink)',
            }}
          />
          <button
            onClick={addSection}
            disabled={addingSection || !newSectionTitle.trim()}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              cursor: 'pointer',
              background: 'oklch(0.42 0.18 295 / 0.15)',
              border: '1px solid oklch(0.42 0.18 295 / 0.3)',
              color: 'var(--purple-2)',
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Plus size={13} /> Add Section
          </button>
        </div>
      )}

      {/* Empty state */}
      {sections.length === 0 && (
        <div
          style={{
            padding: '60px 0',
            textAlign: 'center',
            color: 'var(--mute)',
            border: '1px dashed var(--line)',
            borderRadius: 12,
            fontSize: 13,
            fontFamily: 'var(--font-mono)',
          }}
        >
          <FolderOpen size={24} style={{ opacity: 0.3, display: 'block', margin: '0 auto 10px' }} />
          {isTeacher ? 'Create a section and upload files to get started.' : 'No resources yet.'}
        </div>
      )}

      {/* Sections */}
      {sections.map(section => (
        <div
          key={section.id}
          style={{
            borderRadius: 12,
            overflow: 'hidden',
            border: '1px solid var(--line)',
            background: 'rgba(21,21,29,0.6)',
          }}
        >
          {/* Section header */}
          <div
            style={{
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              borderBottom:
                section.classroom_resource_files.length > 0
                  ? '1px solid var(--line)'
                  : 'none',
              background: 'rgba(255,255,255,0.02)',
            }}
          >
            <FolderOpen size={13} color="var(--purple-2)" />
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
              {section.title}
            </span>
            <span
              style={{
                fontSize: 11,
                color: 'var(--mute)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {section.classroom_resource_files.length} file
              {section.classroom_resource_files.length !== 1 ? 's' : ''}
            </span>

            {isTeacher && (
              <>
                <button
                  onClick={() => triggerUpload(section.id)}
                  disabled={uploadingTo === section.id}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 7,
                    cursor: 'pointer',
                    background: 'none',
                    border: '1px solid var(--line)',
                    color: 'var(--mute)',
                    fontSize: 11,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  {uploadingTo === section.id ? (
                    <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <Upload size={11} />
                  )}
                  Upload
                </button>
                <button
                  onClick={() => deleteSection(section.id)}
                  style={{
                    padding: 5,
                    borderRadius: 7,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--mute)',
                  }}
                  onMouseEnter={e =>
                    ((e.currentTarget as HTMLButtonElement).style.color = 'hsl(0 85% 70%)')
                  }
                  onMouseLeave={e =>
                    ((e.currentTarget as HTMLButtonElement).style.color = 'var(--mute)')
                  }
                >
                  <Trash2 size={12} />
                </button>
              </>
            )}
          </div>

          {/* Files */}
          {section.classroom_resource_files.map((file, i) => (
            <div
              key={file.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 16px',
                borderBottom:
                  i < section.classroom_resource_files.length - 1
                    ? '1px solid var(--line)'
                    : 'none',
              }}
            >
              <FileText size={13} color="var(--mute)" style={{ flexShrink: 0 }} />
              <span
                style={{
                  flex: 1,
                  fontSize: 12,
                  color: 'var(--ink-2)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {file.name}
              </span>
              {file.size_bytes != null && (
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--mute)',
                    fontFamily: 'var(--font-mono)',
                    flexShrink: 0,
                  }}
                >
                  {(file.size_bytes / 1024).toFixed(0)}kb
                </span>
              )}
              {ingestingId === file.id ? (
                <Loader2
                  size={12}
                  style={{
                    animation: 'spin 1s linear infinite',
                    color: 'var(--mute)',
                    flexShrink: 0,
                  }}
                />
              ) : file.ingested ? (
                <Check size={12} color="oklch(0.72 0.18 145)" style={{ flexShrink: 0 }} />
              ) : null}
              {isTeacher && (
                <button
                  onClick={() => deleteFile(section.id, file.id)}
                  style={{
                    padding: 4,
                    borderRadius: 6,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--mute)',
                    flexShrink: 0,
                  }}
                  onMouseEnter={e =>
                    ((e.currentTarget as HTMLButtonElement).style.color = 'hsl(0 85% 70%)')
                  }
                  onMouseLeave={e =>
                    ((e.currentTarget as HTMLButtonElement).style.color = 'var(--mute)')
                  }
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
