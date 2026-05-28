export type ResourceType = 'pdf' | 'docx' | 'youtube' | 'url' | 'note'
export type TopicStatus = 'locked' | 'unlocked' | 'done'
export type UserRole = 'student' | 'teacher'
export type CollaboratorStatus = 'pending' | 'accepted' | 'declined'
export type AssignmentType = 'mcq' | 'descriptive'

export interface Project {
  id: string
  user_id: string
  name: string
  description: string | null
  main_topic: string | null
  created_at: string
  path_mode?: 'ai' | 'custom'
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
  ingest_status?: 'pending' | 'indexing' | 'done' | 'error'
  suggested_topic_id?: string | null
  topic_confirmed?: boolean
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

export interface UserProfile {
  id: string
  role: UserRole
  display_name: string | null
  created_at: string
  updated_at: string
}

export interface ProjectCollaborator {
  id: string
  project_id: string
  user_id: string
  invited_by: string
  status: CollaboratorStatus
  created_at: string
}

export interface Classroom {
  id: string
  teacher_id: string
  name: string
  description: string | null
  invite_code: string
  created_at: string
}

export interface ClassroomMember {
  id: string
  classroom_id: string
  student_id: string
  joined_at: string
}

export interface ClassroomProject {
  id: string
  classroom_id: string
  project_id: string
  added_at: string
}

export interface StudentProjectCopy {
  id: string
  classroom_project_id: string
  student_id: string
  project_id: string
  created_at: string
}

export interface ClassroomAssignment {
  id: string
  classroom_id: string
  project_id: string | null
  title: string
  description: string | null
  type: AssignmentType
  questions: unknown
  deadline: string | null
  created_by: string
  created_at: string
  auto_correct?: boolean
  auto_correct_enabled?: boolean
}

export interface AssignmentSubmission {
  id: string
  assignment_id: string
  student_id: string
  answers: unknown
  score: number | null
  ai_review: unknown
  submitted_at: string
}

export interface Notification {
  id: string
  user_id: string
  type: string
  title: string
  body: string | null
  data: unknown
  read: boolean
  created_at: string
}

export interface ChatSession {
  id: string
  topic_id: string
  user_id: string | null
  name: string
  created_at: string
}

export interface FeedPost {
  id: string
  classroom_id: string
  author_id: string | null
  type: 'announcement' | 'discussion'
  title: string | null
  body: string
  created_at: string
  author_name?: string
}

export interface FeedReply {
  id: string
  post_id: string
  parent_reply_id: string | null
  author_id: string | null
  body: string
  created_at: string
  author_name?: string
  replies?: FeedReply[]
}

export interface UserTreeNode {
  id: string
  project_id: string
  user_id: string | null
  name: string
  description: string | null
  parent_id: string | null
  position: number
  created_at: string
}

export interface ClassroomResourceSection {
  id: string
  classroom_id: string
  title: string
  order_index: number
  created_at: string
}

export interface ClassroomResourceFile {
  id: string
  section_id: string
  classroom_id: string
  name: string
  type: string
  storage_path: string | null
  url: string | null
  size_bytes: number | null
  ingested: boolean
  created_at: string
}

export interface ClassroomResourceChunk {
  id: string
  classroom_id: string
  file_id: string | null
  user_id: string | null
  chunk_index: number
  content: string
  created_at: string
}

export interface PersonalResource {
  id: string
  classroom_id: string
  user_id: string
  name: string
  type: string
  storage_path: string | null
  size_bytes: number | null
  ingested: boolean
  created_at: string
}

export interface ClassroomAIChat {
  id: string
  classroom_id: string
  user_id: string
  title: string
  created_at: string
}

export interface ClassroomAIMessage {
  id: string
  chat_id: string
  role: 'user' | 'assistant'
  content: string
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
      projects:               TableDef<Project,              Omit<Project, 'id' | 'created_at'>,                    Partial<Omit<Project, 'id'>>>
      topics:                 TableDef<Topic,                Omit<Topic, 'id' | 'created_at'>,                      Partial<Omit<Topic, 'id'>>>
      topic_edges:            TableDef<TopicEdge,            TopicEdge,                                             Partial<TopicEdge>>
      resources:              TableDef<Resource,             Omit<Resource, 'id' | 'created_at'>,                   Partial<Omit<Resource, 'id'>>>
      chat_messages:          TableDef<ChatMessage,          Omit<ChatMessage, 'id' | 'created_at'>,                Partial<Omit<ChatMessage, 'id'>>>
      topic_memory:           TableDef<TopicMemory,          TopicMemory,                                           TopicMemory>
      assessment_results:     TableDef<AssessmentResult,     Omit<AssessmentResult, 'id' | 'created_at'>,           Partial<Omit<AssessmentResult, 'id'>>>
      wrong_answers:          TableDef<WrongAnswer,          Omit<WrongAnswer, 'id' | 'created_at'>,                Partial<Omit<WrongAnswer, 'id'>>>
      user_profiles:          TableDef<UserProfile,          Omit<UserProfile, 'created_at' | 'updated_at'>,        Partial<Omit<UserProfile, 'id'>>>
      project_collaborators:  TableDef<ProjectCollaborator,  Omit<ProjectCollaborator, 'id' | 'created_at'>,        Partial<Omit<ProjectCollaborator, 'id'>>>
      classrooms:             TableDef<Classroom,            Omit<Classroom, 'id' | 'invite_code' | 'created_at'>,  Partial<Omit<Classroom, 'id'>>>
      classroom_members:      TableDef<ClassroomMember,      Omit<ClassroomMember, 'id' | 'joined_at'>,             Partial<Omit<ClassroomMember, 'id'>>>
      classroom_projects:     TableDef<ClassroomProject,     Omit<ClassroomProject, 'id' | 'added_at'>,             Partial<Omit<ClassroomProject, 'id'>>>
      student_project_copies: TableDef<StudentProjectCopy,   Omit<StudentProjectCopy, 'id' | 'created_at'>,         Partial<Omit<StudentProjectCopy, 'id'>>>
      classroom_assignments:  TableDef<ClassroomAssignment,  Omit<ClassroomAssignment, 'id' | 'created_at'>,        Partial<Omit<ClassroomAssignment, 'id'>>>
      assignment_submissions: TableDef<AssignmentSubmission, Omit<AssignmentSubmission, 'id' | 'submitted_at'>,     Partial<Omit<AssignmentSubmission, 'id'>>>
      notifications:          TableDef<Notification,         Omit<Notification, 'id' | 'created_at'>,               Partial<Omit<Notification, 'id'>>>
      chat_sessions:          TableDef<ChatSession,          Omit<ChatSession, 'id' | 'created_at'>,                Partial<Omit<ChatSession, 'id'>>>
      feed_posts:             TableDef<FeedPost,             Omit<FeedPost, 'id' | 'created_at' | 'author_name'>,  Partial<Omit<FeedPost, 'id'>>>
      feed_replies:           TableDef<FeedReply,            Omit<FeedReply, 'id' | 'created_at' | 'author_name' | 'replies'>, Partial<Omit<FeedReply, 'id'>>>
      user_tree_nodes:        TableDef<UserTreeNode,         Omit<UserTreeNode, 'id' | 'created_at'>,              Partial<Omit<UserTreeNode, 'id'>>>
      classroom_resource_sections: TableDef<ClassroomResourceSection, Omit<ClassroomResourceSection,'id'|'created_at'>, Partial<Omit<ClassroomResourceSection,'id'>>>
      classroom_resource_files:    TableDef<ClassroomResourceFile,    Omit<ClassroomResourceFile,'id'|'created_at'>,    Partial<Omit<ClassroomResourceFile,'id'>>>
      classroom_resource_chunks:   TableDef<ClassroomResourceChunk,   Omit<ClassroomResourceChunk,'id'|'created_at'>,   Partial<Omit<ClassroomResourceChunk,'id'>>>
      personal_resources:          TableDef<PersonalResource,         Omit<PersonalResource,'id'|'created_at'>,          Partial<Omit<PersonalResource,'id'>>>
      classroom_ai_chats:          TableDef<ClassroomAIChat,          Omit<ClassroomAIChat,'id'|'created_at'>,           Partial<Omit<ClassroomAIChat,'id'>>>
      classroom_ai_messages:       TableDef<ClassroomAIMessage,       Omit<ClassroomAIMessage,'id'|'created_at'>,        Partial<Omit<ClassroomAIMessage,'id'>>>
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
