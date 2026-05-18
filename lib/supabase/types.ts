export type ResourceType = 'pdf' | 'docx' | 'youtube' | 'url' | 'note'
export type TopicStatus = 'locked' | 'unlocked' | 'done'

export interface Project {
  id: string
  user_id: string
  name: string
  description: string | null
  main_topic: string | null
  created_at: string
}

export interface Topic {
  id: string
  project_id: string
  name: string
  description: string | null
  status: TopicStatus
  created_at: string
}

export interface TopicEdge {
  parent_id: string
  child_id: string
}

export interface Resource {
  id: string
  project_id: string
  type: ResourceType
  url: string | null
  storage_path: string | null
  label: string
  ingested_at: string | null
  created_at: string
}

export interface ChatMessage {
  id: string
  topic_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface TopicMemory {
  topic_id: string
  summary: string
  updated_at: string
}

export interface AssessmentResult {
  id: string
  topic_id: string
  mode: 'mcq' | 'descriptive'
  score: number
  max_score: number
  created_at: string
}

export interface WrongAnswer {
  id: string
  topic_id: string
  question: string
  user_answer: string
  correct_answer: string
  created_at: string
}

type TableDef<Row, Insert, Update> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: never[]
}

export interface Database {
  public: {
    Tables: {
      projects:           TableDef<Project,          Omit<Project, 'id' | 'created_at'>,          Partial<Omit<Project, 'id'>>>
      topics:             TableDef<Topic,            Omit<Topic, 'id' | 'created_at'>,            Partial<Omit<Topic, 'id'>>>
      topic_edges:        TableDef<TopicEdge,        TopicEdge,                                   Partial<TopicEdge>>
      resources:          TableDef<Resource,         Omit<Resource, 'id' | 'created_at'>,         Partial<Omit<Resource, 'id'>>>
      chat_messages:      TableDef<ChatMessage,      Omit<ChatMessage, 'id' | 'created_at'>,      Partial<Omit<ChatMessage, 'id'>>>
      topic_memory:       TableDef<TopicMemory,      TopicMemory,                                 TopicMemory>
      assessment_results: TableDef<AssessmentResult, Omit<AssessmentResult, 'id' | 'created_at'>, Partial<Omit<AssessmentResult, 'id'>>>
      wrong_answers:      TableDef<WrongAnswer,      Omit<WrongAnswer, 'id' | 'created_at'>,      Partial<Omit<WrongAnswer, 'id'>>>
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
